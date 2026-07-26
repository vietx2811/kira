use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use image::{GenericImageView, ImageFormat};
#[cfg(target_os = "macos")]
use objc2_app_kit::{NSColor, NSView, NSWindow};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::{
    ffi::OsStr,
    fs,
    io::{Cursor, Read, Write},
    net::{TcpListener, TcpStream},
    path::{Path, PathBuf},
    process::{Command, Output},
    sync::{Arc, Mutex},
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, Manager, State};

const PROJECT_DIR_NAME: &str = "Kira Demo.kira";
const MANIFEST_NAME: &str = "manifest.json";
const SQLITE_NAME: &str = "project.sqlite";
const MIGRATION_BASE_SCHEMA: &str = "001_base_schema";
const MIGRATION_ASSET_PATHS: &str = "002_asset_paths";
const MIGRATION_REFERENCE_FINGERPRINT: &str = "003_reference_fingerprint";
const MIGRATION_REFERENCE_PERCEPTUAL_HASH: &str = "004_reference_perceptual_hash";
const MIGRATION_REFERENCE_ORIGIN: &str = "005_reference_origin";
const MIGRATION_TAG_SUGGESTION_META: &str = "006_tag_suggestion_meta";
#[cfg(target_os = "macos")]
const MACOS_WINDOW_CORNER_RADIUS: f64 = 22.0;
const MIGRATION_OUTLINE_DRAFTS: &str = "007_outline_drafts";
const MIGRATION_GRAPH_V2_FIELDS: &str = "008_graph_v2_fields";
const CAPTURE_SERVER_ADDR: &str = "127.0.0.1:47653";
const CAPTURE_EVENT: &str = "kira:capture";
const EAGLE_WEB_API_ADDR: &str = "127.0.0.1:41595";
const AI_PROVIDER_KEYCHAIN_SERVICE: &str = "studio.kira.desktop.ai-provider";

#[derive(Clone, Default)]
struct CaptureContextState(Arc<Mutex<String>>);

#[derive(Default)]
struct CodexLoginState {
    child: Mutex<Option<std::process::Child>>,
}

