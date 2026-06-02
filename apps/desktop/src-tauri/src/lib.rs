use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use image::{GenericImageView, ImageFormat};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::{
    ffi::OsStr,
    fs,
    io::{Cursor, Read, Write},
    net::{TcpListener, TcpStream},
    path::{Path, PathBuf},
    process::{Command, Output},
    thread,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, Manager};

const PROJECT_DIR_NAME: &str = "Vixio Demo.vixio";
const MANIFEST_NAME: &str = "manifest.json";
const SQLITE_NAME: &str = "project.sqlite";
const MIGRATION_BASE_SCHEMA: &str = "001_base_schema";
const MIGRATION_ASSET_PATHS: &str = "002_asset_paths";
const MIGRATION_REFERENCE_FINGERPRINT: &str = "003_reference_fingerprint";
const MIGRATION_REFERENCE_PERCEPTUAL_HASH: &str = "004_reference_perceptual_hash";
const MIGRATION_REFERENCE_ORIGIN: &str = "005_reference_origin";
const MIGRATION_TAG_SUGGESTION_META: &str = "006_tag_suggestion_meta";
const MIGRATION_OUTLINE_DRAFTS: &str = "007_outline_drafts";
const CAPTURE_SERVER_ADDR: &str = "127.0.0.1:47653";
const CAPTURE_EVENT: &str = "vixio:capture";
const EAGLE_WEB_API_ADDR: &str = "127.0.0.1:41595";

#[derive(Deserialize, Serialize)]
struct ProjectSnapshot {
    version: i64,
    ideas: Vec<IdeaRecord>,
    images: Vec<ReferenceRecord>,
    links: Vec<LinkRecord>,
    #[serde(rename = "outlineDrafts")]
    outline_drafts: Vec<OutlineDraftRecord>,
}

#[derive(Deserialize, Serialize)]
struct IdeaRecord {
    id: String,
    title: String,
    body: String,
    status: String,
    x: f64,
    y: f64,
}

#[derive(Deserialize, Serialize)]
struct ReferenceRecord {
    id: String,
    title: String,
    source: String,
    #[serde(default, rename = "originApp")]
    origin_app: Option<String>,
    #[serde(default, rename = "originId")]
    origin_id: Option<String>,
    #[serde(default, rename = "sourcePath")]
    source_path: Option<String>,
    palette: Vec<String>,
    tags: Vec<String>,
    suggestions: Vec<TagSuggestionRecord>,
    x: f64,
    y: f64,
    thumb: String,
    #[serde(default)]
    fingerprint: String,
    #[serde(default, rename = "perceptualHash")]
    perceptual_hash: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ImportedReferenceRecord {
    id: String,
    title: String,
    source: String,
    origin_app: Option<String>,
    origin_id: Option<String>,
    source_path: Option<String>,
    palette: Vec<String>,
    tags: Vec<String>,
    suggestions: Vec<String>,
    x: f64,
    y: f64,
    thumb: String,
    fingerprint: String,
    #[serde(rename = "perceptualHash")]
    perceptual_hash: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(untagged)]
enum TagSuggestionRecord {
    Plain(String),
    Detailed {
        label: String,
        source: Option<String>,
        confidence: Option<f64>,
        status: Option<String>,
    },
}

impl TagSuggestionRecord {
    fn label(&self) -> String {
        match self {
            Self::Plain(value) => value.clone(),
            Self::Detailed { label, .. } => label.clone(),
        }
    }

    fn source(&self) -> String {
        match self {
            Self::Plain(_) => "local".to_string(),
            Self::Detailed { source, .. } => source.clone().unwrap_or_else(|| "local".to_string()),
        }
    }

    fn confidence(&self) -> f64 {
        match self {
            Self::Plain(_) => 0.5,
            Self::Detailed { confidence, .. } => confidence.unwrap_or(0.5).clamp(0.0, 1.0),
        }
    }

    fn status(&self) -> String {
        match self {
            Self::Plain(_) => "pending".to_string(),
            Self::Detailed { status, .. } => {
                status.clone().unwrap_or_else(|| "pending".to_string())
            }
        }
    }
}

struct MaterializedReference {
    asset_path: Option<String>,
    thumb_path: Option<String>,
    thumb: String,
}

#[derive(Deserialize, Serialize)]
struct LinkRecord {
    id: String,
    #[serde(rename = "imageId")]
    image_id: String,
    #[serde(rename = "ideaId")]
    idea_id: String,
    relation: String,
    note: String,
    confidence: f64,
}

#[derive(Deserialize, Serialize)]
struct OutlineDraftRecord {
    id: String,
    title: String,
    #[serde(rename = "createdAt")]
    created_at: String,
    sections: Vec<OutlineDraftSectionRecord>,
}

#[derive(Deserialize, Serialize)]
struct OutlineDraftSectionRecord {
    id: String,
    #[serde(rename = "ideaId")]
    idea_id: String,
    title: String,
    summary: String,
    #[serde(rename = "referenceIds")]
    reference_ids: Vec<String>,
    strength: String,
}

#[derive(Default)]
struct EagleItemMetadata {
    id: Option<String>,
    name: Option<String>,
    url: Option<String>,
    annotation: Option<String>,
    tags: Vec<String>,
    source_path: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectPackageInfo {
    path: String,
    manifest_path: String,
    sqlite_path: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct OcrResult {
    text: String,
    suggestions: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LocalModelAvailability {
    available: bool,
    status: String,
    reason: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LocalModelTagResult {
    available: bool,
    status: String,
    raw: String,
    suggestions: Vec<String>,
}

#[tauri::command]
fn save_project_package(
    app: AppHandle,
    snapshot_json: String,
    project_path: Option<String>,
) -> Result<ProjectPackageInfo, String> {
    let snapshot: ProjectSnapshot = serde_json::from_str(&snapshot_json)
        .map_err(|error| format!("Invalid project JSON: {error}"))?;
    if snapshot.version != 1 {
        return Err("Unsupported project snapshot version".to_string());
    }

    let project_dir = resolve_project_dir(&app, project_path)?;
    ensure_project_dirs(&project_dir)?;

    let manifest_path = project_dir.join(MANIFEST_NAME);
    fs::write(&manifest_path, &snapshot_json).map_err(|error| error.to_string())?;

    let sqlite_path = project_dir.join(SQLITE_NAME);
    let mut conn = Connection::open(&sqlite_path).map_err(|error| error.to_string())?;
    migrate(&conn)?;
    write_snapshot(&mut conn, &snapshot, &project_dir)?;

    Ok(ProjectPackageInfo {
        path: project_dir.to_string_lossy().to_string(),
        manifest_path: manifest_path.to_string_lossy().to_string(),
        sqlite_path: sqlite_path.to_string_lossy().to_string(),
    })
}

#[tauri::command]
fn open_project_package(app: AppHandle) -> Result<Option<String>, String> {
    let project_dir = project_dir(&app)?;
    read_project_package(&project_dir)
}

#[tauri::command]
fn open_project_package_at(project_path: String) -> Result<Option<String>, String> {
    read_project_package(&normalize_project_path(project_path))
}

#[tauri::command]
fn import_reference_folder(folder_path: String) -> Result<Vec<ImportedReferenceRecord>, String> {
    import_reference_folder_from_path(Path::new(&folder_path))
}

#[tauri::command]
fn import_eagle_web_items(limit: Option<u32>) -> Result<Vec<ImportedReferenceRecord>, String> {
    import_eagle_web_items_with_limit(limit.unwrap_or(50))
}

#[tauri::command]
fn capture_screen_reference() -> Result<Option<ImportedReferenceRecord>, String> {
    capture_screen_reference_to_temp()
}

#[tauri::command]
fn run_apple_vision_ocr(image_data_url: String) -> Result<Option<OcrResult>, String> {
    run_apple_vision_ocr_for_data_url(&image_data_url)
}

#[tauri::command]
fn check_foundation_model_availability() -> Result<LocalModelAvailability, String> {
    check_foundation_model_availability_native()
}

#[tauri::command]
fn normalize_tags_with_foundation_model(
    text_context: String,
) -> Result<LocalModelTagResult, String> {
    normalize_tags_with_foundation_model_native(&text_context)
}

#[tauri::command]
fn export_outline_markdown(
    app: AppHandle,
    markdown: String,
    project_path: Option<String>,
) -> Result<Option<String>, String> {
    let project_dir = resolve_project_dir(&app, project_path)?;
    export_text_to_exports(&project_dir, "outline.md", &markdown).map(Some)
}

#[tauri::command]
fn export_outline_html(
    app: AppHandle,
    html: String,
    project_path: Option<String>,
) -> Result<Option<String>, String> {
    let project_dir = resolve_project_dir(&app, project_path)?;
    export_text_to_exports(&project_dir, "outline.html", &html).map(Some)
}

#[tauri::command]
fn export_contact_sheet_html(
    app: AppHandle,
    html: String,
    project_path: Option<String>,
) -> Result<Option<String>, String> {
    let project_dir = resolve_project_dir(&app, project_path)?;
    export_text_to_exports(&project_dir, "contact-sheet.html", &html).map(Some)
}

#[tauri::command]
fn export_slideshow_html(
    app: AppHandle,
    html: String,
    project_path: Option<String>,
) -> Result<Option<String>, String> {
    let project_dir = resolve_project_dir(&app, project_path)?;
    export_text_to_exports(&project_dir, "slides.html", &html).map(Some)
}

fn read_project_package(project_dir: &Path) -> Result<Option<String>, String> {
    let sqlite_path = project_dir.join(SQLITE_NAME);
    if sqlite_path.exists() {
        let conn = Connection::open(sqlite_path).map_err(|error| error.to_string())?;
        migrate(&conn)?;
        let snapshot = read_snapshot(&conn)?;
        return serde_json::to_string(&snapshot)
            .map(Some)
            .map_err(|error| error.to_string());
    }

    let manifest_path = project_dir.join(MANIFEST_NAME);
    if !manifest_path.exists() {
        return Ok(None);
    }

    fs::read_to_string(manifest_path)
        .map(Some)
        .map_err(|error| error.to_string())
}

fn ensure_project_dirs(project_dir: &PathBuf) -> Result<(), String> {
    fs::create_dir_all(project_dir.join("images")).map_err(|error| error.to_string())?;
    fs::create_dir_all(project_dir.join("thumbs")).map_err(|error| error.to_string())?;
    fs::create_dir_all(project_dir.join("exports")).map_err(|error| error.to_string())?;
    Ok(())
}

fn export_text_to_exports(
    project_dir: &PathBuf,
    filename: &str,
    contents: &str,
) -> Result<String, String> {
    ensure_project_dirs(project_dir)?;
    let export_path = project_dir.join("exports").join(filename);
    fs::write(&export_path, contents).map_err(|error| error.to_string())?;
    Ok(export_path.to_string_lossy().to_string())
}

fn resolve_project_dir(app: &AppHandle, project_path: Option<String>) -> Result<PathBuf, String> {
    Ok(match project_path {
        Some(path) => normalize_project_path(path),
        None => project_dir(app)?,
    })
}

fn normalize_project_path(project_path: String) -> PathBuf {
    let mut path = PathBuf::from(project_path);
    if path.extension().and_then(|extension| extension.to_str()) != Some("vixio") {
        path.set_extension("vixio");
    }
    path
}

fn migrate(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS schema_migrations (
          id TEXT PRIMARY KEY,
          applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS project_meta (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS ideas (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          status TEXT NOT NULL,
          x REAL NOT NULL,
          y REAL NOT NULL
        );

        CREATE TABLE IF NOT EXISTS reference_assets (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          source TEXT NOT NULL,
          origin_app TEXT,
          origin_id TEXT,
          source_path TEXT,
          palette_json TEXT NOT NULL,
          thumb TEXT NOT NULL,
          asset_path TEXT,
          thumb_path TEXT,
          fingerprint TEXT NOT NULL DEFAULT '',
          perceptual_hash TEXT NOT NULL DEFAULT '',
          x REAL NOT NULL,
          y REAL NOT NULL
        );

        CREATE TABLE IF NOT EXISTS links (
          id TEXT PRIMARY KEY,
          image_id TEXT NOT NULL,
          idea_id TEXT NOT NULL,
          relation TEXT NOT NULL,
          note TEXT NOT NULL,
          confidence REAL NOT NULL,
          FOREIGN KEY(image_id) REFERENCES reference_assets(id) ON DELETE CASCADE,
          FOREIGN KEY(idea_id) REFERENCES ideas(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS reference_tags (
          reference_id TEXT NOT NULL,
          tag TEXT NOT NULL,
          position INTEGER NOT NULL,
          PRIMARY KEY(reference_id, tag),
          FOREIGN KEY(reference_id) REFERENCES reference_assets(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS tag_suggestions (
          reference_id TEXT NOT NULL,
          suggestion TEXT NOT NULL,
          source TEXT NOT NULL DEFAULT 'local',
          confidence REAL NOT NULL DEFAULT 0.5,
          status TEXT NOT NULL DEFAULT 'pending',
          position INTEGER NOT NULL,
          PRIMARY KEY(reference_id, suggestion),
          FOREIGN KEY(reference_id) REFERENCES reference_assets(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS outline_drafts (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          created_at TEXT NOT NULL,
          sections_json TEXT NOT NULL,
          position INTEGER NOT NULL
        );
        ",
    )
    .map_err(|error| error.to_string())?;
    record_migration(conn, MIGRATION_BASE_SCHEMA)?;

    add_column_if_missing(conn, "reference_assets", "asset_path", "TEXT")?;
    add_column_if_missing(conn, "reference_assets", "thumb_path", "TEXT")?;
    record_migration(conn, MIGRATION_ASSET_PATHS)?;
    add_column_if_missing(
        conn,
        "reference_assets",
        "fingerprint",
        "TEXT NOT NULL DEFAULT ''",
    )?;
    record_migration(conn, MIGRATION_REFERENCE_FINGERPRINT)?;
    add_column_if_missing(
        conn,
        "reference_assets",
        "perceptual_hash",
        "TEXT NOT NULL DEFAULT ''",
    )?;
    record_migration(conn, MIGRATION_REFERENCE_PERCEPTUAL_HASH)?;
    add_column_if_missing(conn, "reference_assets", "origin_app", "TEXT")?;
    add_column_if_missing(conn, "reference_assets", "origin_id", "TEXT")?;
    add_column_if_missing(conn, "reference_assets", "source_path", "TEXT")?;
    record_migration(conn, MIGRATION_REFERENCE_ORIGIN)?;
    add_column_if_missing(
        conn,
        "tag_suggestions",
        "source",
        "TEXT NOT NULL DEFAULT 'local'",
    )?;
    add_column_if_missing(
        conn,
        "tag_suggestions",
        "confidence",
        "REAL NOT NULL DEFAULT 0.5",
    )?;
    add_column_if_missing(
        conn,
        "tag_suggestions",
        "status",
        "TEXT NOT NULL DEFAULT 'pending'",
    )?;
    record_migration(conn, MIGRATION_TAG_SUGGESTION_META)?;
    record_migration(conn, MIGRATION_OUTLINE_DRAFTS)?;
    Ok(())
}

fn record_migration(conn: &Connection, id: &str) -> Result<(), String> {
    conn.execute(
        "INSERT OR IGNORE INTO schema_migrations (id) VALUES (?1)",
        params![id],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

fn add_column_if_missing(
    conn: &Connection,
    table: &str,
    column: &str,
    definition: &str,
) -> Result<(), String> {
    let mut statement = conn
        .prepare(&format!("PRAGMA table_info({table})"))
        .map_err(|error| error.to_string())?;
    let columns = statement
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    if columns.iter().any(|name| name == column) {
        return Ok(());
    }

    conn.execute(
        &format!("ALTER TABLE {table} ADD COLUMN {column} {definition}"),
        [],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

fn write_snapshot(
    conn: &mut Connection,
    snapshot: &ProjectSnapshot,
    project_dir: &Path,
) -> Result<(), String> {
    let tx = conn.transaction().map_err(|error| error.to_string())?;
    tx.execute("DELETE FROM tag_suggestions", [])
        .map_err(|error| error.to_string())?;
    tx.execute("DELETE FROM reference_tags", [])
        .map_err(|error| error.to_string())?;
    tx.execute("DELETE FROM links", [])
        .map_err(|error| error.to_string())?;
    tx.execute("DELETE FROM outline_drafts", [])
        .map_err(|error| error.to_string())?;
    tx.execute("DELETE FROM reference_assets", [])
        .map_err(|error| error.to_string())?;
    tx.execute("DELETE FROM ideas", [])
        .map_err(|error| error.to_string())?;
    tx.execute("DELETE FROM project_meta", [])
        .map_err(|error| error.to_string())?;

    tx.execute(
        "INSERT INTO project_meta (key, value) VALUES ('version', ?1)",
        params![snapshot.version.to_string()],
    )
    .map_err(|error| error.to_string())?;

    for idea in &snapshot.ideas {
        tx.execute(
            "INSERT INTO ideas (id, title, body, status, x, y) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![idea.id, idea.title, idea.body, idea.status, idea.x, idea.y],
        )
        .map_err(|error| error.to_string())?;
    }

    for reference in &snapshot.images {
        let palette_json =
            serde_json::to_string(&reference.palette).map_err(|error| error.to_string())?;
        let materialized = materialize_reference(project_dir, reference)?;
        tx.execute(
            "INSERT INTO reference_assets (id, title, source, origin_app, origin_id, source_path, palette_json, thumb, asset_path, thumb_path, fingerprint, perceptual_hash, x, y) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
            params![
                reference.id,
                reference.title,
                reference.source,
                reference.origin_app,
                reference.origin_id,
                reference.source_path,
                palette_json,
                materialized.thumb,
                materialized.asset_path,
                materialized.thumb_path,
                reference.fingerprint,
                reference.perceptual_hash,
                reference.x,
                reference.y
            ],
        )
        .map_err(|error| error.to_string())?;

        for (position, tag) in reference.tags.iter().enumerate() {
            tx.execute(
                "INSERT INTO reference_tags (reference_id, tag, position) VALUES (?1, ?2, ?3)",
                params![reference.id, tag, position as i64],
            )
            .map_err(|error| error.to_string())?;
        }

        for (position, suggestion) in reference.suggestions.iter().enumerate() {
            tx.execute(
                "INSERT INTO tag_suggestions (reference_id, suggestion, source, confidence, status, position) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![
                    reference.id,
                    suggestion.label(),
                    suggestion.source(),
                    suggestion.confidence(),
                    suggestion.status(),
                    position as i64
                ],
            )
            .map_err(|error| error.to_string())?;
        }
    }

    for link in &snapshot.links {
        tx.execute(
            "INSERT INTO links (id, image_id, idea_id, relation, note, confidence) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                link.id,
                link.image_id,
                link.idea_id,
                link.relation,
                link.note,
                link.confidence
            ],
        )
        .map_err(|error| error.to_string())?;
    }

    for (position, draft) in snapshot.outline_drafts.iter().enumerate() {
        let sections_json =
            serde_json::to_string(&draft.sections).map_err(|error| error.to_string())?;
        tx.execute(
            "INSERT INTO outline_drafts (id, title, created_at, sections_json, position) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                draft.id,
                draft.title,
                draft.created_at,
                sections_json,
                position as i64
            ],
        )
        .map_err(|error| error.to_string())?;
    }

    tx.commit().map_err(|error| error.to_string())
}

fn read_snapshot(conn: &Connection) -> Result<ProjectSnapshot, String> {
    let version = conn
        .query_row(
            "SELECT value FROM project_meta WHERE key = 'version'",
            [],
            |row| row.get::<_, String>(0),
        )
        .ok()
        .and_then(|value| value.parse::<i64>().ok())
        .unwrap_or(1);

    let ideas = read_ideas(conn)?;
    let images = read_references(conn)?;
    let links = read_links(conn)?;
    let outline_drafts = read_outline_drafts(conn)?;

    Ok(ProjectSnapshot {
        version,
        ideas,
        images,
        links,
        outline_drafts,
    })
}

fn read_ideas(conn: &Connection) -> Result<Vec<IdeaRecord>, String> {
    let mut statement = conn
        .prepare("SELECT id, title, body, status, x, y FROM ideas ORDER BY rowid")
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok(IdeaRecord {
                id: row.get(0)?,
                title: row.get(1)?,
                body: row.get(2)?,
                status: row.get(3)?,
                x: row.get(4)?,
                y: row.get(5)?,
            })
        })
        .map_err(|error| error.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

fn read_references(conn: &Connection) -> Result<Vec<ReferenceRecord>, String> {
    let mut statement = conn
        .prepare(
            "SELECT id, title, source, origin_app, origin_id, source_path, palette_json, thumb, asset_path, thumb_path, fingerprint, perceptual_hash, x, y FROM reference_assets ORDER BY rowid",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| {
            let id: String = row.get(0)?;
            let palette_json: String = row.get(6)?;
            let palette = serde_json::from_str::<Vec<String>>(&palette_json).unwrap_or_default();
            Ok(ReferenceRecord {
                tags: read_string_list(conn, "reference_tags", "tag", &id)?,
                suggestions: read_tag_suggestions(conn, &id)?,
                id,
                title: row.get(1)?,
                source: row.get(2)?,
                origin_app: row.get(3)?,
                origin_id: row.get(4)?,
                source_path: row.get(5)?,
                palette,
                thumb: read_thumb_for_frontend(row.get(9)?, row.get(7)?)?,
                fingerprint: row.get(10)?,
                perceptual_hash: row.get(11)?,
                x: row.get(12)?,
                y: row.get(13)?,
            })
        })
        .map_err(|error| error.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

fn read_links(conn: &Connection) -> Result<Vec<LinkRecord>, String> {
    let mut statement = conn
        .prepare(
            "SELECT id, image_id, idea_id, relation, note, confidence FROM links ORDER BY rowid",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok(LinkRecord {
                id: row.get(0)?,
                image_id: row.get(1)?,
                idea_id: row.get(2)?,
                relation: row.get(3)?,
                note: row.get(4)?,
                confidence: row.get(5)?,
            })
        })
        .map_err(|error| error.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

fn read_outline_drafts(conn: &Connection) -> Result<Vec<OutlineDraftRecord>, String> {
    let mut statement = conn
        .prepare(
            "SELECT id, title, created_at, sections_json FROM outline_drafts ORDER BY position",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| {
            let sections_json: String = row.get(3)?;
            let sections = serde_json::from_str::<Vec<OutlineDraftSectionRecord>>(&sections_json)
                .unwrap_or_default();
            Ok(OutlineDraftRecord {
                id: row.get(0)?,
                title: row.get(1)?,
                created_at: row.get(2)?,
                sections,
            })
        })
        .map_err(|error| error.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

fn read_string_list(
    conn: &Connection,
    table: &str,
    column: &str,
    reference_id: &str,
) -> rusqlite::Result<Vec<String>> {
    let mut statement = conn.prepare(&format!(
        "SELECT {column} FROM {table} WHERE reference_id = ?1 ORDER BY position"
    ))?;
    let rows = statement.query_map(params![reference_id], |row| row.get::<_, String>(0))?;
    rows.collect()
}

fn read_tag_suggestions(
    conn: &Connection,
    reference_id: &str,
) -> rusqlite::Result<Vec<TagSuggestionRecord>> {
    let mut statement = conn.prepare(
        "SELECT suggestion, source, confidence, status FROM tag_suggestions WHERE reference_id = ?1 ORDER BY position",
    )?;
    let rows = statement.query_map(params![reference_id], |row| {
        Ok(TagSuggestionRecord::Detailed {
            label: row.get(0)?,
            source: Some(row.get(1)?),
            confidence: Some(row.get(2)?),
            status: Some(row.get(3)?),
        })
    })?;
    rows.collect()
}

fn materialize_reference(
    project_dir: &Path,
    reference: &ReferenceRecord,
) -> Result<MaterializedReference, String> {
    let Some(data_url) = parse_data_url(&reference.thumb)? else {
        return Ok(MaterializedReference {
            asset_path: None,
            thumb_path: None,
            thumb: reference.thumb.clone(),
        });
    };

    let extension = extension_for_mime(data_url.mime);
    let asset_path =
        project_dir
            .join("images")
            .join(format!("{}.{}", safe_file_stem(&reference.id), extension));
    fs::write(&asset_path, &data_url.bytes).map_err(|error| error.to_string())?;

    let thumb_path = project_dir
        .join("thumbs")
        .join(format!("{}.png", safe_file_stem(&reference.id)));
    write_thumbnail(&data_url.bytes, &thumb_path)?;

    Ok(MaterializedReference {
        asset_path: Some(asset_path.to_string_lossy().to_string()),
        thumb_path: Some(thumb_path.to_string_lossy().to_string()),
        thumb: reference.thumb.clone(),
    })
}

struct ParsedDataUrl<'a> {
    mime: &'a str,
    bytes: Vec<u8>,
}

fn parse_data_url(value: &str) -> Result<Option<ParsedDataUrl<'_>>, String> {
    if !value.starts_with("data:image/") {
        return Ok(None);
    }

    let Some((header, encoded)) = value.split_once(',') else {
        return Ok(None);
    };
    if !header.ends_with(";base64") {
        return Ok(None);
    }
    let mime = header
        .trim_start_matches("data:")
        .trim_end_matches(";base64");
    let bytes = BASE64.decode(encoded).map_err(|error| error.to_string())?;
    Ok(Some(ParsedDataUrl { mime, bytes }))
}

fn extension_for_mime(mime: &str) -> &'static str {
    match mime {
        "image/jpeg" => "jpg",
        "image/webp" => "webp",
        _ => "png",
    }
}

fn safe_file_stem(value: &str) -> String {
    value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || character == '-' || character == '_' {
                character
            } else {
                '-'
            }
        })
        .collect()
}

fn write_thumbnail(bytes: &[u8], path: &Path) -> Result<(), String> {
    let image = image::load_from_memory(bytes).map_err(|error| error.to_string())?;
    let thumbnail = image.thumbnail(320, 320);
    let mut output = Cursor::new(Vec::new());
    thumbnail
        .write_to(&mut output, ImageFormat::Png)
        .map_err(|error| error.to_string())?;
    fs::write(path, output.into_inner()).map_err(|error| error.to_string())
}

fn thumbnail_data_url(bytes: &[u8]) -> Result<String, String> {
    let image = image::load_from_memory(bytes).map_err(|error| error.to_string())?;
    let thumbnail = image.thumbnail(320, 320);
    let mut output = Cursor::new(Vec::new());
    thumbnail
        .write_to(&mut output, ImageFormat::Png)
        .map_err(|error| error.to_string())?;
    Ok(format!(
        "data:image/png;base64,{}",
        BASE64.encode(output.into_inner())
    ))
}

fn import_reference_folder_from_path(
    folder: &Path,
) -> Result<Vec<ImportedReferenceRecord>, String> {
    if !folder.is_dir() {
        return Err("Selected path is not a folder".to_string());
    }

    let mut entries = collect_supported_image_paths(folder)?;
    entries.sort();

    let import_id = timestamp_millis();
    let mut imported = Vec::new();

    for path in entries {
        let bytes = fs::read(&path).map_err(|error| error.to_string())?;
        let file_name = path
            .file_name()
            .and_then(OsStr::to_str)
            .unwrap_or("reference");
        let metadata = eagle_metadata_for_image(&path);
        let analysis = analyze_image_bytes(&bytes)?;
        let tags = merge_unique(
            tags_from_filename(file_name)
                .into_iter()
                .chain(analysis.tags.clone())
                .collect(),
        );
        let index = imported.len();
        let slot = index;
        let column = slot / 5;

        imported.push(ImportedReferenceRecord {
            id: format!("img-folder-{import_id}-{index}"),
            title: title_from_import(file_name, metadata.as_ref()),
            source: source_from_import(&path, metadata.as_ref()),
            origin_app: metadata.as_ref().map(|_| "eagle".to_string()),
            origin_id: metadata.as_ref().and_then(|metadata| metadata.id.clone()),
            source_path: metadata
                .as_ref()
                .and_then(|metadata| metadata.source_path.clone())
                .or_else(|| Some(path.to_string_lossy().to_string())),
            palette: if analysis.palette.is_empty() {
                palette_from_name(file_name)
            } else {
                analysis.palette
            },
            tags: tags.clone(),
            suggestions: merge_unique(
                eagle_suggestions(metadata.as_ref())
                    .into_iter()
                    .chain(suggestions_from_file(file_name, &tags))
                    .chain(analysis.suggestions)
                    .collect(),
            )
            .into_iter()
            .take(8)
            .collect(),
            x: (84.0 - column as f64 * 9.0).max(62.0),
            y: 18.0 + (slot % 5) as f64 * 14.0,
            thumb: thumbnail_data_url(&bytes)?,
            fingerprint: format!("file:{}", path.to_string_lossy().to_ascii_lowercase()),
            perceptual_hash: analysis.perceptual_hash,
        });
    }

    Ok(imported)
}

fn import_eagle_web_items_with_limit(limit: u32) -> Result<Vec<ImportedReferenceRecord>, String> {
    let safe_limit = limit.clamp(1, 1000);
    let response = eagle_web_api_get_json(&format!("/api/v2/item/get?limit={safe_limit}"))?;
    eagle_web_items_from_response(&response, timestamp_millis())
}

fn eagle_web_api_get_json(path: &str) -> Result<serde_json::Value, String> {
    let mut stream = TcpStream::connect(EAGLE_WEB_API_ADDR)
        .map_err(|error| format!("Unable to connect to Eagle Web API: {error}"))?;
    let request = format!(
        "GET {path} HTTP/1.1\r\nHost: {EAGLE_WEB_API_ADDR}\r\nAccept: application/json\r\nConnection: close\r\n\r\n"
    );
    stream
        .write_all(request.as_bytes())
        .map_err(|error| error.to_string())?;

    let mut response = String::new();
    stream
        .read_to_string(&mut response)
        .map_err(|error| error.to_string())?;
    let (head, body) = response
        .split_once("\r\n\r\n")
        .ok_or_else(|| "Invalid Eagle Web API response".to_string())?;
    let status_line = head.lines().next().unwrap_or_default();
    if !status_line.contains(" 200 ") {
        return Err(format!("Eagle Web API returned {status_line}"));
    }

    serde_json::from_str(body).map_err(|error| error.to_string())
}

fn eagle_web_items_from_response(
    response: &serde_json::Value,
    import_id: u128,
) -> Result<Vec<ImportedReferenceRecord>, String> {
    if response.get("status").and_then(serde_json::Value::as_str) == Some("error") {
        return Err(response
            .get("message")
            .and_then(serde_json::Value::as_str)
            .unwrap_or("Eagle Web API returned an error")
            .to_string());
    }

    let items = response
        .get("data")
        .and_then(|data| data.get("data").or(Some(data)))
        .and_then(serde_json::Value::as_array)
        .ok_or_else(|| "Eagle Web API response did not include items".to_string())?;

    Ok(items
        .iter()
        .enumerate()
        .map(|(index, item)| eagle_web_item_to_reference(item, import_id, index))
        .collect())
}

fn eagle_web_item_to_reference(
    item: &serde_json::Value,
    import_id: u128,
    index: usize,
) -> ImportedReferenceRecord {
    let item_id = json_string(item, &["id", "itemId", "uuid"])
        .unwrap_or_else(|| format!("eagle-web-{import_id}-{index}"));
    let source_path = json_string(item, &["filePath", "fileURL", "path"]);
    let file_name = source_path
        .as_deref()
        .and_then(|path| Path::new(path).file_name())
        .and_then(OsStr::to_str)
        .unwrap_or("eagle reference");
    let title = json_string(item, &["name", "title"])
        .map(|name| normalize_words(&name).to_lowercase())
        .filter(|name| !name.is_empty())
        .unwrap_or_else(|| title_from_filename(file_name));
    let source = json_string(item, &["url", "website", "sourceUrl"])
        .or_else(|| source_path.clone())
        .unwrap_or_else(|| item_id.clone());
    let eagle_tags = json_string_array(item, "tags");
    let annotation = json_string(item, &["annotation", "note", "description"]);
    let local_bytes = source_path
        .as_deref()
        .and_then(|path| fs::read(path).ok())
        .or_else(|| {
            json_string(item, &["thumbnailPath", "thumbPath", "previewPath"])
                .and_then(|path| fs::read(path).ok())
        });
    let analysis = local_bytes
        .as_deref()
        .and_then(|bytes| analyze_image_bytes(bytes).ok());
    let tags = merge_unique(
        eagle_tags
            .clone()
            .into_iter()
            .chain(analysis.as_ref().map(|analysis| analysis.tags.clone()).unwrap_or_default())
            .collect(),
    );
    let suggestions = merge_unique(
        vec!["eagle web api".to_string()]
            .into_iter()
            .chain(eagle_tags)
            .chain(
                annotation
                    .as_deref()
                    .map(keyword_suggestions_from_text)
                    .unwrap_or_default(),
            )
            .collect(),
    )
    .into_iter()
    .take(8)
    .collect();
    let column = index / 5;

    ImportedReferenceRecord {
        id: format!("img-eagle-web-{import_id}-{index}"),
        title,
        source,
        origin_app: Some("eagle".to_string()),
        origin_id: Some(item_id.clone()),
        source_path,
        palette: analysis
            .as_ref()
            .map(|analysis| analysis.palette.clone())
            .filter(|palette| !palette.is_empty())
            .or_else(|| palette_from_eagle_item(item))
            .unwrap_or_else(|| palette_from_name(&item_id)),
        tags,
        suggestions,
        x: (84.0 - column as f64 * 9.0).max(62.0),
        y: 18.0 + (index % 5) as f64 * 14.0,
        thumb: local_bytes
            .as_deref()
            .and_then(|bytes| thumbnail_data_url(bytes).ok())
            .unwrap_or_default(),
        fingerprint: format!("eagle:{item_id}"),
        perceptual_hash: analysis
            .map(|analysis| analysis.perceptual_hash)
            .unwrap_or_default(),
    }
}

fn palette_from_eagle_item(item: &serde_json::Value) -> Option<Vec<String>> {
    let palette = item.get("palettes").or_else(|| item.get("palette"))?.as_array()?;
    let colors = palette
        .iter()
        .filter_map(|entry| {
            if let Some(color) = entry.as_str() {
                return Some(color.to_string());
            }
            let color = entry.get("color")?.as_array()?;
            let red = color.first()?.as_u64()? as u8;
            let green = color.get(1)?.as_u64()? as u8;
            let blue = color.get(2)?.as_u64()? as u8;
            Some(rgb_to_hex(red, green, blue))
        })
        .take(3)
        .collect::<Vec<_>>();
    if colors.is_empty() {
        None
    } else {
        Some(colors)
    }
}

fn collect_supported_image_paths(folder: &Path) -> Result<Vec<PathBuf>, String> {
    fn collect(folder: &Path, depth: usize, output: &mut Vec<PathBuf>) -> Result<(), String> {
        if depth > 3 {
            return Ok(());
        }

        for entry in fs::read_dir(folder).map_err(|error| error.to_string())? {
            let path = entry.map_err(|error| error.to_string())?.path();
            if path.is_dir() {
                collect(&path, depth + 1, output)?;
                continue;
            }
            if path.is_file() && is_supported_image_path(&path) {
                output.push(path);
            }
        }
        Ok(())
    }

    let mut output = Vec::new();
    collect(folder, 0, &mut output)?;
    Ok(output)
}

fn eagle_metadata_for_image(image_path: &Path) -> Option<EagleItemMetadata> {
    let parent = image_path.parent()?;
    let stem = image_path.file_stem().and_then(OsStr::to_str);
    let candidates = [
        parent.join("metadata.json"),
        parent.join("item.json"),
        stem.map(|stem| parent.join(format!("{stem}.json")))
            .unwrap_or_else(|| parent.join("")),
    ];

    candidates
        .iter()
        .filter(|path| path.exists())
        .filter_map(|path| parse_eagle_metadata_file(path).ok())
        .next()
}

fn parse_eagle_metadata_file(path: &Path) -> Result<EagleItemMetadata, String> {
    let raw = fs::read_to_string(path).map_err(|error| error.to_string())?;
    let value: serde_json::Value = serde_json::from_str(&raw).map_err(|error| error.to_string())?;
    let item = value.get("item").unwrap_or(&value);

    Ok(EagleItemMetadata {
        id: json_string(item, &["id", "itemId", "uuid"]),
        name: json_string(item, &["name", "title"]),
        url: json_string(item, &["url", "website", "sourceUrl"]),
        annotation: json_string(item, &["annotation", "note", "description"]),
        tags: json_string_array(item, "tags"),
        source_path: json_string(item, &["filePath", "fileURL", "path"]),
    })
}

fn json_string(value: &serde_json::Value, keys: &[&str]) -> Option<String> {
    keys.iter()
        .filter_map(|key| value.get(*key))
        .find_map(|candidate| candidate.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
}

fn json_string_array(value: &serde_json::Value, key: &str) -> Vec<String> {
    value
        .get(key)
        .and_then(|tags| tags.as_array())
        .map(|tags| {
            tags.iter()
                .filter_map(|tag| tag.as_str())
                .map(normalize_words)
                .map(|tag| tag.to_lowercase())
                .filter(|tag| !tag.is_empty())
                .collect()
        })
        .unwrap_or_default()
}

fn title_from_import(file_name: &str, metadata: Option<&EagleItemMetadata>) -> String {
    metadata
        .and_then(|metadata| metadata.name.clone())
        .map(|name| normalize_words(&name).to_lowercase())
        .filter(|name| !name.is_empty())
        .unwrap_or_else(|| title_from_filename(file_name))
}

fn source_from_import(path: &Path, metadata: Option<&EagleItemMetadata>) -> String {
    metadata
        .and_then(|metadata| metadata.url.clone())
        .filter(|url| !url.is_empty())
        .or_else(|| metadata.and_then(|metadata| metadata.source_path.clone()))
        .unwrap_or_else(|| path.to_string_lossy().to_string())
}

fn eagle_suggestions(metadata: Option<&EagleItemMetadata>) -> Vec<String> {
    let Some(metadata) = metadata else {
        return Vec::new();
    };

    merge_unique(
        vec!["eagle import".to_string()]
            .into_iter()
            .chain(metadata.tags.clone())
            .chain(
                metadata
                    .annotation
                    .as_deref()
                    .map(keyword_suggestions_from_text)
                    .unwrap_or_default(),
            )
            .collect(),
    )
}

fn capture_screen_reference_to_temp() -> Result<Option<ImportedReferenceRecord>, String> {
    let path = std::env::temp_dir().join(format!("vixio-screen-{}.png", timestamp_millis()));
    let status = Command::new("/usr/sbin/screencapture")
        .arg("-i")
        .arg(&path)
        .status()
        .map_err(|error| format!("Unable to start screen capture: {error}"))?;

    if !path.exists()
        || fs::metadata(&path)
            .map(|metadata| metadata.len())
            .unwrap_or(0)
            == 0
    {
        return Ok(None);
    }

    if !status.success() {
        let _ = fs::remove_file(&path);
        return Err("Screen capture failed".to_string());
    }

    let bytes = fs::read(&path).map_err(|error| error.to_string())?;
    let reference = screenshot_reference_from_bytes(&bytes, timestamp_millis(), 0)?;
    let _ = fs::remove_file(path);
    Ok(Some(reference))
}

fn screenshot_reference_from_bytes(
    bytes: &[u8],
    capture_id: u128,
    index: usize,
) -> Result<ImportedReferenceRecord, String> {
    let analysis = analyze_image_bytes(bytes)?;
    let name = format!("screen capture {capture_id}");
    Ok(ImportedReferenceRecord {
        id: format!("img-screen-{capture_id}-{index}"),
        title: name.clone(),
        source: "Screen Capture".to_string(),
        origin_app: None,
        origin_id: None,
        source_path: None,
        palette: if analysis.palette.is_empty() {
            palette_from_name(&name)
        } else {
            analysis.palette
        },
        tags: merge_unique(
            vec!["screenshot".to_string(), "screen".to_string()]
                .into_iter()
                .chain(analysis.tags)
                .collect(),
        ),
        suggestions: merge_unique(
            vec!["screen capture".to_string(), "png file".to_string()]
                .into_iter()
                .chain(analysis.suggestions)
                .collect(),
        )
        .into_iter()
        .take(5)
        .collect(),
        x: 78.0,
        y: 22.0,
        thumb: format!("data:image/png;base64,{}", BASE64.encode(bytes)),
        fingerprint: format!("screen:{:016x}", fnv1a64(bytes)),
        perceptual_hash: analysis.perceptual_hash,
    })
}

fn run_apple_vision_ocr_for_data_url(image_data_url: &str) -> Result<Option<OcrResult>, String> {
    let Some(data_url) = parse_data_url(image_data_url)? else {
        return Ok(None);
    };
    let extension = extension_for_mime(data_url.mime);
    let id = timestamp_millis();
    let image_path = std::env::temp_dir().join(format!("vixio-ocr-{id}.{extension}"));

    fs::write(&image_path, data_url.bytes).map_err(|error| error.to_string())?;
    let output = run_apple_vision_ocr_process(&image_path)
        .map_err(|error| format!("Unable to run Apple Vision OCR: {error}"));

    let _ = fs::remove_file(&image_path);
    let output = output?;
    let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if text.is_empty() {
        return Ok(None);
    }
    let suggestions = natural_language_suggestions_from_text(&text)
        .filter(|suggestions| !suggestions.is_empty())
        .unwrap_or_else(|| keyword_suggestions_from_text(&text));

    Ok(Some(OcrResult { suggestions, text }))
}

fn run_apple_vision_ocr_process(image_path: &Path) -> Result<Output, String> {
    let helper_path = bundled_sidecar_path("vixio-vision-ocr-helper").or_else(|| {
        option_env!("VIXIO_VISION_OCR_HELPER")
            .filter(|path| !path.is_empty())
            .map(PathBuf::from)
    });

    run_apple_vision_ocr_process_with_helper(image_path, helper_path.as_deref())
}

fn bundled_sidecar_path(binary_name: &str) -> Option<PathBuf> {
    let executable_dir = std::env::current_exe().ok()?.parent()?.to_path_buf();
    bundled_sidecar_path_in_dir(&executable_dir, binary_name)
}

fn bundled_sidecar_path_in_dir(executable_dir: &Path, binary_name: &str) -> Option<PathBuf> {
    let exact = executable_dir.join(binary_name);
    if exact.exists() {
        return Some(exact);
    }

    fs::read_dir(executable_dir)
        .ok()?
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .find(|path| {
            path.file_name()
                .and_then(OsStr::to_str)
                .is_some_and(|name| name.starts_with(binary_name))
        })
}

fn run_apple_vision_ocr_process_with_helper(
    image_path: &Path,
    helper_path: Option<&Path>,
) -> Result<Output, String> {
    if let Some(helper_path) = helper_path {
        if helper_path.exists() {
            let output = Command::new(helper_path)
                .arg(image_path)
                .output()
                .map_err(|error| format!("Unable to run OCR helper: {error}"))?;
            if output.status.success() {
                return Ok(output);
            }
        }
    }

    let script_path = std::env::temp_dir().join(format!("vixio-ocr-{}.swift", timestamp_millis()));
    run_swift_script(&script_path, APPLE_VISION_OCR_SWIFT, &[image_path])
}

fn natural_language_suggestions_from_text(text: &str) -> Option<Vec<String>> {
    let text = text.trim();
    if text.is_empty() {
        return None;
    }

    let id = timestamp_millis();
    let text_path = std::env::temp_dir().join(format!("vixio-natural-language-{id}.txt"));
    fs::write(&text_path, text).ok()?;
    let output = run_natural_language_process(&text_path).ok();
    let _ = fs::remove_file(&text_path);

    output.and_then(|output| {
        let stdout = String::from_utf8_lossy(&output.stdout);
        let suggestions = merge_unique(
            stdout
                .lines()
                .map(ToString::to_string)
                .collect::<Vec<String>>(),
        )
        .into_iter()
        .take(6)
        .collect::<Vec<_>>();
        (!suggestions.is_empty()).then_some(suggestions)
    })
}

fn run_natural_language_process(text_path: &Path) -> Result<Output, String> {
    let helper_path = bundled_sidecar_path("vixio-natural-language-helper").or_else(|| {
        option_env!("VIXIO_NATURAL_LANGUAGE_HELPER")
            .filter(|path| !path.is_empty())
            .map(PathBuf::from)
    });

    run_natural_language_process_with_helper(text_path, helper_path.as_deref())
}

fn run_natural_language_process_with_helper(
    text_path: &Path,
    helper_path: Option<&Path>,
) -> Result<Output, String> {
    if let Some(helper_path) = helper_path {
        if helper_path.exists() {
            let output = Command::new(helper_path)
                .arg(text_path)
                .output()
                .map_err(|error| format!("Unable to run Natural Language helper: {error}"))?;
            if output.status.success() {
                return Ok(output);
            }
        }
    }

    Err("Natural Language helper unavailable".to_string())
}

fn check_foundation_model_availability_native() -> Result<LocalModelAvailability, String> {
    let output = run_foundation_models_process("availability", None);

    match output {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
            let mut parts = stdout.splitn(3, '\t');
            let status = parts.next().unwrap_or("unavailable").to_string();
            let reason = parts
                .next()
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty());
            Ok(LocalModelAvailability {
                available: status == "available",
                status,
                reason,
            })
        }
        Err(error) => Ok(LocalModelAvailability {
            available: false,
            status: "unavailable".to_string(),
            reason: Some(error),
        }),
    }
}

fn normalize_tags_with_foundation_model_native(
    text_context: &str,
) -> Result<LocalModelTagResult, String> {
    let text_context = text_context.trim();
    if text_context.is_empty() {
        return Ok(LocalModelTagResult {
            available: false,
            status: "empty-context".to_string(),
            raw: String::new(),
            suggestions: Vec::new(),
        });
    }

    let id = timestamp_millis();
    let context_path = std::env::temp_dir().join(format!("vixio-foundation-tags-{id}.txt"));
    fs::write(&context_path, text_context).map_err(|error| error.to_string())?;

    let output = run_foundation_models_process("tags", Some(context_path.as_path()));
    let _ = fs::remove_file(&context_path);

    match output {
        Ok(output) => {
            let raw = String::from_utf8_lossy(&output.stdout).trim().to_string();
            Ok(LocalModelTagResult {
                available: true,
                status: "available".to_string(),
                suggestions: tag_suggestions_from_model_output(&raw),
                raw,
            })
        }
        Err(_) => Ok(LocalModelTagResult {
            available: false,
            status: "unavailable".to_string(),
            raw: String::new(),
            suggestions: Vec::new(),
        }),
    }
}

fn run_foundation_models_process(
    mode: &str,
    context_path: Option<&Path>,
) -> Result<Output, String> {
    let helper_path = bundled_sidecar_path("vixio-foundation-models-helper").or_else(|| {
        option_env!("VIXIO_FOUNDATION_MODELS_HELPER")
            .filter(|path| !path.is_empty())
            .map(PathBuf::from)
    });

    run_foundation_models_process_with_helper(mode, context_path, helper_path.as_deref())
}

fn run_foundation_models_process_with_helper(
    mode: &str,
    context_path: Option<&Path>,
    helper_path: Option<&Path>,
) -> Result<Output, String> {
    if let Some(helper_path) = helper_path {
        if helper_path.exists() {
            let mut command = Command::new(helper_path);
            command.arg(mode);
            if let Some(context_path) = context_path {
                command.arg(context_path);
            }
            let output = command
                .output()
                .map_err(|error| format!("Unable to run Foundation Models helper: {error}"))?;
            if output.status.success() {
                return Ok(output);
            }
        }
    }

    let id = timestamp_millis();
    match mode {
        "availability" => {
            let script_path =
                std::env::temp_dir().join(format!("vixio-foundation-check-{id}.swift"));
            run_swift_script(&script_path, FOUNDATION_MODEL_AVAILABILITY_SWIFT, &[])
        }
        "tags" => {
            let Some(context_path) = context_path else {
                return Err("Missing Foundation Models context path".to_string());
            };
            let script_path =
                std::env::temp_dir().join(format!("vixio-foundation-tags-{id}.swift"));
            run_swift_script(
                &script_path,
                FOUNDATION_MODEL_TAG_NORMALIZE_SWIFT,
                &[context_path],
            )
        }
        _ => Err(format!("Unknown Foundation Models helper mode: {mode}")),
    }
}

fn run_swift_script(script_path: &Path, source: &str, args: &[&Path]) -> Result<Output, String> {
    fs::write(script_path, source).map_err(|error| error.to_string())?;

    let mut command = Command::new("/usr/bin/swift");
    command.arg(script_path);
    for arg in args {
        command.arg(arg);
    }

    let output = command
        .output()
        .map_err(|error| format!("Unable to run Swift: {error}"));
    let _ = fs::remove_file(script_path);

    let output = output?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    Ok(output)
}

const APPLE_VISION_OCR_SWIFT: &str = r#"
import AppKit
import Foundation
import Vision

let path = CommandLine.arguments[1]
let url = URL(fileURLWithPath: path)
guard let image = NSImage(contentsOf: url),
      let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
  exit(2)
}

let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.usesLanguageCorrection = true

let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
try handler.perform([request])

let text = (request.results ?? [])
  .compactMap { $0.topCandidates(1).first?.string }
  .joined(separator: "\n")
print(text)
"#;

const FOUNDATION_MODEL_AVAILABILITY_SWIFT: &str = r#"
import Foundation
import FoundationModels

if #available(macOS 26.0, *) {
  let model = SystemLanguageModel.default
  switch model.availability {
  case .available:
    print("available")
  case .unavailable(let reason):
    print("unavailable\t\(reason)")
  @unknown default:
    print("unavailable\tunknown")
  }
} else {
  print("unavailable\tmacos-version")
}
"#;

const FOUNDATION_MODEL_TAG_NORMALIZE_SWIFT: &str = r#"
import Foundation
import FoundationModels

let contextPath = CommandLine.arguments[1]
let context = try String(contentsOfFile: contextPath, encoding: .utf8)

if #available(macOS 26.0, *) {
  let model = SystemLanguageModel.default
  switch model.availability {
  case .available:
    let instructions = """
    You normalize visual research metadata into concise interface tags.
    Return only 3 to 6 lowercase tag phrases separated by commas.
    Do not add explanations, numbering, markdown, or quotation marks.
    """
    let session = LanguageModelSession(instructions: instructions)
    let prompt = """
    Normalize these existing image reference fields into concise tags.
    Prefer concrete visual, material, mood, and concept terms.

    \(context)
    """
    let response = try await session.respond(to: prompt)
    print(response.content)
  case .unavailable(let reason):
    fputs("unavailable: \(reason)\n", stderr)
    exit(3)
  @unknown default:
    fputs("unavailable: unknown\n", stderr)
    exit(3)
  }
} else {
  fputs("unavailable: macos-version\n", stderr)
  exit(3)
}
"#;

fn is_supported_image_path(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(OsStr::to_str)
            .map(|extension| extension.to_ascii_lowercase()),
        Some(extension)
            if matches!(extension.as_str(), "jpg" | "jpeg" | "png" | "webp")
    )
}

fn title_from_filename(name: &str) -> String {
    let stem = Path::new(name)
        .file_stem()
        .and_then(OsStr::to_str)
        .unwrap_or(name);
    normalize_words(stem).to_lowercase()
}

fn tags_from_filename(name: &str) -> Vec<String> {
    let stop_words = [
        "img",
        "image",
        "photo",
        "screen",
        "screenshot",
        "copy",
        "final",
    ];
    let mut tags = Vec::new();
    for token in title_from_filename(name).split_whitespace() {
        if token.len() <= 2 || stop_words.contains(&token) || tags.iter().any(|tag| tag == token) {
            continue;
        }
        tags.push(token.to_string());
        if tags.len() == 4 {
            break;
        }
    }
    tags
}

fn suggestions_from_file(name: &str, tags: &[String]) -> Vec<String> {
    let mut suggestions = vec!["folder import".to_string()];
    if let Some(extension) = Path::new(name).extension().and_then(OsStr::to_str) {
        suggestions.push(format!("{} file", extension.to_ascii_lowercase()));
    } else {
        suggestions.push("image file".to_string());
    }
    suggestions.extend(tags.iter().take(2).cloned());
    suggestions.sort();
    suggestions.dedup();
    suggestions.truncate(4);
    suggestions
}

fn palette_from_name(name: &str) -> Vec<String> {
    let hash = name
        .chars()
        .fold(0u32, |value, character| value + character as u32);
    vec![
        color_from_hash(hash + 37),
        color_from_hash(hash + 89),
        color_from_hash(hash + 151),
    ]
}

fn color_from_hash(seed: u32) -> String {
    format!("hsl({} 22% 48%)", seed % 360)
}

struct ImageAnalysis {
    palette: Vec<String>,
    tags: Vec<String>,
    suggestions: Vec<String>,
    perceptual_hash: String,
}

fn analyze_image_bytes(bytes: &[u8]) -> Result<ImageAnalysis, String> {
    let image = image::load_from_memory(bytes).map_err(|error| error.to_string())?;
    let (width, height) = image.dimensions();
    let sample = image.thumbnail(32, 32).to_rgba8();
    let mut red_sum = 0u64;
    let mut green_sum = 0u64;
    let mut blue_sum = 0u64;
    let mut count = 0u64;
    let mut buckets = std::collections::BTreeMap::<String, (u64, u64, u64, u64)>::new();

    for pixel in sample.pixels() {
        let [red, green, blue, alpha] = pixel.0;
        if alpha < 20 {
            continue;
        }
        red_sum += u64::from(red);
        green_sum += u64::from(green);
        blue_sum += u64::from(blue);
        count += 1;

        let key = format!("{}:{}:{}", red / 48, green / 48, blue / 48);
        let bucket = buckets.entry(key).or_insert((0, 0, 0, 0));
        bucket.0 += u64::from(red);
        bucket.1 += u64::from(green);
        bucket.2 += u64::from(blue);
        bucket.3 += 1;
    }

    if count == 0 {
        return Ok(ImageAnalysis {
            palette: Vec::new(),
            tags: orientation_tags(width, height),
            suggestions: vec![format!("{width}x{height}")],
            perceptual_hash: String::new(),
        });
    }

    let average_red = (red_sum / count) as u8;
    let average_green = (green_sum / count) as u8;
    let average_blue = (blue_sum / count) as u8;
    let brightness = (u32::from(average_red) * 299
        + u32::from(average_green) * 587
        + u32::from(average_blue) * 114)
        / 1000;
    let mut palette_buckets = buckets.into_values().collect::<Vec<_>>();
    palette_buckets.sort_by(|a, b| b.3.cmp(&a.3));
    let palette = palette_buckets
        .into_iter()
        .take(3)
        .map(|(red, green, blue, bucket_count)| {
            rgb_to_hex(
                (red / bucket_count) as u8,
                (green / bucket_count) as u8,
                (blue / bucket_count) as u8,
            )
        })
        .collect::<Vec<_>>();

    let mut tags = orientation_tags(width, height);
    tags.push(if brightness < 88 {
        "dark".to_string()
    } else if brightness > 178 {
        "bright".to_string()
    } else {
        "balanced light".to_string()
    });
    tags.push(color_family_tag(average_red, average_green, average_blue));

    Ok(ImageAnalysis {
        palette,
        tags: merge_unique(tags),
        suggestions: vec![
            format!("{width}x{height}"),
            if brightness < 88 {
                "low key".to_string()
            } else if brightness > 178 {
                "high key".to_string()
            } else {
                "mid tone".to_string()
            },
        ],
        perceptual_hash: average_hash(&sample),
    })
}

fn average_hash(sample: &image::RgbaImage) -> String {
    let mut values = Vec::new();
    for pixel in sample.pixels().take(64) {
        let [red, green, blue, alpha] = pixel.0;
        let luma = if alpha < 20 {
            0u32
        } else {
            u32::from(red) * 299 + u32::from(green) * 587 + u32::from(blue) * 114
        };
        values.push(luma / 1000);
    }
    if values.is_empty() {
        return String::new();
    }
    while values.len() < 64 {
        values.push(0);
    }
    let average = values.iter().sum::<u32>() / values.len() as u32;
    let mut bits = 0u64;
    for value in values.into_iter().take(64) {
        bits <<= 1;
        if value >= average {
            bits |= 1;
        }
    }
    format!("ahash:{bits:016x}")
}

fn orientation_tags(width: u32, height: u32) -> Vec<String> {
    if width * 100 > height * 122 {
        vec!["landscape".to_string()]
    } else if width * 100 < height * 82 {
        vec!["portrait".to_string()]
    } else {
        vec!["square".to_string()]
    }
}

fn color_family_tag(red: u8, green: u8, blue: u8) -> String {
    let max = red.max(green).max(blue);
    let min = red.min(green).min(blue);
    if max - min < 24 {
        return "neutral".to_string();
    }
    if red >= green && red >= blue {
        return if green > blue { "warm" } else { "magenta" }.to_string();
    }
    if green >= red && green >= blue {
        return if blue > red { "cool green" } else { "green" }.to_string();
    }
    if red > green {
        "violet".to_string()
    } else {
        "cool".to_string()
    }
}

fn rgb_to_hex(red: u8, green: u8, blue: u8) -> String {
    format!("#{red:02x}{green:02x}{blue:02x}")
}

fn merge_unique(values: Vec<String>) -> Vec<String> {
    let mut merged = Vec::new();
    for value in values {
        let normalized = normalize_words(&value).to_lowercase();
        if normalized.is_empty() || merged.iter().any(|existing| existing == &normalized) {
            continue;
        }
        merged.push(normalized);
    }
    merged
}

fn keyword_suggestions_from_text(text: &str) -> Vec<String> {
    let stop_words = [
        "the", "and", "for", "with", "from", "this", "that", "are", "was", "were", "not", "you",
        "your", "have", "has", "had", "can", "will", "into", "onto", "over", "under", "screen",
        "image", "photo", "copy", "final",
    ];
    let mut candidates = Vec::new();
    for token in text
        .split(|character: char| !character.is_alphanumeric())
        .map(|token| token.trim().to_lowercase())
    {
        if token.len() < 3 || stop_words.contains(&token.as_str()) {
            continue;
        }
        candidates.push(token);
    }
    merge_unique(candidates).into_iter().take(6).collect()
}

fn tag_suggestions_from_model_output(text: &str) -> Vec<String> {
    let candidates = text
        .split(|character: char| character == ',' || character == '\n' || character == ';')
        .map(|value| {
            value
                .trim()
                .trim_matches(|character: char| {
                    character == '"'
                        || character == '\''
                        || character == '-'
                        || character == '*'
                        || character.is_ascii_digit()
                        || character == '.'
                })
                .trim()
                .to_string()
        })
        .filter(|value| value.len() >= 3)
        .collect();
    merge_unique(candidates).into_iter().take(6).collect()
}

fn normalize_words(value: &str) -> String {
    value
        .chars()
        .map(|character| {
            if character == '-' || character == '_' {
                ' '
            } else {
                character
            }
        })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn timestamp_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default()
}

fn fnv1a64(bytes: &[u8]) -> u64 {
    let mut hash = 0xcbf29ce484222325u64;
    for byte in bytes {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}

fn read_thumb_for_frontend(
    thumb_path: Option<String>,
    fallback: String,
) -> rusqlite::Result<String> {
    let Some(path) = thumb_path else {
        return Ok(fallback);
    };
    let Ok(bytes) = fs::read(path) else {
        return Ok(fallback);
    };
    Ok(format!("data:image/png;base64,{}", BASE64.encode(bytes)))
}

fn start_capture_server(app: AppHandle) {
    thread::spawn(move || {
        let Ok(listener) = TcpListener::bind(CAPTURE_SERVER_ADDR) else {
            return;
        };

        for stream in listener.incoming().flatten() {
            let app = app.clone();
            thread::spawn(move || {
                let _ = handle_capture_stream(stream, &app);
            });
        }
    });
}

fn handle_capture_stream(mut stream: TcpStream, app: &AppHandle) -> Result<(), String> {
    let mut buffer = [0_u8; 65536];
    let size = stream
        .read(&mut buffer)
        .map_err(|error| error.to_string())?;
    let request = String::from_utf8_lossy(&buffer[..size]);
    let response = match parse_capture_http_request(&request) {
        CaptureHttpRequest::Options => http_response(204, "No Content", ""),
        CaptureHttpRequest::Post(payload) => {
            app.emit(CAPTURE_EVENT, payload)
                .map_err(|error| error.to_string())?;
            http_response(200, "OK", "{\"ok\":true}")
        }
        CaptureHttpRequest::Invalid => http_response(404, "Not Found", "{\"ok\":false}"),
    };

    stream
        .write_all(response.as_bytes())
        .map_err(|error| error.to_string())
}

enum CaptureHttpRequest {
    Options,
    Post(String),
    Invalid,
}

fn parse_capture_http_request(request: &str) -> CaptureHttpRequest {
    let mut parts = request.splitn(2, "\r\n\r\n");
    let headers = parts.next().unwrap_or_default();
    let body = parts.next().unwrap_or_default().trim();

    if headers.starts_with("OPTIONS /capture ") {
        return CaptureHttpRequest::Options;
    }
    if !headers.starts_with("POST /capture ") || body.is_empty() {
        return CaptureHttpRequest::Invalid;
    }

    CaptureHttpRequest::Post(body.to_string())
}

fn http_response(status: u16, reason: &str, body: &str) -> String {
    format!(
        "HTTP/1.1 {status} {reason}\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{body}",
        body.len()
    )
}

fn project_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join(PROJECT_DIR_NAME))
        .map_err(|error| error.to_string())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            start_capture_server(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            save_project_package,
            open_project_package,
            open_project_package_at,
            import_reference_folder,
            import_eagle_web_items,
            capture_screen_reference,
            run_apple_vision_ocr,
            check_foundation_model_availability,
            normalize_tags_with_foundation_model,
            export_outline_markdown,
            export_outline_html,
            export_contact_sheet_html,
            export_slideshow_html
        ])
        .run(tauri::generate_context!())
        .expect("error while running Vixio desktop shell");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sqlite_snapshot_roundtrip_preserves_graph_data_and_assets() {
        let mut conn = Connection::open_in_memory().expect("open sqlite memory db");
        let project_dir = std::env::temp_dir().join(format!(
            "vixio-test-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .expect("system time")
                .as_nanos()
        ));
        ensure_project_dirs(&project_dir).expect("create project dirs");
        migrate(&conn).expect("migrate db");
        let mut png = Cursor::new(Vec::new());
        image::RgbaImage::from_pixel(1, 1, image::Rgba([255, 255, 255, 255]))
            .write_to(&mut png, ImageFormat::Png)
            .expect("write png fixture");
        let thumb = format!("data:image/png;base64,{}", BASE64.encode(png.into_inner()));
        let snapshot = ProjectSnapshot {
            version: 1,
            ideas: vec![IdeaRecord {
                id: "idea-a".to_string(),
                title: "Idea A".to_string(),
                body: "Body".to_string(),
                status: "forming".to_string(),
                x: 12.0,
                y: 34.0,
            }],
            images: vec![ReferenceRecord {
                id: "img-a".to_string(),
                title: "Reference A".to_string(),
                source: "reference-a.png".to_string(),
                origin_app: Some("eagle".to_string()),
                origin_id: Some("eagle-item-a".to_string()),
                source_path: Some("/library/reference-a.png".to_string()),
                palette: vec!["#111111".to_string(), "#222222".to_string()],
                tags: vec!["archive".to_string(), "ritual".to_string()],
                suggestions: vec![TagSuggestionRecord::Detailed {
                    label: "local import".to_string(),
                    source: Some("local".to_string()),
                    confidence: Some(0.52),
                    status: Some("pending".to_string()),
                }],
                x: 56.0,
                y: 78.0,
                thumb,
                fingerprint: "sha256:test-fixture".to_string(),
                perceptual_hash: "ahash:test-fixture".to_string(),
            }],
            links: vec![LinkRecord {
                id: "link-a".to_string(),
                image_id: "img-a".to_string(),
                idea_id: "idea-a".to_string(),
                relation: "supports".to_string(),
                note: "Traceable note".to_string(),
                confidence: 0.72,
            }],
            outline_drafts: vec![OutlineDraftRecord {
                id: "outline-a".to_string(),
                title: "Outline".to_string(),
                created_at: "2026-06-02T00:00:00.000Z".to_string(),
                sections: vec![OutlineDraftSectionRecord {
                    id: "outline-section-a".to_string(),
                    idea_id: "idea-a".to_string(),
                    title: "Idea A".to_string(),
                    summary: "Body Current references indicate: supports.".to_string(),
                    reference_ids: vec!["img-a".to_string()],
                    strength: "forming".to_string(),
                }],
            }],
        };

        write_snapshot(&mut conn, &snapshot, &project_dir).expect("write snapshot");
        let restored = read_snapshot(&conn).expect("read snapshot");

        assert_eq!(restored.version, 1);
        assert_eq!(restored.ideas[0].title, "Idea A");
        assert!(project_dir.join("images/img-a.png").exists());
        assert!(project_dir.join("thumbs/img-a.png").exists());
        assert!(restored.images[0]
            .thumb
            .starts_with("data:image/png;base64,"));
        assert_eq!(restored.images[0].tags, vec!["archive", "ritual"]);
        assert_eq!(restored.images[0].suggestions[0].label(), "local import");
        assert_eq!(restored.images[0].suggestions[0].source(), "local");
        assert_eq!(restored.images[0].suggestions[0].confidence(), 0.52);
        assert_eq!(restored.images[0].suggestions[0].status(), "pending");
        assert_eq!(restored.images[0].origin_app.as_deref(), Some("eagle"));
        assert_eq!(
            restored.images[0].origin_id.as_deref(),
            Some("eagle-item-a")
        );
        assert_eq!(
            restored.images[0].source_path.as_deref(),
            Some("/library/reference-a.png")
        );
        assert_eq!(restored.images[0].fingerprint, "sha256:test-fixture");
        assert_eq!(restored.images[0].perceptual_hash, "ahash:test-fixture");
        assert_eq!(restored.links[0].image_id, "img-a");
        assert_eq!(restored.links[0].idea_id, "idea-a");
        assert_eq!(restored.outline_drafts[0].id, "outline-a");
        assert_eq!(restored.outline_drafts[0].sections[0].idea_id, "idea-a");
        assert_eq!(
            restored.outline_drafts[0].sections[0].reference_ids,
            vec!["img-a"]
        );
        let migration_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM schema_migrations", [], |row| {
                row.get(0)
            })
            .expect("count migrations");
        assert_eq!(migration_count, 7);

        fs::remove_dir_all(project_dir).expect("remove temp project");
    }

    #[test]
    fn outline_exports_write_exports_files() {
        let project_dir =
            std::env::temp_dir().join(format!("vixio-outline-export-test-{}", timestamp_millis()));
        let markdown_path = export_text_to_exports(&project_dir, "outline.md", "# Outline\n")
            .expect("export outline markdown");
        let html_path = export_text_to_exports(&project_dir, "outline.html", "<h1>Outline</h1>\n")
            .expect("export outline html");
        let contact_sheet_path =
            export_text_to_exports(&project_dir, "contact-sheet.html", "<h1>References</h1>\n")
                .expect("export contact sheet html");
        let slides_path = export_text_to_exports(&project_dir, "slides.html", "<h1>Slides</h1>\n")
            .expect("export slides html");
        assert!(markdown_path.ends_with("exports/outline.md"));
        assert!(html_path.ends_with("exports/outline.html"));
        assert!(contact_sheet_path.ends_with("exports/contact-sheet.html"));
        assert!(slides_path.ends_with("exports/slides.html"));
        assert_eq!(
            fs::read_to_string(project_dir.join("exports/outline.md")).expect("read export"),
            "# Outline\n"
        );
        assert_eq!(
            fs::read_to_string(project_dir.join("exports/outline.html")).expect("read export"),
            "<h1>Outline</h1>\n"
        );
        assert_eq!(
            fs::read_to_string(project_dir.join("exports/contact-sheet.html"))
                .expect("read contact sheet export"),
            "<h1>References</h1>\n"
        );
        assert_eq!(
            fs::read_to_string(project_dir.join("exports/slides.html"))
                .expect("read slides export"),
            "<h1>Slides</h1>\n"
        );
        fs::remove_dir_all(project_dir).expect("remove temp project");
    }

    #[test]
    fn folder_import_reads_supported_images_with_local_taxonomy() {
        let folder =
            std::env::temp_dir().join(format!("vixio-folder-import-test-{}", timestamp_millis()));
        fs::create_dir_all(&folder).expect("create import folder");

        let fixture_path = folder.join("ritual-tool-final.png");
        let mut png = Cursor::new(Vec::new());
        image::RgbaImage::from_pixel(2, 2, image::Rgba([132, 205, 188, 255]))
            .write_to(&mut png, ImageFormat::Png)
            .expect("write png fixture");
        fs::write(&fixture_path, png.into_inner()).expect("write import fixture");
        fs::write(folder.join("notes.txt"), "ignore me").expect("write ignored file");

        let imported = import_reference_folder_from_path(&folder).expect("import folder");

        assert_eq!(imported.len(), 1);
        assert_eq!(imported[0].title, "ritual tool final");
        assert!(imported[0].tags.contains(&"ritual".to_string()));
        assert!(imported[0].tags.contains(&"tool".to_string()));
        assert!(imported[0].tags.contains(&"square".to_string()));
        assert!(["dark", "bright", "balanced light"]
            .iter()
            .any(|tag| imported[0].tags.contains(&tag.to_string())));
        assert!(imported[0].palette[0].starts_with('#'));
        assert!(imported[0].thumb.starts_with("data:image/png;base64,"));
        assert!(imported[0]
            .suggestions
            .contains(&"folder import".to_string()));
        assert!(imported[0].fingerprint.starts_with("file:"));
        assert!(imported[0].perceptual_hash.starts_with("ahash:"));

        fs::remove_dir_all(folder).expect("remove import folder");
    }

    #[test]
    fn folder_import_maps_eagle_metadata_as_suggestions_and_origin() {
        let folder =
            std::env::temp_dir().join(format!("vixio-eagle-import-test-{}", timestamp_millis()));
        fs::create_dir_all(&folder).expect("create import folder");

        let fixture_path = folder.join("B7A1.info");
        fs::create_dir_all(&fixture_path).expect("create eagle item folder");
        let image_path = fixture_path.join("material-study.png");
        let mut png = Cursor::new(Vec::new());
        image::RgbaImage::from_pixel(2, 2, image::Rgba([223, 174, 103, 255]))
            .write_to(&mut png, ImageFormat::Png)
            .expect("write png fixture");
        fs::write(&image_path, png.into_inner()).expect("write import fixture");
        fs::write(
            fixture_path.join("metadata.json"),
            r#"{
              "id": "eagle-item-01",
              "name": "Eagle Material Study",
              "url": "https://example.com/source",
              "annotation": "quiet brass ritual object",
              "tags": ["Brass", "Ritual Tool"],
              "filePath": "/Eagle.library/images/material-study.png"
            }"#,
        )
        .expect("write metadata");

        let imported = import_reference_folder_from_path(&folder).expect("import folder");

        assert_eq!(imported.len(), 1);
        assert_eq!(imported[0].title, "eagle material study");
        assert_eq!(imported[0].source, "https://example.com/source");
        assert_eq!(imported[0].origin_app.as_deref(), Some("eagle"));
        assert_eq!(imported[0].origin_id.as_deref(), Some("eagle-item-01"));
        assert_eq!(
            imported[0].source_path.as_deref(),
            Some("/Eagle.library/images/material-study.png")
        );
        assert!(imported[0]
            .suggestions
            .contains(&"eagle import".to_string()));
        assert!(imported[0].suggestions.contains(&"brass".to_string()));
        assert!(imported[0].suggestions.contains(&"ritual tool".to_string()));
        assert!(!imported[0].tags.contains(&"brass".to_string()));

        fs::remove_dir_all(folder).expect("remove import folder");
    }

    #[test]
    fn eagle_web_items_map_to_reference_records() {
        let response = serde_json::json!({
            "status": "success",
            "data": {
                "total": 1,
                "offset": 0,
                "limit": 50,
                "data": [{
                    "id": "eagle-web-item-01",
                    "name": "Web API Study",
                    "url": "https://example.com/study",
                    "tags": ["Mood", "Reference"],
                    "annotation": "soft archive wall",
                    "filePath": "/Eagle.library/images/study.png",
                    "palettes": [{ "color": [132, 236, 244] }]
                }]
            }
        });

        let imported = eagle_web_items_from_response(&response, 42).expect("map eagle web items");

        assert_eq!(imported.len(), 1);
        assert_eq!(imported[0].id, "img-eagle-web-42-0");
        assert_eq!(imported[0].title, "web api study");
        assert_eq!(imported[0].source, "https://example.com/study");
        assert_eq!(imported[0].origin_app.as_deref(), Some("eagle"));
        assert_eq!(imported[0].origin_id.as_deref(), Some("eagle-web-item-01"));
        assert_eq!(
            imported[0].source_path.as_deref(),
            Some("/Eagle.library/images/study.png")
        );
        assert_eq!(imported[0].fingerprint, "eagle:eagle-web-item-01");
        assert!(imported[0].suggestions.contains(&"eagle web api".to_string()));
        assert!(imported[0].suggestions.contains(&"mood".to_string()));
        assert_eq!(imported[0].palette[0], "#84ecf4");
    }

    #[test]
    fn screenshot_reference_uses_png_data_and_stable_fingerprint() {
        let mut png = Cursor::new(Vec::new());
        image::RgbaImage::from_pixel(2, 2, image::Rgba([14, 18, 16, 255]))
            .write_to(&mut png, ImageFormat::Png)
            .expect("write png fixture");
        let bytes = png.into_inner();

        let reference =
            screenshot_reference_from_bytes(&bytes, 1234, 0).expect("create screenshot reference");

        assert_eq!(reference.id, "img-screen-1234-0");
        assert_eq!(reference.source, "Screen Capture");
        assert!(reference.thumb.starts_with("data:image/png;base64,"));
        assert!(reference.tags.contains(&"screenshot".to_string()));
        assert!(reference.tags.contains(&"screen".to_string()));
        assert!(reference.tags.contains(&"square".to_string()));
        assert!(reference.tags.contains(&"dark".to_string()));
        assert!(reference.palette[0].starts_with('#'));
        assert!(reference.fingerprint.starts_with("screen:"));
        assert!(reference.perceptual_hash.starts_with("ahash:"));
        assert_eq!(
            reference.fingerprint,
            format!("screen:{:016x}", fnv1a64(&bytes))
        );
    }

    #[test]
    fn ocr_keyword_suggestions_filter_common_words() {
        let suggestions = keyword_suggestions_from_text(
            "The Material Index\nQuiet interface for ritual tools and archive memory",
        );

        assert!(suggestions.contains(&"material".to_string()));
        assert!(suggestions.contains(&"index".to_string()));
        assert!(suggestions.contains(&"ritual".to_string()));
        assert!(!suggestions.contains(&"the".to_string()));
    }

    #[test]
    fn model_tag_suggestions_parse_plain_and_numbered_output() {
        let suggestions = tag_suggestions_from_model_output(
            "1. Quiet interface\n2. material memory, ritual tools; Archive index",
        );

        assert_eq!(
            suggestions,
            vec![
                "quiet interface".to_string(),
                "material memory".to_string(),
                "ritual tools".to_string(),
                "archive index".to_string()
            ]
        );
    }

    #[test]
    #[cfg(unix)]
    fn apple_vision_ocr_process_prefers_compiled_helper() {
        use std::io::Write;
        use std::os::unix::fs::PermissionsExt;

        let id = timestamp_millis();
        let helper_path = std::env::temp_dir().join(format!("vixio-ocr-helper-test-{id}.sh"));
        let image_path = std::env::temp_dir().join(format!("vixio-ocr-helper-test-{id}.png"));

        {
            let mut helper = fs::File::create(&helper_path).expect("create helper");
            writeln!(helper, "#!/bin/sh").expect("write shebang");
            writeln!(helper, "echo helper ocr text").expect("write output");
        }
        fs::set_permissions(&helper_path, fs::Permissions::from_mode(0o755)).expect("chmod helper");
        fs::write(&image_path, b"not-real-image").expect("write image");

        let output = run_apple_vision_ocr_process_with_helper(&image_path, Some(&helper_path))
            .expect("run helper");
        let text = String::from_utf8_lossy(&output.stdout);

        assert_eq!(text.trim(), "helper ocr text");

        let _ = fs::remove_file(helper_path);
        let _ = fs::remove_file(image_path);
    }

    #[test]
    #[cfg(unix)]
    fn natural_language_process_prefers_compiled_helper() {
        use std::io::Write;
        use std::os::unix::fs::PermissionsExt;

        let id = timestamp_millis();
        let helper_path = std::env::temp_dir().join(format!("vixio-nl-helper-test-{id}.sh"));
        let text_path = std::env::temp_dir().join(format!("vixio-nl-helper-test-{id}.txt"));

        {
            let mut helper = fs::File::create(&helper_path).expect("create helper");
            writeln!(helper, "#!/bin/sh").expect("write shebang");
            writeln!(helper, "echo material").expect("write output");
            writeln!(helper, "echo memory").expect("write output");
        }
        fs::set_permissions(&helper_path, fs::Permissions::from_mode(0o755)).expect("chmod helper");
        fs::write(&text_path, b"quiet material memory").expect("write text");

        let output = run_natural_language_process_with_helper(&text_path, Some(&helper_path))
            .expect("run helper");
        let text = String::from_utf8_lossy(&output.stdout);

        assert_eq!(text.trim(), "material\nmemory");

        let _ = fs::remove_file(helper_path);
        let _ = fs::remove_file(text_path);
    }

    #[test]
    #[cfg(unix)]
    fn foundation_models_process_prefers_compiled_helper() {
        use std::io::Write;
        use std::os::unix::fs::PermissionsExt;

        let id = timestamp_millis();
        let helper_path =
            std::env::temp_dir().join(format!("vixio-foundation-helper-test-{id}.sh"));
        let context_path =
            std::env::temp_dir().join(format!("vixio-foundation-helper-test-{id}.txt"));

        {
            let mut helper = fs::File::create(&helper_path).expect("create helper");
            writeln!(helper, "#!/bin/sh").expect("write shebang");
            writeln!(
                helper,
                "if [ \"$1\" = \"availability\" ]; then echo available; exit 0; fi"
            )
            .expect("write availability branch");
            writeln!(helper, "echo quiet interface, material memory").expect("write tags output");
        }
        fs::set_permissions(&helper_path, fs::Permissions::from_mode(0o755)).expect("chmod helper");
        fs::write(&context_path, b"title: test").expect("write context");

        let availability =
            run_foundation_models_process_with_helper("availability", None, Some(&helper_path))
                .expect("run availability helper");
        let tags = run_foundation_models_process_with_helper(
            "tags",
            Some(&context_path),
            Some(&helper_path),
        )
        .expect("run tags helper");

        assert_eq!(
            String::from_utf8_lossy(&availability.stdout).trim(),
            "available"
        );
        assert_eq!(
            String::from_utf8_lossy(&tags.stdout).trim(),
            "quiet interface, material memory"
        );

        let _ = fs::remove_file(helper_path);
        let _ = fs::remove_file(context_path);
    }

    #[test]
    fn bundled_sidecar_discovery_accepts_tauri_triple_suffix() {
        let id = timestamp_millis();
        let dir = std::env::temp_dir().join(format!("vixio-sidecar-discovery-{id}"));
        let sidecar = dir.join("vixio-vision-ocr-helper-aarch64-apple-darwin");
        fs::create_dir_all(&dir).expect("create dir");
        fs::write(&sidecar, b"sidecar").expect("write sidecar");

        let discovered =
            bundled_sidecar_path_in_dir(&dir, "vixio-vision-ocr-helper").expect("discover sidecar");

        assert_eq!(discovered, sidecar);
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn capture_http_request_parses_post_body_and_options() {
        let request =
            "POST /capture HTTP/1.1\r\nContent-Type: application/json\r\n\r\n{\"vixioCapture\":1}";
        match parse_capture_http_request(request) {
            CaptureHttpRequest::Post(payload) => assert_eq!(payload, "{\"vixioCapture\":1}"),
            _ => panic!("expected capture post"),
        }

        match parse_capture_http_request("OPTIONS /capture HTTP/1.1\r\n\r\n") {
            CaptureHttpRequest::Options => {}
            _ => panic!("expected options"),
        }

        match parse_capture_http_request("POST /other HTTP/1.1\r\n\r\n{}") {
            CaptureHttpRequest::Invalid => {}
            _ => panic!("expected invalid"),
        }
    }
}