#[derive(Deserialize, Serialize)]
struct ProjectSnapshot {
    version: i64,
    ideas: Vec<IdeaRecord>,
    images: Vec<ReferenceRecord>,
    #[serde(default)]
    palettes: Vec<serde_json::Value>,
    #[serde(default)]
    diagrams: Vec<serde_json::Value>,
    #[serde(default)]
    placeholders: Vec<serde_json::Value>,
    // Opaque like palettes/diagrams/placeholders above — Rust never needs to
    // know a frame's shape, just round-trip it.
    #[serde(default)]
    frames: Vec<serde_json::Value>,
    #[serde(default, rename = "aiSettings")]
    ai_settings: serde_json::Value,
    #[serde(default, rename = "versionState")]
    version_state: serde_json::Value,
    #[serde(default, rename = "versionHistory")]
    version_history: Vec<serde_json::Value>,
    #[serde(default, rename = "nodeVersions")]
    node_versions: Vec<serde_json::Value>,
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
    #[serde(default)]
    importance: Option<f64>,
    #[serde(default)]
    scale: Option<f64>,
    #[serde(default, rename = "createdAt")]
    created_at: Option<String>,
    #[serde(default, rename = "addedAt")]
    added_at: Option<String>,
    #[serde(default, rename = "updatedAt")]
    updated_at: Option<String>,
    #[serde(default, rename = "sourceUrl")]
    source_url: Option<String>,
    #[serde(default)]
    notes: Option<String>,
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
    #[serde(default)]
    width: Option<u32>,
    #[serde(default)]
    height: Option<u32>,
    #[serde(default, rename = "sizeBytes")]
    size_bytes: Option<u64>,
    #[serde(default, rename = "mimeType")]
    mime_type: Option<String>,
    palette: Vec<String>,
    tags: Vec<String>,
    suggestions: Vec<TagSuggestionRecord>,
    x: f64,
    y: f64,
    thumb: String,
    #[serde(default)]
    importance: Option<f64>,
    #[serde(default)]
    scale: Option<f64>,
    #[serde(default, rename = "createdAt")]
    created_at: Option<String>,
    #[serde(default, rename = "addedAt")]
    added_at: Option<String>,
    #[serde(default, rename = "updatedAt")]
    updated_at: Option<String>,
    #[serde(default, rename = "sourceUrl")]
    source_url: Option<String>,
    #[serde(default)]
    notes: Option<String>,
    #[serde(default)]
    fingerprint: String,
    #[serde(default, rename = "perceptualHash")]
    perceptual_hash: String,
    #[serde(default, rename = "cropRect")]
    crop_rect: Option<CropRectRecord>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct CropRectRecord {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
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
    width: Option<u32>,
    height: Option<u32>,
    size_bytes: Option<u64>,
    mime_type: Option<String>,
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
    #[serde(default, rename = "sourceNodeId")]
    source_node_id: Option<String>,
    #[serde(default, rename = "targetNodeId")]
    target_node_id: Option<String>,
    #[serde(default, rename = "sourceKind")]
    source_kind: Option<String>,
    #[serde(default, rename = "targetKind")]
    target_kind: Option<String>,
    relation: String,
    note: String,
    confidence: f64,
    #[serde(default, rename = "createdAt")]
    created_at: Option<String>,
    #[serde(default, rename = "updatedAt")]
    updated_at: Option<String>,
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

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AiProviderTestRequest {
    provider_id: String,
    provider_type: String,
    auth_mode: String,
    base_url: Option<String>,
    model: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AiProviderTestResult {
    connected: bool,
    status: String,
    message: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AiModelListResult {
    status: String,
    models: Vec<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AiGenerationRequest {
    provider: AiProviderTestRequest,
    prompt: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AiGenerationResult {
    status: String,
    content: String,
}

#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct CodexStatus {
    logged_in: bool,
    auth_mode: Option<String>,
    account: Option<String>,
    active_model: Option<String>,
    #[serde(default)]
    models: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ExtensionTargetStatus {
    installed: bool,
    available: bool,
    detail: String,
    install_path: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ExtensionInstallStatus {
    chrome: ExtensionTargetStatus,
    safari: ExtensionTargetStatus,
}

#[tauri::command]
fn save_project_package(
    app: AppHandle,
    snapshot_json: String,
    project_path: Option<String>,
) -> Result<ProjectPackageInfo, String> {
    let project_dir = resolve_project_dir(&app, project_path)?;
    write_project_package_to_dir(project_dir, snapshot_json)
}

fn write_project_package_to_dir(
    project_dir: PathBuf,
    snapshot_json: String,
) -> Result<ProjectPackageInfo, String> {
    let snapshot: ProjectSnapshot = serde_json::from_str(&snapshot_json)
        .map_err(|error| format!("Invalid project JSON: {error}"))?;
    if snapshot.version != 2 {
        return Err("Unsupported project snapshot version".to_string());
    }

    ensure_project_dirs(&project_dir)?;

    let sqlite_path = project_dir.join(SQLITE_NAME);
    let mut conn = Connection::open(&sqlite_path).map_err(|error| error.to_string())?;
    migrate(&conn)?;
    write_snapshot(&mut conn, &snapshot, &project_dir)?;

    let manifest_path = project_dir.join(MANIFEST_NAME);
    atomic_write_text(&manifest_path, &snapshot_json)?;

    Ok(ProjectPackageInfo {
        path: project_dir.to_string_lossy().to_string(),
        manifest_path: manifest_path.to_string_lossy().to_string(),
        sqlite_path: sqlite_path.to_string_lossy().to_string(),
    })
}

fn atomic_write_text(path: &Path, contents: &str) -> Result<(), String> {
    let parent = path.parent().ok_or_else(|| "Missing parent directory".to_string())?;
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "Invalid file name".to_string())?;
    let tmp_path = parent.join(format!(".{file_name}.tmp-{}", timestamp_millis()));
    {
        let mut file = fs::File::create(&tmp_path).map_err(|error| error.to_string())?;
        file.write_all(contents.as_bytes())
            .map_err(|error| error.to_string())?;
        file.sync_all().map_err(|error| error.to_string())?;
    }
    fs::rename(&tmp_path, path).map_err(|error| {
        let _ = fs::remove_file(&tmp_path);
        error.to_string()
    })?;
    Ok(())
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
fn save_provider_secret(provider_id: String, secret: String) -> Result<(), String> {
    let clean_provider_id = validate_provider_id(&provider_id)?;
    if secret.trim().is_empty() {
        return Err("Secret is empty".to_string());
    }
    save_secret_to_keychain(&clean_provider_id, &secret)
}

#[tauri::command]
fn delete_provider_secret(provider_id: String) -> Result<(), String> {
    let clean_provider_id = validate_provider_id(&provider_id)?;
    delete_secret_from_keychain(&clean_provider_id)
}

#[tauri::command]
fn test_ai_provider(provider: AiProviderTestRequest) -> Result<AiProviderTestResult, String> {
    let provider_id = validate_provider_id(&provider.provider_id)?;
    test_ai_provider_native(&provider_id, &provider)
}

#[tauri::command]
fn list_ai_models(provider: AiProviderTestRequest) -> Result<AiModelListResult, String> {
    let provider_id = validate_provider_id(&provider.provider_id)?;
    list_ai_models_native(&provider_id, &provider)
}

#[tauri::command]
fn generate_ai_text(request: AiGenerationRequest) -> Result<AiGenerationResult, String> {
    let provider_id = validate_provider_id(&request.provider.provider_id)?;
    generate_ai_text_native(&provider_id, &request.provider, &request.prompt)
}

#[tauri::command]
fn get_extension_install_status(app: AppHandle) -> Result<ExtensionInstallStatus, String> {
    Ok(detect_extension_install_status(Some(&app)))
}

#[tauri::command]
fn open_extension_install_target(app: AppHandle, target_id: String) -> Result<(), String> {
    match target_id.as_str() {
        "chrome" => open_system_target("chrome://extensions"),
        "safari" => open_system_target("x-apple.systempreferences:com.apple.Safari-Settings.extension"),
        "chrome_dist" => open_system_target(&extension_dist_path(Some(&app)).to_string_lossy()),
        "safari_app" => open_system_target(&safari_container_app_path(Some(&app)).to_string_lossy()),
        _ => Err(format!("Unknown extension target: {target_id}")),
    }
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

#[tauri::command]
fn export_slideshow_pptx(
    app: AppHandle,
    base64_data: String,
    filename: Option<String>,
    project_path: Option<String>,
) -> Result<Option<String>, String> {
    let project_dir = resolve_project_dir(&app, project_path)?;
    let bytes = BASE64
        .decode(base64_data.trim())
        .map_err(|error| format!("Invalid PPTX payload: {error}"))?;
    let name = sanitize_export_filename(filename.as_deref(), "slides", "pptx");
    export_bytes_to_exports(&project_dir, &name, &bytes).map(Some)
}

#[tauri::command]
fn update_capture_context(
    state: State<'_, CaptureContextState>,
    context_json: String,
) -> Result<(), String> {
    let mut context = state.0.lock().map_err(|error| error.to_string())?;
    *context = context_json;
    Ok(())
}

fn read_project_package(project_dir: &Path) -> Result<Option<String>, String> {
    let sqlite_path = project_dir.join(SQLITE_NAME);
    let sqlite_result = if sqlite_path.exists() {
        Some(read_sqlite_project_package(project_dir))
    } else {
        None
    };

    if let Some(Ok(Some(snapshot))) = &sqlite_result {
        return Ok(Some(snapshot.clone()));
    }

    let manifest_path = project_dir.join(MANIFEST_NAME);
    if manifest_path.exists() {
        let manifest = fs::read_to_string(&manifest_path).map_err(|error| error.to_string())?;
        if let Ok(snapshot) = serde_json::from_str::<ProjectSnapshot>(&manifest) {
            if snapshot.version == 2 {
                return Ok(Some(manifest));
            }
        }
        if let Some(Err(error)) = sqlite_result {
            return Err(format!("Project package is invalid: {error}"));
        }
        return Err("Project manifest is invalid and no SQLite fallback exists".to_string());
    }

    if let Some(result) = sqlite_result {
        return result;
    }

    Ok(None)
}

fn read_sqlite_project_package(project_dir: &Path) -> Result<Option<String>, String> {
    let sqlite_path = project_dir.join(SQLITE_NAME);
    if sqlite_path.exists() {
        let conn = Connection::open(sqlite_path).map_err(|error| error.to_string())?;
        migrate(&conn)?;
        let snapshot = read_snapshot(&conn)?;
        return serde_json::to_string(&snapshot)
            .map(Some)
            .map_err(|error| error.to_string());
    }

    Ok(None)
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

fn export_bytes_to_exports(
    project_dir: &PathBuf,
    filename: &str,
    contents: &[u8],
) -> Result<String, String> {
    ensure_project_dirs(project_dir)?;
    let export_path = project_dir.join("exports").join(filename);
    fs::write(&export_path, contents).map_err(|error| error.to_string())?;
    Ok(export_path.to_string_lossy().to_string())
}

fn sanitize_export_filename(raw: Option<&str>, fallback: &str, extension: &str) -> String {
    let stem = raw
        .map(|value| {
            value
                .trim()
                .trim_end_matches(&format!(".{extension}"))
                .chars()
                .map(|character| {
                    if character.is_ascii_alphanumeric() || character == '-' || character == '_' {
                        character
                    } else {
                        '-'
                    }
                })
                .collect::<String>()
        })
        .map(|value| value.trim_matches('-').to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| fallback.to_string());
    format!("{stem}.{extension}")
}

fn resolve_project_dir(app: &AppHandle, project_path: Option<String>) -> Result<PathBuf, String> {
    Ok(match project_path {
        Some(path) => normalize_project_path(path),
        None => project_dir(app)?,
    })
}

fn normalize_project_path(project_path: String) -> PathBuf {
    let mut path = PathBuf::from(project_path);
    if path.extension().and_then(|extension| extension.to_str()) != Some("kira") {
        path.set_extension("kira");
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
          y REAL NOT NULL,
          importance REAL,
          created_at TEXT,
          added_at TEXT,
          updated_at TEXT,
          source_url TEXT,
          notes TEXT
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
          y REAL NOT NULL,
          width INTEGER,
          height INTEGER,
          size_bytes INTEGER,
          mime_type TEXT,
          importance REAL,
          created_at TEXT,
          added_at TEXT,
          updated_at TEXT,
          source_url TEXT,
          notes TEXT
        );

        CREATE TABLE IF NOT EXISTS links (
          id TEXT PRIMARY KEY,
          image_id TEXT NOT NULL,
          idea_id TEXT NOT NULL,
          source_node_id TEXT,
          target_node_id TEXT,
          source_kind TEXT,
          target_kind TEXT,
          relation TEXT NOT NULL,
          note TEXT NOT NULL,
          confidence REAL NOT NULL,
          created_at TEXT,
          updated_at TEXT
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

        CREATE TABLE IF NOT EXISTS canvas_collections (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
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
    add_column_if_missing(conn, "ideas", "importance", "REAL")?;
    add_column_if_missing(conn, "ideas", "created_at", "TEXT")?;
    add_column_if_missing(conn, "ideas", "added_at", "TEXT")?;
    add_column_if_missing(conn, "ideas", "updated_at", "TEXT")?;
    add_column_if_missing(conn, "ideas", "source_url", "TEXT")?;
    add_column_if_missing(conn, "ideas", "notes", "TEXT")?;
    add_column_if_missing(conn, "reference_assets", "width", "INTEGER")?;
    add_column_if_missing(conn, "reference_assets", "height", "INTEGER")?;
    add_column_if_missing(conn, "reference_assets", "size_bytes", "INTEGER")?;
    add_column_if_missing(conn, "reference_assets", "mime_type", "TEXT")?;
    add_column_if_missing(conn, "reference_assets", "importance", "REAL")?;
    add_column_if_missing(conn, "reference_assets", "created_at", "TEXT")?;
    add_column_if_missing(conn, "reference_assets", "added_at", "TEXT")?;
    add_column_if_missing(conn, "reference_assets", "updated_at", "TEXT")?;
    add_column_if_missing(conn, "reference_assets", "source_url", "TEXT")?;
    add_column_if_missing(conn, "reference_assets", "notes", "TEXT")?;
    // Visual size, split from `importance` so composition edits stay separate
    // from semantic weight.
    add_column_if_missing(conn, "ideas", "scale", "REAL")?;
    add_column_if_missing(conn, "reference_assets", "scale", "REAL")?;
    add_column_if_missing(conn, "reference_assets", "crop_x", "REAL")?;
    add_column_if_missing(conn, "reference_assets", "crop_y", "REAL")?;
    add_column_if_missing(conn, "reference_assets", "crop_width", "REAL")?;
    add_column_if_missing(conn, "reference_assets", "crop_height", "REAL")?;
    rebuild_links_table_for_graph_v2(conn)?;
    add_column_if_missing(conn, "links", "source_node_id", "TEXT")?;
    add_column_if_missing(conn, "links", "target_node_id", "TEXT")?;
    add_column_if_missing(conn, "links", "source_kind", "TEXT")?;
    add_column_if_missing(conn, "links", "target_kind", "TEXT")?;
    add_column_if_missing(conn, "links", "created_at", "TEXT")?;
    add_column_if_missing(conn, "links", "updated_at", "TEXT")?;
    record_migration(conn, MIGRATION_GRAPH_V2_FIELDS)?;
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

fn rebuild_links_table_for_graph_v2(conn: &Connection) -> Result<(), String> {
    let foreign_key_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM pragma_foreign_key_list('links')", [], |row| {
            row.get(0)
        })
        .unwrap_or(0);
    if foreign_key_count == 0 {
        return Ok(());
    }

    conn.execute_batch(
        "
        PRAGMA foreign_keys = OFF;
        ALTER TABLE links RENAME TO links_legacy_fk;
        CREATE TABLE links (
          id TEXT PRIMARY KEY,
          image_id TEXT NOT NULL,
          idea_id TEXT NOT NULL,
          source_node_id TEXT,
          target_node_id TEXT,
          source_kind TEXT,
          target_kind TEXT,
          relation TEXT NOT NULL,
          note TEXT NOT NULL,
          confidence REAL NOT NULL,
          created_at TEXT,
          updated_at TEXT
        );
        INSERT INTO links (id, image_id, idea_id, relation, note, confidence)
          SELECT id, image_id, idea_id, relation, note, confidence FROM links_legacy_fk;
        DROP TABLE links_legacy_fk;
        PRAGMA foreign_keys = ON;
        ",
    )
    .map_err(|error| error.to_string())
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
    tx.execute("DELETE FROM canvas_collections", [])
        .map_err(|error| error.to_string())?;

    tx.execute(
        "INSERT INTO project_meta (key, value) VALUES ('version', ?1)",
        params![snapshot.version.to_string()],
    )
    .map_err(|error| error.to_string())?;

    for idea in &snapshot.ideas {
        tx.execute(
            "INSERT INTO ideas (id, title, body, status, x, y, importance, scale, created_at, added_at, updated_at, source_url, notes) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            params![
                idea.id,
                idea.title,
                idea.body,
                idea.status,
                idea.x,
                idea.y,
                idea.importance,
                idea.scale,
                idea.created_at,
                idea.added_at,
                idea.updated_at,
                idea.source_url,
                idea.notes
            ],
        )
        .map_err(|error| error.to_string())?;
    }

    for reference in &snapshot.images {
        let palette_json =
            serde_json::to_string(&reference.palette).map_err(|error| error.to_string())?;
        let materialized = materialize_reference(project_dir, reference)?;
        let width = reference.width.map(i64::from);
        let height = reference.height.map(i64::from);
        let size_bytes = reference.size_bytes.map(|value| value as i64);
        let crop_x = reference.crop_rect.as_ref().map(|rect| rect.x);
        let crop_y = reference.crop_rect.as_ref().map(|rect| rect.y);
        let crop_width = reference.crop_rect.as_ref().map(|rect| rect.width);
        let crop_height = reference.crop_rect.as_ref().map(|rect| rect.height);
        tx.execute(
            "INSERT INTO reference_assets (id, title, source, origin_app, origin_id, source_path, palette_json, thumb, asset_path, thumb_path, fingerprint, perceptual_hash, x, y, width, height, size_bytes, mime_type, importance, scale, created_at, added_at, updated_at, source_url, notes, crop_x, crop_y, crop_width, crop_height) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28, ?29)",
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
                reference.y,
                width,
                height,
                size_bytes,
                reference.mime_type,
                reference.importance,
                reference.scale,
                reference.created_at,
                reference.added_at,
                reference.updated_at,
                reference.source_url,
                reference.notes,
                crop_x,
                crop_y,
                crop_width,
                crop_height
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
            "INSERT INTO links (id, image_id, idea_id, source_node_id, target_node_id, source_kind, target_kind, relation, note, confidence, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            params![
                link.id,
                link.image_id,
                link.idea_id,
                link.source_node_id,
                link.target_node_id,
                link.source_kind,
                link.target_kind,
                link.relation,
                link.note,
                link.confidence,
                link.created_at,
                link.updated_at
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

    write_json_collection(&tx, "palettes", &snapshot.palettes)?;
    write_json_collection(&tx, "diagrams", &snapshot.diagrams)?;
    write_json_collection(&tx, "placeholders", &snapshot.placeholders)?;
    write_json_collection(&tx, "frames", &snapshot.frames)?;
    write_json_collection(&tx, "aiSettings", &snapshot.ai_settings)?;
    write_json_collection(&tx, "versionState", &snapshot.version_state)?;
    write_json_collection(&tx, "versionHistory", &snapshot.version_history)?;
    write_json_collection(&tx, "nodeVersions", &snapshot.node_versions)?;

    tx.commit().map_err(|error| error.to_string())
}

fn write_json_collection<T: Serialize>(
    conn: &Connection,
    key: &str,
    value: &T,
) -> Result<(), String> {
    let json = serde_json::to_string(value).map_err(|error| error.to_string())?;
    conn.execute(
        "INSERT INTO canvas_collections (key, value) VALUES (?1, ?2)",
        params![key, json],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
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
    let palettes = read_json_collection(conn, "palettes")?.unwrap_or_default();
    let diagrams = read_json_collection(conn, "diagrams")?.unwrap_or_default();
    let placeholders = read_json_collection(conn, "placeholders")?.unwrap_or_default();
    let frames = read_json_collection(conn, "frames")?.unwrap_or_default();
    let ai_settings = read_json_collection(conn, "aiSettings")?.unwrap_or_else(|| {
        serde_json::json!({
            "providers": [],
            "routingMode": "prefer_local",
            "selectedProviderId": "openai"
        })
    });
    let version_state = read_json_collection(conn, "versionState")?.unwrap_or_else(|| {
        serde_json::json!({
            "schemaVersion": 1,
            "currentBranchId": "main",
            "branches": [{
                "id": "main",
                "name": "Main",
                "createdAt": "1970-01-01T00:00:00.000Z"
            }]
        })
    });
    let version_history = read_json_collection(conn, "versionHistory")?.unwrap_or_default();
    let node_versions = read_json_collection(conn, "nodeVersions")?.unwrap_or_default();

    Ok(ProjectSnapshot {
        version,
        ideas,
        images,
        palettes,
        diagrams,
        placeholders,
        frames,
        ai_settings,
        version_state,
        version_history,
        node_versions,
        links,
        outline_drafts,
    })
}

fn read_ideas(conn: &Connection) -> Result<Vec<IdeaRecord>, String> {
    let mut statement = conn
        .prepare("SELECT id, title, body, status, x, y, importance, created_at, added_at, updated_at, source_url, notes, scale FROM ideas ORDER BY rowid")
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
                importance: row.get(6)?,
                created_at: row.get(7)?,
                added_at: row.get(8)?,
                updated_at: row.get(9)?,
                source_url: row.get(10)?,
                notes: row.get(11)?,
                scale: row.get(12)?,
            })
        })
        .map_err(|error| error.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

fn read_references(conn: &Connection) -> Result<Vec<ReferenceRecord>, String> {
    let mut statement = conn
        .prepare(
            "SELECT id, title, source, origin_app, origin_id, source_path, palette_json, thumb, asset_path, thumb_path, fingerprint, perceptual_hash, x, y, width, height, size_bytes, mime_type, importance, created_at, added_at, updated_at, source_url, notes, scale, crop_x, crop_y, crop_width, crop_height FROM reference_assets ORDER BY rowid",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| {
            let id: String = row.get(0)?;
            let palette_json: String = row.get(6)?;
            let palette = serde_json::from_str::<Vec<String>>(&palette_json).unwrap_or_default();
            let crop_x: Option<f64> = row.get(25)?;
            let crop_y: Option<f64> = row.get(26)?;
            let crop_width: Option<f64> = row.get(27)?;
            let crop_height: Option<f64> = row.get(28)?;
            let crop_rect = match (crop_x, crop_y, crop_width, crop_height) {
                (Some(x), Some(y), Some(width), Some(height)) => {
                    Some(CropRectRecord { x, y, width, height })
                }
                _ => None,
            };
            Ok(ReferenceRecord {
                tags: read_string_list(conn, "reference_tags", "tag", &id)?,
                suggestions: read_tag_suggestions(conn, &id)?,
                id,
                title: row.get(1)?,
                source: row.get(2)?,
                origin_app: row.get(3)?,
                origin_id: row.get(4)?,
                source_path: row.get(5)?,
                width: row.get::<_, Option<i64>>(14)?.map(|value| value as u32),
                height: row.get::<_, Option<i64>>(15)?.map(|value| value as u32),
                size_bytes: row.get::<_, Option<i64>>(16)?.map(|value| value as u64),
                mime_type: row.get(17)?,
                palette,
                thumb: read_thumb_for_frontend(row.get(9)?, row.get(7)?)?,
                fingerprint: row.get(10)?,
                perceptual_hash: row.get(11)?,
                x: row.get(12)?,
                y: row.get(13)?,
                importance: row.get(18)?,
                created_at: row.get(19)?,
                added_at: row.get(20)?,
                updated_at: row.get(21)?,
                source_url: row.get(22)?,
                notes: row.get(23)?,
                scale: row.get(24)?,
                crop_rect,
            })
        })
        .map_err(|error| error.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

fn read_links(conn: &Connection) -> Result<Vec<LinkRecord>, String> {
    let mut statement = conn
        .prepare(
            "SELECT id, image_id, idea_id, source_node_id, target_node_id, source_kind, target_kind, relation, note, confidence, created_at, updated_at FROM links ORDER BY rowid",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok(LinkRecord {
                id: row.get(0)?,
                image_id: row.get(1)?,
                idea_id: row.get(2)?,
                source_node_id: row.get(3)?,
                target_node_id: row.get(4)?,
                source_kind: row.get(5)?,
                target_kind: row.get(6)?,
                relation: row.get(7)?,
                note: row.get(8)?,
                confidence: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
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

fn read_json_collection<T: for<'de> Deserialize<'de>>(
    conn: &Connection,
    key: &str,
) -> Result<Option<T>, String> {
    let value = conn
        .query_row(
            "SELECT value FROM canvas_collections WHERE key = ?1",
            params![key],
            |row| row.get::<_, String>(0),
        )
        .ok();
    let Some(json) = value else {
        return Ok(None);
    };
    serde_json::from_str(&json)
        .map(Some)
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

fn mime_for_image_path(path: &Path) -> Option<String> {
    let extension = path.extension()?.to_string_lossy().to_ascii_lowercase();
    let mime = match extension.as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "webp" => "image/webp",
        "gif" => "image/gif",
        _ => return None,
    };
    Some(mime.to_string())
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
            width: Some(analysis.width),
            height: Some(analysis.height),
            size_bytes: Some(bytes.len() as u64),
            mime_type: mime_for_image_path(&path),
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
    let size_bytes = local_bytes.as_ref().map(|bytes| bytes.len() as u64);
    let mime_type = source_path
        .as_deref()
        .and_then(|path| mime_for_image_path(Path::new(path)));

    ImportedReferenceRecord {
        id: format!("img-eagle-web-{import_id}-{index}"),
        title,
        source,
        origin_app: Some("eagle".to_string()),
        origin_id: Some(item_id.clone()),
        source_path,
        width: analysis.as_ref().map(|analysis| analysis.width),
        height: analysis.as_ref().map(|analysis| analysis.height),
        size_bytes,
        mime_type,
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
    let path = std::env::temp_dir().join(format!("kira-screen-{}.png", timestamp_millis()));
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
        width: Some(analysis.width),
        height: Some(analysis.height),
        size_bytes: Some(bytes.len() as u64),
        mime_type: Some("image/png".to_string()),
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
    let image_path = std::env::temp_dir().join(format!("kira-ocr-{id}.{extension}"));

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
    let helper_path = bundled_sidecar_path("kira-vision-ocr-helper").or_else(|| {
        option_env!("KIRA_VISION_OCR_HELPER")
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

    let script_path = std::env::temp_dir().join(format!("kira-ocr-{}.swift", timestamp_millis()));
    run_swift_script(&script_path, APPLE_VISION_OCR_SWIFT, &[image_path])
}

fn codex_bin_path() -> Option<PathBuf> {
    bundled_sidecar_path("codex")
}

fn run_codex_helper(args: &[&std::ffi::OsStr], stdin_data: Option<&str>) -> Result<Output, String> {
    let helper = bundled_sidecar_path("kira-codex-helper")
        .ok_or_else(|| "Codex helper binary not found".to_string())?;
    let mut command = Command::new(&helper);
    command.args(args);
    if let Some(bin) = codex_bin_path() {
        command.env("KIRA_CODEX_BIN", bin);
    }
    if stdin_data.is_some() {
        command.stdin(std::process::Stdio::piped());
    }
    command.stdout(std::process::Stdio::piped());
    command.stderr(std::process::Stdio::piped());

    let mut child = command.spawn().map_err(|e| format!("Unable to run Codex helper: {e}"))?;
    if let Some(data) = stdin_data {
        use std::io::Write;
        if let Some(mut stdin) = child.stdin.take() {
            stdin.write_all(data.as_bytes()).map_err(|e| format!("Codex helper stdin error: {e}"))?;
        }
    }
    child.wait_with_output().map_err(|e| format!("Codex helper failed: {e}"))
}

fn codex_status_native() -> Result<CodexStatus, String> {
    let output = run_codex_helper(&[std::ffi::OsStr::new("status")], None)?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Invalid Codex status output: {e}"))
}

#[tauri::command]
fn codex_login(
    app: AppHandle,
    state: tauri::State<'_, CodexLoginState>,
    method: String,
    api_key: Option<String>,
) -> Result<(), String> {
    use std::io::{BufRead, BufReader};

    if !matches!(method.as_str(), "chatgpt" | "device" | "api-key") {
        return Err(format!("Unknown login method: {method}"));
    }

    let helper = bundled_sidecar_path("kira-codex-helper")
        .ok_or_else(|| "Codex helper binary not found".to_string())?;
    let mut command = Command::new(&helper);
    command.arg("login").arg(&method);

    // api-key: write the key to a temp payload file (never argv) and pass its path.
    let mut payload_path: Option<PathBuf> = None;
    if method == "api-key" {
        let key = api_key.unwrap_or_default();
        if key.trim().is_empty() {
            return Err("API key is empty".to_string());
        }
        let path = std::env::temp_dir().join(format!("kira-codex-login-{}.json", timestamp_millis()));
        fs::write(&path, serde_json::json!({ "apiKey": key }).to_string())
            .map_err(|e| format!("Unable to write login payload: {e}"))?;
        command.arg(&path);
        payload_path = Some(path);
    }

    if let Some(bin) = codex_bin_path() {
        command.env("KIRA_CODEX_BIN", bin);
    }
    command.stdout(std::process::Stdio::piped());
    command.stderr(std::process::Stdio::piped());

    let mut child = command.spawn().map_err(|e| format!("Unable to start login: {e}"))?;
    let stdout = child.stdout.take().ok_or_else(|| "no stdout".to_string())?;
    let stderr = child.stderr.take().ok_or_else(|| "no stderr".to_string())?;
    *state.child.lock().unwrap() = Some(child);

    // Drain stderr on a background thread WHILE we stream stdout below. A piped stderr that
    // nobody reads fills its OS pipe buffer once the child writes enough to it; the child then
    // blocks on write() forever and the login appears to hang indefinitely. (run_codex_helper
    // avoids this by using wait_with_output(), which drains both streams internally, but this
    // command can't use that helper since it needs to stream stdout live as NDJSON events.)
    let stderr_handle = std::thread::spawn(move || {
        use std::io::Read;
        let mut text = String::new();
        let _ = BufReader::new(stderr).read_to_string(&mut text);
        text
    });

    // Forward each NDJSON line to the webview.
    let reader = BufReader::new(stdout);
    let mut last_error: Option<String> = None;
    for line in reader.lines() {
        let line = match line { Ok(l) => l, Err(_) => break };
        if line.trim().is_empty() { continue }
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(&line) {
            if value.get("type").and_then(|t| t.as_str()) == Some("error") {
                last_error = value.get("message").and_then(|m| m.as_str()).map(ToString::to_string);
            }
            let _ = app.emit("codex://login", value);
        }
    }

    let stderr_text = stderr_handle.join().unwrap_or_default();

    // The child consumed the payload at startup; once stdout hits EOF it is no
    // longer needed. Remove it here so every post-spawn return path (including
    // the cancel/wait handoff below) cleans up the plaintext-secret temp file.
    if let Some(path) = payload_path.take() {
        let _ = fs::remove_file(path);
    }

    let status = {
        let mut guard = state.child.lock().unwrap();
        match guard.take() {
            Some(mut c) => c.wait().map_err(|e| format!("login wait failed: {e}"))?,
            None => return Err("Login was cancelled".to_string()),
        }
    };

    if status.success() {
        Ok(())
    } else {
        Err(last_error.unwrap_or_else(|| {
            stderr_text
                .lines()
                .rev()
                .map(str::trim)
                .find(|line| !line.is_empty())
                .map(ToString::to_string)
                .unwrap_or_else(|| "Login failed".to_string())
        }))
    }
}

#[tauri::command]
fn codex_cancel_login(state: tauri::State<'_, CodexLoginState>) -> Result<(), String> {
    if let Some(mut child) = state.child.lock().unwrap().take() {
        let _ = child.kill();
    }
    Ok(())
}

#[tauri::command]
fn codex_logout() -> Result<(), String> {
    let output = run_codex_helper(&[std::ffi::OsStr::new("logout")], None)?;
    if output.status.success() { Ok(()) }
    else { Err(String::from_utf8_lossy(&output.stderr).trim().to_string()) }
}

fn natural_language_suggestions_from_text(text: &str) -> Option<Vec<String>> {
    let text = text.trim();
    if text.is_empty() {
        return None;
    }

    let id = timestamp_millis();
    let text_path = std::env::temp_dir().join(format!("kira-natural-language-{id}.txt"));
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
    let helper_path = bundled_sidecar_path("kira-natural-language-helper").or_else(|| {
        option_env!("KIRA_NATURAL_LANGUAGE_HELPER")
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

fn validate_provider_id(provider_id: &str) -> Result<String, String> {
    let clean = provider_id.trim();
    if clean.is_empty() {
        return Err("Provider id is empty".to_string());
    }
    if !clean
        .chars()
        .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.'))
    {
        return Err("Provider id contains unsupported characters".to_string());
    }
    Ok(clean.to_string())
}

fn save_secret_to_keychain(provider_id: &str, secret: &str) -> Result<(), String> {
    if !cfg!(target_os = "macos") {
        return Err("Secure provider secrets currently require macOS Keychain".to_string());
    }
    let output = Command::new("security")
        .args([
            "add-generic-password",
            "-a",
            provider_id,
            "-s",
            AI_PROVIDER_KEYCHAIN_SERVICE,
            "-w",
            secret,
            "-U",
        ])
        .output()
        .map_err(|error| error.to_string())?;
    command_success_or_error(output, "Save provider secret")
}

fn read_secret_from_keychain(provider_id: &str) -> Result<String, String> {
    if !cfg!(target_os = "macos") {
        return Err("Secure provider secrets currently require macOS Keychain".to_string());
    }
    let output = Command::new("security")
        .args([
            "find-generic-password",
            "-a",
            provider_id,
            "-s",
            AI_PROVIDER_KEYCHAIN_SERVICE,
            "-w",
        ])
        .output()
        .map_err(|error| error.to_string())?;
    if !output.status.success() {
        return Err("key missing".to_string());
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn delete_secret_from_keychain(provider_id: &str) -> Result<(), String> {
    if !cfg!(target_os = "macos") {
        return Err("Secure provider secrets currently require macOS Keychain".to_string());
    }
    let output = Command::new("security")
        .args([
            "delete-generic-password",
            "-a",
            provider_id,
            "-s",
            AI_PROVIDER_KEYCHAIN_SERVICE,
        ])
        .output()
        .map_err(|error| error.to_string())?;
    if output.status.success()
        || String::from_utf8_lossy(&output.stderr).contains("could not be found")
    {
        return Ok(());
    }
    command_success_or_error(output, "Delete provider secret")
}

fn test_ai_provider_native(
    provider_id: &str,
    provider: &AiProviderTestRequest,
) -> Result<AiProviderTestResult, String> {
    if provider.auth_mode == "local" || provider.provider_type == "apple_foundation" {
        let availability = check_foundation_model_availability_native()?;
        return Ok(AiProviderTestResult {
            connected: availability.available,
            status: availability.status,
            message: availability
                .reason
                .unwrap_or_else(|| "Apple Foundation Models checked".to_string()),
        });
    }

    if provider.provider_type == "codex" {
        return match codex_status_native() {
            Ok(status) if status.logged_in => Ok(AiProviderTestResult {
                connected: true,
                status: "connected".to_string(),
                message: format!(
                    "Logged in ({}) · {}",
                    status.auth_mode.as_deref().unwrap_or("unknown"),
                    status.active_model.as_deref().unwrap_or("default model")
                ),
            }),
            Ok(_) => Ok(AiProviderTestResult {
                connected: false,
                status: "unavailable".to_string(),
                message: "Not signed in. Use Sign in with ChatGPT.".to_string(),
            }),
            Err(error) => Ok(AiProviderTestResult {
                connected: false,
                status: "unavailable".to_string(),
                message: error,
            }),
        };
    }

    if provider.provider_type == "ollama" || provider.provider_type == "lm_studio" {
        let base_url = provider.base_url.as_deref().unwrap_or_default();
        let models = list_local_or_openai_compatible_models(provider, None).unwrap_or_default();
        let connected = !models.is_empty() || can_connect_local_base_url(base_url);
        return Ok(AiProviderTestResult {
            connected,
            status: if connected { "connected" } else { "unavailable" }.to_string(),
            message: if connected {
                if models.is_empty() {
                    format!("Local server is reachable at {base_url}")
                } else {
                    format!("Local server is reachable at {base_url}; {} model(s) found", models.len())
                }
            } else {
                format!("Local server is not reachable at {base_url}")
            },
        });
    }

    match read_secret_from_keychain(provider_id) {
        Ok(secret) if !secret.is_empty() => match list_remote_provider_models(provider, &secret) {
            Ok(models) => Ok(AiProviderTestResult {
                connected: true,
                status: "connected".to_string(),
                message: format!("API reachable; {} model(s) discovered", models.len()),
            }),
            Err(error) => Ok(AiProviderTestResult {
                connected: false,
                status: "unavailable".to_string(),
                message: error,
            }),
        },
        _ => Ok(AiProviderTestResult {
            connected: false,
            status: "key_missing".to_string(),
            message: "API key is missing from secure storage".to_string(),
        }),
    }
}

fn list_ai_models_native(
    provider_id: &str,
    provider: &AiProviderTestRequest,
) -> Result<AiModelListResult, String> {
    if provider.provider_type == "apple_foundation" {
        return Ok(AiModelListResult {
            status: "local".to_string(),
            models: vec!["system default".to_string()],
        });
    }

    if provider.provider_type == "codex" {
        let status = codex_status_native()?;
        return Ok(AiModelListResult {
            status: "codex".to_string(),
            models: status.models,
        });
    }

    if provider.provider_type == "ollama" {
        return match list_local_or_openai_compatible_models(provider, None) {
            Ok(models) => Ok(AiModelListResult {
                status: "local endpoint".to_string(),
                models,
            }),
            Err(error) => Ok(AiModelListResult {
                status: error,
                models: vec![],
            }),
        };
    }

    if provider.provider_type == "lm_studio" || provider.auth_mode == "openai_compatible" {
        let secret = read_secret_from_keychain(provider_id).ok();
        return match list_local_or_openai_compatible_models(provider, secret.as_deref()) {
            Ok(models) => Ok(AiModelListResult {
                status: "openai-compatible".to_string(),
                models,
            }),
            Err(error) => Ok(AiModelListResult {
                status: error,
                models: vec![],
            }),
        };
    }

    match read_secret_from_keychain(provider_id) {
        Ok(secret) if !secret.is_empty() => match list_remote_provider_models(provider, &secret) {
            Ok(models) => Ok(AiModelListResult {
                status: "configured".to_string(),
                models,
            }),
            Err(error) => Ok(AiModelListResult {
                status: error,
                models: vec![],
            }),
        },
        _ => Ok(AiModelListResult {
            status: "key_missing".to_string(),
            models: vec![],
        }),
    }
}

fn generate_codex_text(provider: &AiProviderTestRequest, prompt: &str) -> Result<String, String> {
    match codex_status_native() {
        Ok(status) if status.logged_in => {}
        Ok(_) => return Err("Not signed in. Use Sign in with ChatGPT.".to_string()),
        Err(error) => return Err(error),
    }
    let model = generation_model(provider, "gpt-5.5");
    let payload = serde_json::json!({ "prompt": prompt, "model": model }).to_string();
    let id = timestamp_millis();
    let payload_path = std::env::temp_dir().join(format!("kira-codex-gen-{id}.json"));
    fs::write(&payload_path, &payload).map_err(|e| format!("Unable to write Codex payload: {e}"))?;

    let output = run_codex_helper(
        &[std::ffi::OsStr::new("generate"), payload_path.as_os_str()],
        None,
    );
    let _ = fs::remove_file(&payload_path);
    let output = output?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    let value: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Invalid Codex output: {e}"))?;
    value
        .get("content")
        .and_then(|c| c.as_str())
        .map(ToString::to_string)
        .ok_or_else(|| "Codex returned no content".to_string())
}

fn generate_ai_text_native(
    provider_id: &str,
    provider: &AiProviderTestRequest,
    prompt: &str,
) -> Result<AiGenerationResult, String> {
    let clean_prompt = prompt.trim();
    if clean_prompt.is_empty() {
        return Err("Prompt is empty".to_string());
    }

    let content = match provider.provider_type.as_str() {
        "apple_foundation" => {
            return Err("Apple Foundation text generation is not wired for canvas nodes yet".to_string());
        }
        "ollama" => generate_ollama_text(provider, clean_prompt)?,
        "anthropic" => {
            let secret = read_secret_from_keychain(provider_id)?;
            generate_anthropic_text(provider, &secret, clean_prompt)?
        }
        "gemini" => {
            let secret = read_secret_from_keychain(provider_id)?;
            generate_gemini_text(provider, &secret, clean_prompt)?
        }
        "codex" => generate_codex_text(provider, clean_prompt)?,
        "openai" | "openrouter" | "lm_studio" | "custom_openai_compatible" => {
            let secret = if provider.provider_type == "lm_studio" {
                read_secret_from_keychain(provider_id).ok()
            } else {
                Some(read_secret_from_keychain(provider_id)?)
            };
            generate_openai_compatible_text(provider, secret.as_deref(), clean_prompt)?
        }
        _ if provider.auth_mode == "openai_compatible" => {
            let secret = read_secret_from_keychain(provider_id).ok();
            generate_openai_compatible_text(provider, secret.as_deref(), clean_prompt)?
        }
        _ => return Err("Provider generation is not supported yet".to_string()),
    };

    Ok(AiGenerationResult {
        status: "generated".to_string(),
        content,
    })
}

fn generation_model(provider: &AiProviderTestRequest, fallback: &str) -> String {
    provider
        .model
        .as_deref()
        .filter(|model| !model.trim().is_empty() && *model != "auto")
        .unwrap_or(fallback)
        .to_string()
}

fn generate_openai_compatible_text(
    provider: &AiProviderTestRequest,
    secret: Option<&str>,
    prompt: &str,
) -> Result<String, String> {
    let url = format!("{}/chat/completions", normalized_openai_chat_base_url(provider)?);
    let mut request = generation_http_client().post(url);
    if let Some(secret) = secret.filter(|secret| !secret.trim().is_empty()) {
        request = request.bearer_auth(secret);
    }
    let model = generation_model(provider, "gpt-4.1-mini");
    let response = request
        .json(&serde_json::json!({
            "model": model,
            "temperature": 0.35,
            "messages": [
                {
                    "role": "system",
                    "content": "You generate concise, structured canvas node notes for KIRA."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        }))
        .send()
        .map_err(|error| format!("AI generation failed: {error}"))?;
    let value = response_json(response, "AI generation")?;
    value
        .get("choices")
        .and_then(serde_json::Value::as_array)
        .and_then(|choices| choices.first())
        .and_then(|choice| choice.get("message"))
        .and_then(|message| message.get("content"))
        .and_then(serde_json::Value::as_str)
        .map(|content| content.trim().to_string())
        .filter(|content| !content.is_empty())
        .ok_or_else(|| "AI generation returned no content".to_string())
}

fn generate_anthropic_text(
    provider: &AiProviderTestRequest,
    secret: &str,
    prompt: &str,
) -> Result<String, String> {
    let url = format!("{}/v1/messages", normalized_provider_base_url(provider)?);
    let response = generation_http_client()
        .post(url)
        .header("x-api-key", secret)
        .header("anthropic-version", "2023-06-01")
        .json(&serde_json::json!({
            "model": generation_model(provider, "claude-3-5-sonnet-latest"),
            "max_tokens": 900,
            "temperature": 0.35,
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        }))
        .send()
        .map_err(|error| format!("Anthropic generation failed: {error}"))?;
    let value = response_json(response, "Anthropic generation")?;
    value
        .get("content")
        .and_then(serde_json::Value::as_array)
        .map(|blocks| {
            blocks
                .iter()
                .filter_map(|block| block.get("text").and_then(serde_json::Value::as_str))
                .collect::<Vec<_>>()
                .join("\n")
        })
        .map(|content| content.trim().to_string())
        .filter(|content| !content.is_empty())
        .ok_or_else(|| "Anthropic returned no content".to_string())
}

fn generate_gemini_text(
    provider: &AiProviderTestRequest,
    secret: &str,
    prompt: &str,
) -> Result<String, String> {
    let url = format!(
        "{}/v1beta/models/{}:generateContent?key={}",
        normalized_provider_base_url(provider)?,
        generation_model(provider, "gemini-1.5-pro"),
        secret
    );
    let response = generation_http_client()
        .post(url)
        .json(&serde_json::json!({
            "contents": [
                {
                    "parts": [
                        { "text": prompt }
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.35,
                "maxOutputTokens": 900
            }
        }))
        .send()
        .map_err(|error| format!("Gemini generation failed: {error}"))?;
    let value = response_json(response, "Gemini generation")?;
    value
        .get("candidates")
        .and_then(serde_json::Value::as_array)
        .and_then(|candidates| candidates.first())
        .and_then(|candidate| candidate.get("content"))
        .and_then(|content| content.get("parts"))
        .and_then(serde_json::Value::as_array)
        .map(|parts| {
            parts
                .iter()
                .filter_map(|part| part.get("text").and_then(serde_json::Value::as_str))
                .collect::<Vec<_>>()
                .join("\n")
        })
        .map(|content| content.trim().to_string())
        .filter(|content| !content.is_empty())
        .ok_or_else(|| "Gemini returned no content".to_string())
}

fn generate_ollama_text(provider: &AiProviderTestRequest, prompt: &str) -> Result<String, String> {
    let url = format!("{}/api/generate", normalized_ollama_base_url(provider)?);
    let response = generation_http_client()
        .post(url)
        .json(&serde_json::json!({
            "model": generation_model(provider, "llama3.2"),
            "prompt": prompt,
            "stream": false,
        }))
        .send()
        .map_err(|error| format!("Ollama generation failed: {error}"))?;
    let value = response_json(response, "Ollama generation")?;
    value
        .get("response")
        .and_then(serde_json::Value::as_str)
        .map(|content| content.trim().to_string())
        .filter(|content| !content.is_empty())
        .ok_or_else(|| "Ollama returned no content".to_string())
}

fn can_connect_local_base_url(base_url: &str) -> bool {
    let trimmed = base_url.trim();
    let without_scheme = trimmed
        .strip_prefix("http://")
        .or_else(|| trimmed.strip_prefix("https://"))
        .unwrap_or(trimmed);
    let host_port = without_scheme.split('/').next().unwrap_or_default();
    if host_port.is_empty() {
        return false;
    }
    let mut parts = host_port.split(':');
    let host = parts.next().unwrap_or("127.0.0.1");
    let port = parts
        .next()
        .and_then(|value| value.parse::<u16>().ok())
        .unwrap_or(if trimmed.starts_with("https://") { 443 } else { 80 });
    TcpStream::connect((host, port)).is_ok()
}

fn list_remote_provider_models(
    provider: &AiProviderTestRequest,
    secret: &str,
) -> Result<Vec<String>, String> {
    match provider.provider_type.as_str() {
        "openai" | "openrouter" => list_openai_compatible_models(provider, Some(secret)),
        "anthropic" => list_anthropic_models(provider, secret),
        "gemini" => list_gemini_models(provider, secret),
        _ if provider.auth_mode == "openai_compatible" => {
            list_openai_compatible_models(provider, Some(secret))
        }
        _ => Err("Provider model discovery is not supported yet".to_string()),
    }
}

fn list_local_or_openai_compatible_models(
    provider: &AiProviderTestRequest,
    secret: Option<&str>,
) -> Result<Vec<String>, String> {
    if provider.provider_type == "ollama" {
        return list_ollama_models(provider);
    }
    list_openai_compatible_models(provider, secret)
}

fn list_ollama_models(provider: &AiProviderTestRequest) -> Result<Vec<String>, String> {
    let url = format!("{}/api/tags", normalized_provider_base_url(provider)?);
    let response = http_client()
        .get(url)
        .send()
        .map_err(|error| format!("Ollama model list failed: {error}"))?;
    let value = response_json(response, "Ollama model list")?;
    non_empty_models(parse_ollama_models(&value), "Ollama returned no models")
}

fn list_openai_compatible_models(
    provider: &AiProviderTestRequest,
    secret: Option<&str>,
) -> Result<Vec<String>, String> {
    let url = format!("{}/models", normalized_openai_chat_base_url(provider)?);
    let mut request = http_client().get(url);
    if let Some(secret) = secret.filter(|secret| !secret.trim().is_empty()) {
        request = request.bearer_auth(secret);
    }
    let response = request
        .send()
        .map_err(|error| format!("Model list failed: {error}"))?;
    let value = response_json(response, "Model list")?;
    non_empty_models(parse_openai_compatible_models(&value), "Provider returned no models")
}

fn list_anthropic_models(
    provider: &AiProviderTestRequest,
    secret: &str,
) -> Result<Vec<String>, String> {
    let url = format!("{}/v1/models", normalized_provider_base_url(provider)?);
    let response = http_client()
        .get(url)
        .header("x-api-key", secret)
        .header("anthropic-version", "2023-06-01")
        .send()
        .map_err(|error| format!("Anthropic model list failed: {error}"))?;
    let value = response_json(response, "Anthropic model list")?;
    non_empty_models(parse_openai_compatible_models(&value), "Anthropic returned no models")
}

fn list_gemini_models(
    provider: &AiProviderTestRequest,
    secret: &str,
) -> Result<Vec<String>, String> {
    let url = format!(
        "{}/v1beta/models?key={}",
        normalized_provider_base_url(provider)?,
        secret
    );
    let response = http_client()
        .get(url)
        .send()
        .map_err(|error| format!("Gemini model list failed: {error}"))?;
    let value = response_json(response, "Gemini model list")?;
    non_empty_models(parse_gemini_models(&value), "Gemini returned no models")
}

fn parse_ollama_models(value: &serde_json::Value) -> Vec<String> {
    value
        .get("models")
        .and_then(serde_json::Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|model| model.get("name").and_then(serde_json::Value::as_str))
        .map(ToString::to_string)
        .collect()
}

fn parse_openai_compatible_models(value: &serde_json::Value) -> Vec<String> {
    value
        .get("data")
        .and_then(serde_json::Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|model| model.get("id").and_then(serde_json::Value::as_str))
        .map(ToString::to_string)
        .collect()
}

fn parse_gemini_models(value: &serde_json::Value) -> Vec<String> {
    value
        .get("models")
        .and_then(serde_json::Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|model| model.get("name").and_then(serde_json::Value::as_str))
        .map(|name| name.strip_prefix("models/").unwrap_or(name).to_string())
        .collect()
}

fn normalized_provider_base_url(provider: &AiProviderTestRequest) -> Result<String, String> {
    let base_url = provider
        .base_url
        .as_deref()
        .filter(|url| !url.trim().is_empty())
        .unwrap_or(match provider.provider_type.as_str() {
            "openai" => "https://api.openai.com",
            "anthropic" => "https://api.anthropic.com",
            "gemini" => "https://generativelanguage.googleapis.com",
            "openrouter" => "https://openrouter.ai/api",
            "ollama" => "http://127.0.0.1:11434",
            "lm_studio" => "http://127.0.0.1:1234",
            _ => "",
        })
        .trim()
        .trim_end_matches('/')
        .to_string();
    if base_url.is_empty() {
        Err("Base URL is missing".to_string())
    } else {
        Ok(base_url)
    }
}

fn normalized_openai_chat_base_url(provider: &AiProviderTestRequest) -> Result<String, String> {
    let base = normalized_provider_base_url(provider)?;
    Ok(if base.ends_with("/v1") {
        base
    } else {
        format!("{base}/v1")
    })
}

fn normalized_ollama_base_url(provider: &AiProviderTestRequest) -> Result<String, String> {
    let base = normalized_provider_base_url(provider)?;
    Ok(base.strip_suffix("/v1").unwrap_or(&base).to_string())
}

fn http_client() -> reqwest::blocking::Client {
    reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(8))
        .build()
        .expect("build reqwest client")
}

fn generation_http_client() -> reqwest::blocking::Client {
    reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(45))
        .build()
        .expect("build generation reqwest client")
}

fn response_json(
    response: reqwest::blocking::Response,
    action: &str,
) -> Result<serde_json::Value, String> {
    let status = response.status();
    let value = response
        .json::<serde_json::Value>()
        .map_err(|error| format!("{action} returned invalid JSON: {error}"))?;
    if status.is_success() {
        Ok(value)
    } else {
        let message = value
            .get("error")
            .and_then(|error| {
                error
                    .get("message")
                    .and_then(serde_json::Value::as_str)
                    .or_else(|| error.as_str())
            })
            .unwrap_or("request failed");
        Err(format!("{action} failed with HTTP {status}: {message}"))
    }
}

fn non_empty_models(models: Vec<String>, empty_message: &str) -> Result<Vec<String>, String> {
    if models.is_empty() {
        Err(empty_message.to_string())
    } else {
        Ok(models)
    }
}

fn detect_extension_install_status(app: Option<&AppHandle>) -> ExtensionInstallStatus {
    ExtensionInstallStatus {
        chrome: detect_chrome_extension_status(app),
        safari: detect_safari_extension_status(app),
    }
}

fn detect_chrome_extension_status(app: Option<&AppHandle>) -> ExtensionTargetStatus {
    let install_path = extension_dist_path(app);
    let path_string = install_path.to_string_lossy().to_string();
    let mut checked_profiles = 0;
    let mut matched_profile = None;
    for preferences_path in chrome_preferences_paths() {
        checked_profiles += 1;
        if let Ok(contents) = fs::read_to_string(&preferences_path) {
            if contents.contains(&path_string)
                || contents.contains("KIRA Capture")
                || contents.contains("kiraCapture")
            {
                matched_profile = preferences_path.parent().map(|path| path.to_string_lossy().to_string());
                break;
            }
        }
    }
    let available = install_path.join("manifest.json").exists();
    let detail = if let Some(profile) = &matched_profile {
        format!("Detected in {profile}")
    } else if checked_profiles > 0 {
        format!("Not detected across {checked_profiles} Chromium profile(s)")
    } else {
        "No Chromium profile preferences found".to_string()
    };
    ExtensionTargetStatus {
        installed: matched_profile.is_some(),
        available,
        detail,
        install_path: path_string,
    }
}

fn detect_safari_extension_status(app: Option<&AppHandle>) -> ExtensionTargetStatus {
    let install_path = safari_container_app_path(app);
    let available = install_path.exists();
    let output = Command::new("pluginkit")
        .args(["-m", "-p", "com.apple.Safari.web-extension"])
        .output();
    let (installed, detail) = match output {
        Ok(output) if output.status.success() => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let matched = stdout.contains("app.kira.safari.Extension")
                || stdout.contains("KIRA Safari Extension");
            let detail = if matched {
                "Detected by pluginkit".to_string()
            } else {
                "Not detected by pluginkit".to_string()
            };
            (matched, detail)
        }
        Ok(output) => (
            false,
            format!("pluginkit failed: {}", String::from_utf8_lossy(&output.stderr).trim()),
        ),
        Err(error) => (false, format!("pluginkit unavailable: {error}")),
    };
    ExtensionTargetStatus {
        installed,
        available,
        detail,
        install_path: install_path.to_string_lossy().to_string(),
    }
}

fn chrome_preferences_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    let Some(home) = home_dir() else {
        return paths;
    };
    for browser_dir in [
        "Google/Chrome",
        "Google/Chrome Canary",
        "Chromium",
        "BraveSoftware/Brave-Browser",
        "Microsoft Edge",
    ] {
        let user_data_dir = home
            .join("Library")
            .join("Application Support")
            .join(browser_dir);
        if let Ok(entries) = fs::read_dir(user_data_dir) {
            for entry in entries.flatten() {
                let preferences = entry.path().join("Preferences");
                if preferences.exists() {
                    paths.push(preferences);
                }
            }
        }
    }
    paths
}

fn extension_dist_path(app: Option<&AppHandle>) -> PathBuf {
    bundled_resource_path(app, Path::new("dist"))
        .or_else(|| bundled_resource_dir_containing(app, "manifest.json", "extension/dist"))
        .unwrap_or_else(|| {
        workspace_root_guess().join("apps").join("extension").join("dist")
    })
}

fn safari_container_app_path(app: Option<&AppHandle>) -> PathBuf {
    bundled_resource_path(app, Path::new("KIRA Safari.app"))
        .or_else(|| bundled_resource_named_dir(app, "KIRA Safari.app"))
        .unwrap_or_else(|| {
        workspace_root_guess()
        .join("apps")
        .join("extension")
        .join("safari")
        .join("DerivedData")
        .join("Build")
        .join("Products")
        .join("Release")
        .join("KIRA Safari.app")
    })
}

fn bundled_resource_path(app: Option<&AppHandle>, resource_name: &Path) -> Option<PathBuf> {
    let app = app?;
    let resource_dir = app.path().resource_dir().ok()?;
    let direct = resource_dir.join(resource_name);
    if direct.exists() {
        return Some(direct);
    }
    let nested = resource_dir.join("resources").join(resource_name);
    if nested.exists() {
        return Some(nested);
    }
    None
}

fn bundled_resource_dir_containing(
    app: Option<&AppHandle>,
    file_name: &str,
    suffix_hint: &str,
) -> Option<PathBuf> {
    let resource_dir = app?.path().resource_dir().ok()?;
    find_resource_path(&resource_dir, &|path| {
        path.file_name() == Some(OsStr::new(file_name))
            && path
                .parent()
                .map(|parent| normalize_path_for_match(parent).ends_with(suffix_hint))
                .unwrap_or(false)
    })
    .and_then(|path| path.parent().map(Path::to_path_buf))
}

fn bundled_resource_named_dir(app: Option<&AppHandle>, dir_name: &str) -> Option<PathBuf> {
    let resource_dir = app?.path().resource_dir().ok()?;
    find_resource_path(&resource_dir, &|path| {
        path.is_dir() && path.file_name() == Some(OsStr::new(dir_name))
    })
}

fn find_resource_path(root: &Path, predicate: &dyn Fn(&Path) -> bool) -> Option<PathBuf> {
    if predicate(root) {
        return Some(root.to_path_buf());
    }
    let entries = fs::read_dir(root).ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        if predicate(&path) {
            return Some(path);
        }
        if path.is_dir() {
            if let Some(found) = find_resource_path(&path, predicate) {
                return Some(found);
            }
        }
    }
    None
}

fn normalize_path_for_match(path: &Path) -> String {
    path.components()
        .filter_map(|component| component.as_os_str().to_str())
        .filter(|part| !part.is_empty() && *part != "_up_")
        .collect::<Vec<_>>()
        .join("/")
}

fn workspace_root_guess() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .and_then(Path::parent)
        .and_then(Path::parent)
        .map(Path::to_path_buf)
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")))
}

fn home_dir() -> Option<PathBuf> {
    std::env::var_os("HOME").map(PathBuf::from)
}

fn open_system_target(target: &str) -> Result<(), String> {
    let status = Command::new("open")
        .arg(target)
        .status()
        .map_err(|error| format!("Open failed: {error}"))?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("Open failed with status {status}"))
    }
}

fn command_success_or_error(output: Output, action: &str) -> Result<(), String> {
    if output.status.success() {
        return Ok(());
    }
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    Err(if stderr.is_empty() {
        format!("{action} failed")
    } else {
        format!("{action} failed: {stderr}")
    })
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
    let context_path = std::env::temp_dir().join(format!("kira-foundation-tags-{id}.txt"));
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
    let helper_path = bundled_sidecar_path("kira-foundation-models-helper").or_else(|| {
        option_env!("KIRA_FOUNDATION_MODELS_HELPER")
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
                std::env::temp_dir().join(format!("kira-foundation-check-{id}.swift"));
            run_swift_script(&script_path, FOUNDATION_MODEL_AVAILABILITY_SWIFT, &[])
        }
        "tags" => {
            let Some(context_path) = context_path else {
                return Err("Missing Foundation Models context path".to_string());
            };
            let script_path =
                std::env::temp_dir().join(format!("kira-foundation-tags-{id}.swift"));
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
    width: u32,
    height: u32,
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
            width,
            height,
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
        width,
        height,
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
        CaptureHttpRequest::Context => {
            let state = app.state::<CaptureContextState>();
            let context = state
                .0
                .lock()
                .map(|value| value.clone())
                .unwrap_or_else(|_| "{}".to_string());
            http_response(200, "OK", &context)
        }
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
    Context,
    Post(String),
    Invalid,
}

fn parse_capture_http_request(request: &str) -> CaptureHttpRequest {
    let mut parts = request.splitn(2, "\r\n\r\n");
    let headers = parts.next().unwrap_or_default();
    let body = parts.next().unwrap_or_default().trim();

    if headers.starts_with("OPTIONS /capture ") || headers.starts_with("OPTIONS /context ") {
        return CaptureHttpRequest::Options;
    }
    if headers.starts_with("GET /context ") {
        return CaptureHttpRequest::Context;
    }
    if !headers.starts_with("POST /capture ") || body.is_empty() {
        return CaptureHttpRequest::Invalid;
    }

    CaptureHttpRequest::Post(body.to_string())
}

fn http_response(status: u16, reason: &str, body: &str) -> String {
    format!(
        "HTTP/1.1 {status} {reason}\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{body}",
        body.len()
    )
}

fn project_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join(PROJECT_DIR_NAME))
        .map_err(|error| error.to_string())
}

#[cfg(target_os = "macos")]
unsafe fn apply_native_corner_radius(view: &NSView) {
    view.setWantsLayer(true);
    if let Some(layer) = view.layer() {
        layer.setCornerRadius(MACOS_WINDOW_CORNER_RADIUS);
        layer.setMasksToBounds(true);
        layer.setOpaque(false);
        layer.setBackgroundColor(None);
    }
}

#[cfg(target_os = "macos")]
fn configure_native_macos_window(window: &tauri::WebviewWindow) -> Result<(), String> {
    let ns_window = window.ns_window().map_err(|error| error.to_string())?;
    let ns_view = window.ns_view().map_err(|error| error.to_string())?;

    unsafe {
        let ns_window = &*(ns_window.cast::<NSWindow>());
        ns_window.setOpaque(false);
        ns_window.setBackgroundColor(Some(&NSColor::clearColor()));
        ns_window.setTitlebarAppearsTransparent(true);
        ns_window.setHasShadow(true);

        let ns_view = &*(ns_view.cast::<NSView>());
        apply_native_corner_radius(ns_view);

        if let Some(parent_view) = ns_view.superview() {
            apply_native_corner_radius(&parent_view);
        }

        if let Some(content_view) = ns_window.contentView() {
            apply_native_corner_radius(&content_view);
        }
    }

    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .manage(CaptureContextState::default())
        .manage(CodexLoginState::default())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                #[cfg(target_os = "macos")]
                if let Err(error) = configure_native_macos_window(&window) {
                    eprintln!("KIRA native macOS window setup failed: {error}");
                }
            }
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
            save_provider_secret,
            delete_provider_secret,
            test_ai_provider,
            list_ai_models,
            generate_ai_text,
            get_extension_install_status,
            open_extension_install_target,
            export_outline_markdown,
            export_outline_html,
            export_contact_sheet_html,
            export_slideshow_html,
            export_slideshow_pptx,
            update_capture_context,
            codex_login,
            codex_cancel_login,
            codex_logout
        ])
        .run(tauri::generate_context!())
        .expect("error while running KIRA desktop shell");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sqlite_snapshot_roundtrip_preserves_graph_data_and_assets() {
        let mut conn = Connection::open_in_memory().expect("open sqlite memory db");
        let project_dir = std::env::temp_dir().join(format!(
            "kira-test-{}",
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
            version: 2,
            ideas: vec![IdeaRecord {
                id: "idea-a".to_string(),
                title: "Idea A".to_string(),
                body: "Body".to_string(),
                status: "forming".to_string(),
                x: 12.0,
                y: 34.0,
                importance: Some(3.0),
                scale: Some(1.6),
                created_at: Some("2026-06-01T00:00:00.000Z".to_string()),
                added_at: Some("2026-06-01T00:01:00.000Z".to_string()),
                updated_at: Some("2026-06-01T00:02:00.000Z".to_string()),
                source_url: Some("https://example.com/idea".to_string()),
                notes: Some("Idea notes".to_string()),
            }],
            images: vec![ReferenceRecord {
                id: "img-a".to_string(),
                title: "Reference A".to_string(),
                source: "reference-a.png".to_string(),
                origin_app: Some("eagle".to_string()),
                origin_id: Some("eagle-item-a".to_string()),
                source_path: Some("/library/reference-a.png".to_string()),
                width: Some(1),
                height: Some(1),
                size_bytes: None,
                mime_type: Some("image/png".to_string()),
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
                importance: Some(4.0),
                scale: Some(2.4),
                created_at: Some("2026-06-01T01:00:00.000Z".to_string()),
                added_at: Some("2026-06-01T01:01:00.000Z".to_string()),
                updated_at: Some("2026-06-01T01:02:00.000Z".to_string()),
                source_url: Some("https://example.com/reference".to_string()),
                notes: Some("Reference notes".to_string()),
                fingerprint: "sha256:test-fixture".to_string(),
                perceptual_hash: "ahash:test-fixture".to_string(),
                crop_rect: Some(CropRectRecord {
                    x: 0.1,
                    y: 0.2,
                    width: 0.6,
                    height: 0.5,
                }),
            }],
            palettes: vec![serde_json::json!({
                "id": "palette-a",
                "title": "Palette A",
                "colors": ["#111111", "#222222"],
                "algorithm": "manual",
                "x": 16,
                "y": 18
            })],
            diagrams: vec![serde_json::json!({
                "id": "diagram-a",
                "title": "Diagram A",
                "format": "mermaid",
                "source": "flowchart LR\\nA-->B",
                "nodeIds": ["idea-a"],
                "x": 20,
                "y": 24
            })],
            placeholders: vec![serde_json::json!({
                "id": "placeholder-a",
                "title": "Placeholder A",
                "targetKind": "image",
                "x": 28,
                "y": 32
            })],
            frames: vec![serde_json::json!({
                "id": "frame-a",
                "title": "Frame A",
                "x": 40,
                "y": 44,
                "width": 30,
                "height": 20
            })],
            ai_settings: serde_json::json!({
                "providers": [{"id": "local-apple", "providerType": "local_apple"}],
                "routingMode": "prefer_local",
                "selectedProviderId": "local-apple"
            }),
            version_state: serde_json::json!({
                "schemaVersion": 1,
                "currentBranchId": "main",
                "currentVersionId": "version-a",
                "branches": [{
                    "id": "main",
                    "name": "Main",
                    "createdAt": "2026-06-01T02:00:00.000Z",
                    "headVersionId": "version-a"
                }]
            }),
            version_history: vec![serde_json::json!({
                "id": "version-a",
                "label": "Version A",
                "createdAt": "2026-06-01T02:00:00.000Z",
                "trigger": "manual",
                "branchId": "main",
                "snapshotJson": "{}"
            })],
            node_versions: vec![serde_json::json!({
                "id": "node-version-a",
                "nodeId": "idea-a",
                "nodeKind": "idea",
                "versionNumber": 1,
                "createdAt": "2026-06-01T02:05:00.000Z",
                "trigger": "label_changed",
                "snapshotJson": "{\"id\":\"idea-a\",\"title\":\"Idea A\"}",
                "fields": ["title"],
                "summary": "Changed Title",
                "branchId": "main",
                "aiGenerated": false
            })],
            links: vec![LinkRecord {
                id: "link-a".to_string(),
                image_id: "img-a".to_string(),
                idea_id: "idea-a".to_string(),
                source_node_id: Some("palette-a".to_string()),
                target_node_id: Some("idea-a".to_string()),
                source_kind: Some("palette".to_string()),
                target_kind: Some("idea".to_string()),
                relation: "supports".to_string(),
                note: "Traceable note".to_string(),
                confidence: 0.72,
                created_at: Some("2026-06-01T03:00:00.000Z".to_string()),
                updated_at: Some("2026-06-01T03:01:00.000Z".to_string()),
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

        assert_eq!(restored.version, 2);
        assert_eq!(restored.ideas[0].title, "Idea A");
        assert_eq!(restored.ideas[0].importance, Some(3.0));
        assert_eq!(restored.ideas[0].scale, Some(1.6));
        assert_eq!(
            restored.ideas[0].source_url.as_deref(),
            Some("https://example.com/idea")
        );
        assert_eq!(restored.ideas[0].notes.as_deref(), Some("Idea notes"));
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
        assert_eq!(restored.images[0].width, Some(1));
        assert_eq!(restored.images[0].height, Some(1));
        assert_eq!(restored.images[0].mime_type.as_deref(), Some("image/png"));
        assert_eq!(restored.images[0].importance, Some(4.0));
        assert_eq!(restored.images[0].scale, Some(2.4));
        let restored_crop_rect = restored.images[0]
            .crop_rect
            .as_ref()
            .expect("crop rect roundtrip");
        assert_eq!(restored_crop_rect.x, 0.1);
        assert_eq!(restored_crop_rect.y, 0.2);
        assert_eq!(restored_crop_rect.width, 0.6);
        assert_eq!(restored_crop_rect.height, 0.5);
        assert_eq!(
            restored.images[0].source_url.as_deref(),
            Some("https://example.com/reference")
        );
        assert_eq!(
            restored.images[0].notes.as_deref(),
            Some("Reference notes")
        );
        assert_eq!(restored.images[0].fingerprint, "sha256:test-fixture");
        assert_eq!(restored.images[0].perceptual_hash, "ahash:test-fixture");
        assert_eq!(restored.links[0].image_id, "img-a");
        assert_eq!(restored.links[0].idea_id, "idea-a");
        assert_eq!(
            restored.links[0].source_node_id.as_deref(),
            Some("palette-a")
        );
        assert_eq!(restored.links[0].source_kind.as_deref(), Some("palette"));
        assert_eq!(
            restored.links[0].target_node_id.as_deref(),
            Some("idea-a")
        );
        assert_eq!(restored.links[0].target_kind.as_deref(), Some("idea"));
        assert_eq!(
            restored.links[0].created_at.as_deref(),
            Some("2026-06-01T03:00:00.000Z")
        );
        assert_eq!(restored.palettes[0]["id"], "palette-a");
        assert_eq!(restored.diagrams[0]["id"], "diagram-a");
        assert_eq!(restored.placeholders[0]["id"], "placeholder-a");
        assert_eq!(restored.frames[0]["id"], "frame-a");
        assert_eq!(
            restored.ai_settings["selectedProviderId"].as_str(),
            Some("local-apple")
        );
        assert_eq!(
            restored.version_state["currentVersionId"].as_str(),
            Some("version-a")
        );
        assert_eq!(
            restored.version_state["branches"][0]["headVersionId"].as_str(),
            Some("version-a")
        );
        assert_eq!(restored.version_history[0]["id"], "version-a");
        assert_eq!(restored.version_history[0]["branchId"], "main");
        assert_eq!(restored.node_versions[0]["nodeId"], "idea-a");
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
        assert_eq!(migration_count, 8);

        fs::remove_dir_all(project_dir).expect("remove temp project");
    }

    #[test]
    fn outline_exports_write_exports_files() {
        let project_dir =
            std::env::temp_dir().join(format!("kira-outline-export-test-{}", timestamp_millis()));
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
            std::env::temp_dir().join(format!("kira-folder-import-test-{}", timestamp_millis()));
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
            std::env::temp_dir().join(format!("kira-eagle-import-test-{}", timestamp_millis()));
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
        let helper_path = std::env::temp_dir().join(format!("kira-ocr-helper-test-{id}.sh"));
        let image_path = std::env::temp_dir().join(format!("kira-ocr-helper-test-{id}.png"));

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
    fn codex_status_parses_helper_json() {
        let json = br#"{"loggedIn":true,"authMode":"chatgpt","account":null,"activeModel":"gpt-5.5","models":["gpt-5.5"]}"#;
        let status: CodexStatus = serde_json::from_slice(json).expect("parse");
        assert!(status.logged_in);
        assert_eq!(status.auth_mode.as_deref(), Some("chatgpt"));
        assert_eq!(status.active_model.as_deref(), Some("gpt-5.5"));
        assert_eq!(status.models, vec!["gpt-5.5".to_string()]);
    }

    #[test]
    fn generate_codex_text_extracts_content_field() {
        let stdout = br#"{"content":"hello from codex","usage":null}"#;
        let value: serde_json::Value = serde_json::from_slice(stdout).unwrap();
        assert_eq!(value.get("content").and_then(|c| c.as_str()), Some("hello from codex"));
    }

    #[test]
    #[cfg(unix)]
    fn natural_language_process_prefers_compiled_helper() {
        use std::io::Write;
        use std::os::unix::fs::PermissionsExt;

        let id = timestamp_millis();
        let helper_path = std::env::temp_dir().join(format!("kira-nl-helper-test-{id}.sh"));
        let text_path = std::env::temp_dir().join(format!("kira-nl-helper-test-{id}.txt"));

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
            std::env::temp_dir().join(format!("kira-foundation-helper-test-{id}.sh"));
        let context_path =
            std::env::temp_dir().join(format!("kira-foundation-helper-test-{id}.txt"));

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
        let dir = std::env::temp_dir().join(format!("kira-sidecar-discovery-{id}"));
        let sidecar = dir.join("kira-vision-ocr-helper-aarch64-apple-darwin");
        fs::create_dir_all(&dir).expect("create dir");
        fs::write(&sidecar, b"sidecar").expect("write sidecar");

        let discovered =
            bundled_sidecar_path_in_dir(&dir, "kira-vision-ocr-helper").expect("discover sidecar");

        assert_eq!(discovered, sidecar);
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn capture_http_request_parses_post_body_and_options() {
        let request =
            "POST /capture HTTP/1.1\r\nContent-Type: application/json\r\n\r\n{\"kiraCapture\":1}";
        match parse_capture_http_request(request) {
            CaptureHttpRequest::Post(payload) => assert_eq!(payload, "{\"kiraCapture\":1}"),
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

    #[test]
    fn project_manifest_roundtrip_preserves_v2_metadata() {
        let id = timestamp_millis();
        let project_dir = std::env::temp_dir().join(format!("kira-v2-manifest-test-{id}.kira"));
        ensure_project_dirs(&project_dir).expect("create project dirs");
        let snapshot_json = serde_json::json!({
            "version": 2,
            "ideas": [{
                "id": "idea-a",
                "title": "Idea A",
                "body": "Body",
                "status": "forming",
                "x": 10,
                "y": 20,
                "importance": 1.4,
                "createdAt": "2026-06-02T00:00:00.000Z"
            }],
            "images": [],
            "palettes": [{
                "id": "palette-a",
                "title": "Palette A",
                "colors": ["#84cdbc", "#dfae67"],
                "algorithm": "analogous",
                "x": 30,
                "y": 40
            }],
            "diagrams": [{
                "id": "diagram-a",
                "title": "Diagram A",
                "format": "mermaid",
                "source": "flowchart LR\nA --> B",
                "nodeIds": ["idea-a"],
                "x": 50,
                "y": 20
            }],
            "placeholders": [{
                "id": "placeholder-a",
                "title": "Image placeholder",
                "targetKind": "image",
                "x": 60,
                "y": 70
            }],
            "aiSettings": {
                "providers": [{
                    "id": "openai",
                    "type": "openai",
                    "name": "OpenAI Platform",
                    "authMode": "api_key",
                    "model": "gpt-4.1-mini",
                    "status": "key_missing",
                    "secretRef": "keychain:openai",
                    "defaultFor": ["generate_outline"]
                }],
                "routingMode": "prefer_local",
                "selectedProviderId": "openai"
            },
            "versionHistory": [{
                "id": "version-a",
                "label": "Version A",
                "createdAt": "2026-06-02T00:00:00.000Z",
                "trigger": "manual",
                "branchId": "main",
                "snapshotJson": "{}"
            }],
            "versionState": {
                "schemaVersion": 1,
                "currentBranchId": "main",
                "currentVersionId": "version-a",
                "branches": [{
                    "id": "main",
                    "name": "Main",
                    "createdAt": "2026-06-02T00:00:00.000Z",
                    "headVersionId": "version-a"
                }]
            },
            "nodeVersions": [{
                "id": "node-version-a",
                "nodeId": "idea-a",
                "nodeKind": "idea",
                "versionNumber": 2,
                "createdAt": "2026-06-02T00:05:00.000Z",
                "trigger": "label_changed",
                "snapshotJson": "{\"id\":\"idea-a\",\"title\":\"Idea A\"}",
                "fields": ["title"],
                "summary": "Changed title",
                "branchId": "main",
                "restoredFromId": null,
                "aiGenerated": false
            }],
            "links": [{
                "id": "link-a",
                "imageId": "idea-a",
                "ideaId": "idea-a",
                "sourceNodeId": "idea-a",
                "targetNodeId": "idea-a",
                "sourceKind": "idea",
                "targetKind": "idea",
                "relation": "supports",
                "note": "Diagram link",
                "confidence": 0.74
            }],
            "outlineDrafts": []
        })
        .to_string();

        fs::write(project_dir.join(MANIFEST_NAME), &snapshot_json).expect("write manifest");
        let restored = read_project_package(&project_dir)
            .expect("read project package")
            .expect("manifest contents");
        let restored_json: serde_json::Value =
            serde_json::from_str(&restored).expect("parse restored manifest");

        assert_eq!(restored_json["version"], 2);
        assert_eq!(restored_json["palettes"][0]["title"], "Palette A");
        assert_eq!(restored_json["diagrams"][0]["format"], "mermaid");
        assert_eq!(restored_json["placeholders"][0]["targetKind"], "image");
        assert_eq!(
            restored_json["aiSettings"]["providers"][0]["secretRef"],
            "keychain:openai"
        );
        assert_eq!(restored_json["versionHistory"][0]["label"], "Version A");
        assert_eq!(restored_json["versionState"]["currentVersionId"], "version-a");
        assert_eq!(restored_json["nodeVersions"][0]["nodeId"], "idea-a");
        assert_eq!(restored_json["nodeVersions"][0]["versionNumber"], 2);
        assert_eq!(restored_json["nodeVersions"][0]["fields"][0], "title");
        assert_eq!(restored_json["links"][0]["sourceNodeId"], "idea-a");

        let _ = fs::remove_dir_all(project_dir);
    }

    #[test]
    fn save_project_package_writes_manifest_sqlite_and_workspace_dirs() {
        let id = timestamp_millis();
        let project_dir = std::env::temp_dir().join(format!("kira-save-package-test-{id}.kira"));
        let snapshot_json = serde_json::json!({
            "version": 2,
            "ideas": [{
                "id": "idea-save",
                "title": "Saved Package Idea",
                "body": "Package roundtrip body.",
                "status": "strong",
                "x": 24,
                "y": 42,
                "importance": 2
            }],
            "images": [],
            "palettes": [],
            "diagrams": [],
            "placeholders": [],
            "aiSettings": {
                "providers": [],
                "routingMode": "prefer_local",
                "selectedProviderId": "openai"
            },
            "versionState": {
                "schemaVersion": 1,
                "currentBranchId": "main",
                "currentVersionId": "version-save",
                "branches": [{
                    "id": "main",
                    "name": "Main",
                    "createdAt": "2026-06-08T00:00:00.000Z",
                    "headVersionId": "version-save"
                }]
            },
            "versionHistory": [{
                "id": "version-save",
                "label": "Save Test",
                "createdAt": "2026-06-08T00:00:00.000Z",
                "trigger": "manual",
                "branchId": "main",
                "snapshotJson": "{}"
            }],
            "nodeVersions": [],
            "links": [],
            "outlineDrafts": []
        })
        .to_string();

        let info = write_project_package_to_dir(project_dir.clone(), snapshot_json)
            .expect("write project package");

        assert_eq!(PathBuf::from(&info.path), project_dir);
        assert!(project_dir.join(MANIFEST_NAME).exists());
        assert!(project_dir.join(SQLITE_NAME).exists());
        assert!(project_dir.join("images").is_dir());
        assert!(project_dir.join("thumbs").is_dir());
        assert!(project_dir.join("exports").is_dir());

        let restored = read_project_package(&project_dir)
            .expect("read saved package")
            .expect("restored saved snapshot");
        let restored_json: serde_json::Value =
            serde_json::from_str(&restored).expect("parse restored saved snapshot");
        assert_eq!(restored_json["ideas"][0]["title"], "Saved Package Idea");
        assert_eq!(restored_json["versionState"]["currentVersionId"], "version-save");

        let _ = fs::remove_dir_all(project_dir);
    }

    #[test]
    fn atomic_write_text_replaces_manifest_without_tmp_leftovers() {
        let id = timestamp_millis();
        let project_dir = std::env::temp_dir().join(format!("kira-atomic-write-test-{id}.kira"));
        fs::create_dir_all(&project_dir).expect("create project dir");
        let manifest = project_dir.join(MANIFEST_NAME);

        atomic_write_text(&manifest, "{\"version\":2,\"label\":\"first\"}")
            .expect("write first manifest");
        atomic_write_text(&manifest, "{\"version\":2,\"label\":\"second\"}")
            .expect("replace manifest");

        let contents = fs::read_to_string(&manifest).expect("read manifest");
        assert!(contents.contains("\"second\""));
        let temp_count = fs::read_dir(&project_dir)
            .expect("read project dir")
            .filter_map(Result::ok)
            .filter(|entry| entry.file_name().to_string_lossy().contains(".tmp-"))
            .count();
        assert_eq!(temp_count, 0);

        let _ = fs::remove_dir_all(project_dir);
    }

    #[test]
    fn corrupt_manifest_falls_back_to_sqlite_snapshot() {
        let id = timestamp_millis();
        let project_dir = std::env::temp_dir().join(format!("kira-corrupt-manifest-test-{id}.kira"));
        ensure_project_dirs(&project_dir).expect("create project dirs");
        let mut conn =
            Connection::open(project_dir.join(SQLITE_NAME)).expect("open sqlite project db");
        migrate(&conn).expect("migrate db");
        let snapshot = ProjectSnapshot {
            version: 2,
            ideas: vec![IdeaRecord {
                id: "idea-sqlite".to_string(),
                title: "SQLite fallback idea".to_string(),
                body: "Recovered from SQLite.".to_string(),
                status: "forming".to_string(),
                x: 20.0,
                y: 30.0,
                importance: None,
                scale: None,
                created_at: None,
                added_at: None,
                updated_at: None,
                source_url: None,
                notes: None,
            }],
            images: vec![],
            palettes: vec![],
            diagrams: vec![],
            placeholders: vec![],
            frames: vec![],
            ai_settings: serde_json::json!({
                "providers": [],
                "routingMode": "prefer_local",
                "selectedProviderId": "openai"
            }),
            version_state: serde_json::json!({
                "schemaVersion": 1,
                "currentBranchId": "main",
                "branches": [{
                    "id": "main",
                    "name": "Main",
                    "createdAt": "2026-06-08T00:00:00.000Z"
                }]
            }),
            version_history: vec![],
            node_versions: vec![],
            links: vec![],
            outline_drafts: vec![],
        };
        write_snapshot(&mut conn, &snapshot, &project_dir).expect("write sqlite snapshot");
        fs::write(project_dir.join(MANIFEST_NAME), "{not valid json")
            .expect("write corrupt manifest");

        let restored = read_project_package(&project_dir)
            .expect("read package with fallback")
            .expect("restored snapshot");
        let restored_json: serde_json::Value =
            serde_json::from_str(&restored).expect("parse restored fallback");
        assert_eq!(restored_json["ideas"][0]["title"], "SQLite fallback idea");

        let _ = fs::remove_dir_all(project_dir);
    }

    #[test]
    fn sqlite_snapshot_is_authoritative_when_manifest_is_stale() {
        let id = timestamp_millis();
        let project_dir = std::env::temp_dir().join(format!("kira-sqlite-authority-test-{id}.kira"));
        ensure_project_dirs(&project_dir).expect("create project dirs");
        let mut conn =
            Connection::open(project_dir.join(SQLITE_NAME)).expect("open sqlite project db");
        migrate(&conn).expect("migrate db");
        let snapshot = ProjectSnapshot {
            version: 2,
            ideas: vec![IdeaRecord {
                id: "idea-authoritative".to_string(),
                title: "SQLite authoritative title".to_string(),
                body: "The normalized database should win over a stale manifest.".to_string(),
                status: "strong".to_string(),
                x: 34.0,
                y: 44.0,
                importance: Some(1.8),
                scale: None,
                created_at: None,
                added_at: None,
                updated_at: None,
                source_url: None,
                notes: None,
            }],
            images: vec![],
            palettes: vec![],
            diagrams: vec![],
            placeholders: vec![],
            frames: vec![],
            ai_settings: serde_json::json!({
                "providers": [],
                "routingMode": "prefer_local",
                "selectedProviderId": "openai"
            }),
            version_state: serde_json::json!({
                "schemaVersion": 1,
                "currentBranchId": "main",
                "branches": [{
                    "id": "main",
                    "name": "Main",
                    "createdAt": "2026-06-08T00:00:00.000Z"
                }]
            }),
            version_history: vec![],
            node_versions: vec![],
            links: vec![],
            outline_drafts: vec![],
        };
        write_snapshot(&mut conn, &snapshot, &project_dir).expect("write sqlite snapshot");
        fs::write(
            project_dir.join(MANIFEST_NAME),
            serde_json::json!({
                "version": 2,
                "ideas": [{
                    "id": "idea-stale",
                    "title": "Stale manifest title",
                    "body": "Old browser fallback.",
                    "status": "forming",
                    "x": 10,
                    "y": 20
                }],
                "images": [],
                "palettes": [],
                "diagrams": [],
                "placeholders": [],
                "aiSettings": {
                    "providers": [],
                    "routingMode": "prefer_local",
                    "selectedProviderId": "openai"
                },
                "versionState": {
                    "schemaVersion": 1,
                    "currentBranchId": "main",
                    "branches": [{
                        "id": "main",
                        "name": "Main",
                        "createdAt": "2026-06-08T00:00:00.000Z"
                    }]
                },
                "versionHistory": [],
                "nodeVersions": [],
                "links": [],
                "outlineDrafts": []
            })
            .to_string(),
        )
        .expect("write stale manifest");

        let restored = read_project_package(&project_dir)
            .expect("read package")
            .expect("restored snapshot");
        let restored_json: serde_json::Value =
            serde_json::from_str(&restored).expect("parse restored snapshot");
        assert_eq!(
            restored_json["ideas"][0]["title"],
            "SQLite authoritative title"
        );
        assert_eq!(restored_json["ideas"][0]["id"], "idea-authoritative");

        let _ = fs::remove_dir_all(project_dir);
    }

    #[test]
    fn ai_model_parsers_extract_provider_model_ids() {
        let openai = serde_json::json!({
            "data": [
                { "id": "gpt-4.1-mini" },
                { "id": "gpt-4o" },
                { "object": "ignored" }
            ]
        });
        let ollama = serde_json::json!({
            "models": [
                { "name": "llama3.2:latest" },
                { "name": "qwen2.5" }
            ]
        });
        let gemini = serde_json::json!({
            "models": [
                { "name": "models/gemini-2.5-flash" },
                { "name": "gemini-custom" }
            ]
        });

        assert_eq!(
            parse_openai_compatible_models(&openai),
            vec!["gpt-4.1-mini", "gpt-4o"]
        );
        assert_eq!(
            parse_ollama_models(&ollama),
            vec!["llama3.2:latest", "qwen2.5"]
        );
        assert_eq!(
            parse_gemini_models(&gemini),
            vec!["gemini-2.5-flash", "gemini-custom"]
        );
    }
}
