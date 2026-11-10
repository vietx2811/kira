use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use image::{GenericImageView, ImageFormat};
#[cfg(target_os = "macos")]
use objc2_app_kit::NSWindow;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
#[cfg(unix)]
use std::os::unix::process::CommandExt;
use std::{
    ffi::OsStr,
    fs,
    io::{Cursor, Read, Write},
    net::{TcpListener, TcpStream},
    path::{Path, PathBuf},
    process::{Command, Output},
    sync::{Arc, Mutex, MutexGuard},
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
const MIGRATION_OUTLINE_DRAFTS: &str = "007_outline_drafts";
const MIGRATION_GRAPH_V2_FIELDS: &str = "008_graph_v2_fields";
const MIGRATION_IDEA_CONTENT_FIELD: &str = "009_idea_content_field";
const MIGRATION_NODE_FLAGS: &str = "010_node_flags";
const MIGRATION_LINK_LABEL: &str = "011_link_label";
// project_meta key. Present means the package was last written by a build that
// persists `project`, `appearance` and the node flags. Absent means a legacy
// save, whose manifest.json is the only place those values survive.
const SNAPSHOT_FIELDS_KEY: &str = "snapshot_fields";
const SNAPSHOT_FIELDS_LEVEL: &str = "2";
const CURRENT_SNAPSHOT_VERSION: i64 = 2;
const CAPTURE_SERVER_ADDR: &str = "127.0.0.1:47653";
const CAPTURE_EVENT: &str = "kira:capture";
// docs/research/2026-11-09-pinterest-similar-flow.md §A + Orchestrator
// decision 2026-11-11: the browser extension's only way to know a
// connected-service login state, pushed over the same loopback capture
// server as /capture.
const CONNECTION_EVENT: &str = "kira:connection";
const EAGLE_WEB_API_ADDR: &str = "127.0.0.1:41595";
const AI_PROVIDER_KEYCHAIN_SERVICE: &str = "vxstudio.kira.ai-provider";

#[derive(Clone, Default)]
struct CaptureContextState(Arc<Mutex<String>>);

#[derive(Default)]
struct CodexLoginState {
    child: Mutex<Option<std::process::Child>>,
}

#[derive(Deserialize, Serialize)]
struct ProjectSnapshot {
    version: i64,
    // Opaque like slidesConfig below: Rust only carries them through. The TS
    // ProjectSnapshot declares both as required, and `isProjectSnapshot()`
    // silently swaps a missing one for the default (Untitled, dark mode,
    // default accent), so a field that goes missing here is a silent loss on
    // every save. `Null` means "not stored" (a project saved before these
    // were persisted), which is why they are skipped on serialize: the TS
    // side then sees `undefined`, the case it is written to handle.
    #[serde(default, skip_serializing_if = "serde_json::Value::is_null")]
    project: serde_json::Value,
    #[serde(default, skip_serializing_if = "serde_json::Value::is_null")]
    appearance: serde_json::Value,
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
    // Opaque, like aiSettings/versionState above — Rust never needs to know
    // the Kira right-panel data model's shape (threads/messages/runs/
    // changeSets/skillCheckpoints/provenance), just round-trip it. See
    // apps/desktop/src/kira/aiPanelModel.ts toSnapshot()/fromSnapshot().
    #[serde(default, rename = "aiPanel")]
    ai_panel: serde_json::Value,
    // Bug fix (found while wiring aiPanel persistence): the TS
    // ProjectSnapshot type (main.tsx) has an optional `slidesConfig` field
    // that this struct never had a home for. Before this field existed,
    // write_project_package_to_dir() -> write_snapshot() silently dropped
    // it: the SQLite round trip (read_snapshot(), which read_project_package
    // prefers whenever project.sqlite exists) had nowhere to persist or
    // restore it, even though the raw manifest.json write kept a copy of
    // the original JSON (irrelevant in practice: read_project_package only
    // falls back to the manifest when project.sqlite is absent, which is
    // never true after a real save). See the
    // `slides_config_round_trips_through_save_and_load` test below.
    #[serde(default, rename = "slidesConfig")]
    slides_config: serde_json::Value,
}

#[derive(Deserialize, Serialize)]
struct IdeaRecord {
    id: String,
    title: String,
    // Superseded by `content` (markdown) — kept optional, not removed, so
    // older manifests written before the content-field migration still
    // deserialize. New writes populate `content`, not `body`.
    #[serde(default)]
    body: Option<String>,
    #[serde(default)]
    content: Option<String>,
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
    // `variant` is 'sticker' for a sticky note, which is an Idea underneath.
    // `aiExcluded` keeps a node out of the AI context: losing it re-admits the
    // node into what is sent to the model, so it is a correctness field.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    variant: Option<String>,
    #[serde(default, rename = "aiExcluded", skip_serializing_if = "Option::is_none")]
    ai_excluded: Option<bool>,
}

#[derive(Deserialize, Serialize)]
struct ReferenceRecord {
    id: String,
    title: String,
    #[serde(default)]
    content: Option<String>,
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
    #[serde(default, rename = "aiExcluded", skip_serializing_if = "Option::is_none")]
    ai_excluded: Option<bool>,
    #[serde(default, rename = "tagsPinned", skip_serializing_if = "Option::is_none")]
    tags_pinned: Option<bool>,
    #[serde(default, rename = "palettePinned", skip_serializing_if = "Option::is_none")]
    palette_pinned: Option<bool>,
    #[serde(default, rename = "blockOrder", skip_serializing_if = "Option::is_none")]
    block_order: Option<Vec<String>>,
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
    #[serde(default)]
    label: Option<String>,
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
    // Display names by model id, when the provider reports them (Claude Code does).
    #[serde(skip_serializing_if = "std::collections::HashMap::is_empty")]
    model_labels: std::collections::HashMap<String, String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AiGenerationRequest {
    provider: AiProviderTestRequest,
    prompt: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AiVisionGenerationRequest {
    provider: AiProviderTestRequest,
    prompt: String,
    image_data_url: String,
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
    // Set by codex_status_native() itself, not by the JS helper's status.ts —
    // that helper only reads ~/.codex/*, it has no opinion on whether the CLI
    // binary is actually installed. #[serde(default)] keeps deserializing the
    // helper's JSON (which never includes this key) from failing.
    #[serde(default)]
    installed: bool,
    logged_in: bool,
    auth_mode: Option<String>,
    account: Option<String>,
    active_model: Option<String>,
    #[serde(default)]
    models: Vec<String>,
}

// KIRA doesn't vendor a copy of either CLI (see byok-not-oauth memory) — both Codex and Claude
// Code are detected on the user's PATH via find_bin_in_dirs and run in place.
#[derive(Default)]
struct ClaudeCodeStatus {
    installed: bool,
    logged_in: bool,
    account: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ExtensionTargetStatus {
    installed: bool,
    // Chrome periodically auto-disables unpacked ("developer mode")
    // extensions with a warning banner; only meaningful when `installed`.
    #[serde(default)]
    disabled: bool,
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
    if snapshot.version != CURRENT_SNAPSHOT_VERSION {
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

// The AI and provider commands below are async on purpose. A plain (sync)
// Tauri command runs on the main thread, so a model call that takes tens of
// seconds froze the whole app until it returned (user report 2026-11-06), and
// a Codex sign-in froze it for the length of the browser flow. As async
// commands they run on Tauri's runtime instead; the blocking work inside them
// (HTTP, CLI processes) holds a runtime worker, not the UI.
#[tauri::command]
async fn run_apple_vision_ocr(image_data_url: String) -> Result<Option<OcrResult>, String> {
    run_apple_vision_ocr_for_data_url(&image_data_url)
}

#[tauri::command]
async fn check_foundation_model_availability() -> Result<LocalModelAvailability, String> {
    check_foundation_model_availability_native()
}

#[tauri::command]
async fn normalize_tags_with_foundation_model(
    text_context: String,
) -> Result<LocalModelTagResult, String> {
    normalize_tags_with_foundation_model_native(&text_context)
}

#[tauri::command]
fn save_provider_secret(provider_id: String, secret: String) -> Result<(), String> {
    let clean_provider_id = validate_provider_id(&provider_id)?;
    // Pasted keys often carry a trailing newline or space, which providers reject as a wrong key.
    let secret = secret.trim();
    if secret.is_empty() {
        return Err("Secret is empty".to_string());
    }
    save_secret_to_keychain(&clean_provider_id, secret)
}

#[tauri::command]
fn delete_provider_secret(provider_id: String) -> Result<(), String> {
    let clean_provider_id = validate_provider_id(&provider_id)?;
    delete_secret_from_keychain(&clean_provider_id)
}

#[tauri::command]
async fn test_ai_provider(provider: AiProviderTestRequest) -> Result<AiProviderTestResult, String> {
    let provider_id = validate_provider_id(&provider.provider_id)?;
    test_ai_provider_native(&provider_id, &provider)
}

#[tauri::command]
async fn list_ai_models(provider: AiProviderTestRequest) -> Result<AiModelListResult, String> {
    let provider_id = validate_provider_id(&provider.provider_id)?;
    list_ai_models_native(&provider_id, &provider)
}

#[tauri::command]
async fn generate_ai_text(request: AiGenerationRequest) -> Result<AiGenerationResult, String> {
    let provider_id = validate_provider_id(&request.provider.provider_id)?;
    generate_ai_text_native(&provider_id, &request.provider, &request.prompt)
}

#[tauri::command]
async fn generate_ai_vision(request: AiVisionGenerationRequest) -> Result<AiGenerationResult, String> {
    let provider_id = validate_provider_id(&request.provider.provider_id)?;
    generate_ai_vision_native(&provider_id, &request.provider, &request.prompt, &request.image_data_url)
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
        "chrome_dist" => {
            let path = sync_chrome_extension_dist(&app).unwrap_or_else(|_| extension_dist_path(Some(&app)));
            open_system_target(&path.to_string_lossy())
        }
        "safari_app" => {
            register_safari_extension()?;
            open_system_target("x-apple.systempreferences:com.apple.Safari-Settings.extension")
        }
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
        if let Some(current) = manifest_as_current_version(&manifest) {
            return Ok(Some(current));
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

// A v1 manifest is a v2 one without the fields v2 added, all of which
// ProjectSnapshot already defaults, so it loads as v2 once relabelled. Any other
// version is refused: guessing would hand the frontend data it then rejects
// without saying why.
fn manifest_as_current_version(manifest: &str) -> Option<String> {
    let snapshot = serde_json::from_str::<ProjectSnapshot>(manifest).ok()?;
    match snapshot.version {
        CURRENT_SNAPSHOT_VERSION => Some(manifest.to_string()),
        1 => {
            let mut value = serde_json::from_str::<serde_json::Value>(manifest).ok()?;
            value["version"] = serde_json::json!(CURRENT_SNAPSHOT_VERSION);
            serde_json::to_string(&value).ok()
        }
        _ => None,
    }
}

// The snapshot version to report for what project_meta holds.
//
// v1 to v2 (June 2026) added collections and columns, all optional, and no
// migration ever raised the stored number. So a v1 package holds the same data
// as a v2 one and differs only in this label, which the frontend's
// `version === 2` check then turned into a silent failed open. migrate() has
// already added every column by the time this runs and read_snapshot defaults
// every collection a v1 package lacks, so the honest reading of 1 is "v2 with
// nothing extra". It is reported as such in memory and not written back: the
// next save writes the current version, and merely opening a package should not
// rewrite it.
//
//  - absent: write_snapshot inserts the row in the same transaction as all the
//    data, so a package with content always has one; an empty package has
//    nothing to mislabel. Read as current.
//  - newer than this build: an error the caller can show, never a snapshot the
//    frontend would drop without a word.
//  - unparsable: corruption, also an error.
fn snapshot_version_from_meta(stored: Option<String>) -> Result<i64, String> {
    let Some(text) = stored else {
        return Ok(CURRENT_SNAPSHOT_VERSION);
    };
    match text.trim().parse::<i64>() {
        Ok(version) if (1..=CURRENT_SNAPSHOT_VERSION).contains(&version) => {
            Ok(CURRENT_SNAPSHOT_VERSION)
        }
        Ok(version) if version > CURRENT_SNAPSHOT_VERSION => Err(format!(
            "This project was saved by a newer version of KIRA (snapshot version {version}, this build reads up to {CURRENT_SNAPSHOT_VERSION}). Update KIRA to open it."
        )),
        _ => Err(format!("The project's version marker is unreadable: {text:?}")),
    }
}

fn read_sqlite_project_package(project_dir: &Path) -> Result<Option<String>, String> {
    let sqlite_path = project_dir.join(SQLITE_NAME);
    if sqlite_path.exists() {
        let conn = Connection::open(sqlite_path).map_err(|error| error.to_string())?;
        migrate(&conn)?;
        let mut snapshot = read_snapshot(&conn)?;
        if !has_snapshot_fields(&conn) {
            rescue_legacy_fields_from_manifest(&mut snapshot, project_dir);
        }
        return serde_json::to_string(&snapshot)
            .map(Some)
            .map_err(|error| error.to_string());
    }

    Ok(None)
}

fn has_snapshot_fields(conn: &Connection) -> bool {
    conn.query_row(
        "SELECT 1 FROM project_meta WHERE key = ?1",
        params![SNAPSHOT_FIELDS_KEY],
        |_| Ok(()),
    )
    .is_ok()
}

// A package saved before `project`, `appearance` and the node flags were
// persisted holds them only in manifest.json, which every save wrote in the
// same call as the SQLite rows. Fill in only what the SQLite read left empty,
// matched by node id, so a stale manifest can never override a value SQLite
// does have. Nothing is written back: the next real save persists them and
// sets the marker that stops this path.
fn rescue_legacy_fields_from_manifest(snapshot: &mut ProjectSnapshot, project_dir: &Path) {
    let Ok(text) = fs::read_to_string(project_dir.join(MANIFEST_NAME)) else {
        return;
    };
    let Ok(manifest) = serde_json::from_str::<serde_json::Value>(&text) else {
        return;
    };
    if manifest.get("version").and_then(|value| value.as_i64()) != Some(2) {
        return;
    }
    for (slot, key) in [(&mut snapshot.project, "project"), (&mut snapshot.appearance, "appearance")] {
        if slot.is_null() {
            if let Some(value) = manifest.get(key).filter(|value| value.is_object()) {
                *slot = value.clone();
            }
        }
    }
    let manifest_nodes = |key: &str| -> std::collections::HashMap<String, serde_json::Value> {
        manifest
            .get(key)
            .and_then(|value| value.as_array())
            .map(|items| {
                items
                    .iter()
                    .filter_map(|item| Some((item.get("id")?.as_str()?.to_string(), item.clone())))
                    .collect()
            })
            .unwrap_or_default()
    };
    let flag = |node: &serde_json::Value, key: &str| node.get(key).and_then(|value| value.as_bool());
    let manifest_ideas = manifest_nodes("ideas");
    for idea in &mut snapshot.ideas {
        let Some(saved) = manifest_ideas.get(&idea.id) else { continue };
        if idea.variant.is_none() {
            idea.variant = saved.get("variant").and_then(|value| value.as_str()).map(str::to_string);
        }
        if idea.ai_excluded.is_none() {
            idea.ai_excluded = flag(saved, "aiExcluded");
        }
    }
    let manifest_images = manifest_nodes("images");
    for image in &mut snapshot.images {
        let Some(saved) = manifest_images.get(&image.id) else { continue };
        if image.ai_excluded.is_none() {
            image.ai_excluded = flag(saved, "aiExcluded");
        }
        if image.tags_pinned.is_none() {
            image.tags_pinned = flag(saved, "tagsPinned");
        }
        if image.palette_pinned.is_none() {
            image.palette_pinned = flag(saved, "palettePinned");
        }
        if image.block_order.is_none() {
            image.block_order = saved.get("blockOrder").and_then(|value| {
                serde_json::from_value::<Vec<String>>(value.clone()).ok()
            });
        }
    }
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
    // Node content moves from Idea's `body` (title+body were separately
    // edited) to a single markdown `content` field shared by every node
    // kind, backing the inline rich-text editor. `body` stays as a nullable
    // legacy column so older manifests still round-trip.
    add_column_if_missing(conn, "ideas", "content", "TEXT")?;
    add_column_if_missing(conn, "reference_assets", "content", "TEXT")?;
    record_migration(conn, MIGRATION_IDEA_CONTENT_FIELD)?;
    // Sticky-note identity and the exclude-from-AI-context flag on ideas, plus
    // the flags and block order an image carries on its node face. Nullable:
    // NULL means "not set", same as the field being absent in the TS record.
    add_column_if_missing(conn, "ideas", "variant", "TEXT")?;
    add_column_if_missing(conn, "ideas", "ai_excluded", "INTEGER")?;
    add_column_if_missing(conn, "reference_assets", "ai_excluded", "INTEGER")?;
    add_column_if_missing(conn, "reference_assets", "tags_pinned", "INTEGER")?;
    add_column_if_missing(conn, "reference_assets", "palette_pinned", "INTEGER")?;
    add_column_if_missing(conn, "reference_assets", "block_order", "TEXT")?;
    record_migration(conn, MIGRATION_NODE_FLAGS)?;
    // A few words naming how two nodes connect (AI drafts, Mermaid imports) —
    // EvidenceLink.label in main.tsx, separate from the free-text `note`.
    // Was never given a column, so it silently vanished on save + reload.
    add_column_if_missing(conn, "links", "label", "TEXT")?;
    record_migration(conn, MIGRATION_LINK_LABEL)?;
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
    tx.execute(
        "INSERT INTO project_meta (key, value) VALUES (?1, ?2)",
        params![SNAPSHOT_FIELDS_KEY, SNAPSHOT_FIELDS_LEVEL],
    )
    .map_err(|error| error.to_string())?;

    for idea in &snapshot.ideas {
        tx.execute(
            "INSERT INTO ideas (id, title, body, content, status, x, y, importance, scale, created_at, added_at, updated_at, source_url, notes, variant, ai_excluded) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
            params![
                idea.id,
                idea.title,
                // `ideas.body` stays NOT NULL in the schema (rebuilding the
                // column constraint is a bigger migration than this needs) —
                // legacy readers/tools that still expect a string get one;
                // new writers only ever populate `content`.
                idea.body.clone().unwrap_or_default(),
                idea.content,
                idea.status,
                idea.x,
                idea.y,
                idea.importance,
                idea.scale,
                idea.created_at,
                idea.added_at,
                idea.updated_at,
                idea.source_url,
                idea.notes,
                idea.variant,
                idea.ai_excluded
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
        let block_order_json = reference
            .block_order
            .as_ref()
            .map(serde_json::to_string)
            .transpose()
            .map_err(|error| error.to_string())?;
        tx.execute(
            "INSERT INTO reference_assets (id, title, content, source, origin_app, origin_id, source_path, palette_json, thumb, asset_path, thumb_path, fingerprint, perceptual_hash, x, y, width, height, size_bytes, mime_type, importance, scale, created_at, added_at, updated_at, source_url, notes, crop_x, crop_y, crop_width, crop_height, ai_excluded, tags_pinned, palette_pinned, block_order) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28, ?29, ?30, ?31, ?32, ?33, ?34)",
            params![
                reference.id,
                reference.title,
                reference.content,
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
                crop_height,
                reference.ai_excluded,
                reference.tags_pinned,
                reference.palette_pinned,
                block_order_json
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
            "INSERT INTO links (id, image_id, idea_id, source_node_id, target_node_id, source_kind, target_kind, relation, note, label, confidence, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
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
                link.label,
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
    write_json_collection(&tx, "aiPanel", &snapshot.ai_panel)?;
    write_json_collection(&tx, "slidesConfig", &snapshot.slides_config)?;
    write_json_collection(&tx, "project", &snapshot.project)?;
    write_json_collection(&tx, "appearance", &snapshot.appearance)?;

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
    let version = snapshot_version_from_meta(
        conn.query_row(
            "SELECT value FROM project_meta WHERE key = 'version'",
            [],
            |row| row.get::<_, String>(0),
        )
        .ok(),
    )?;

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
    let ai_panel = read_json_collection(conn, "aiPanel")?.unwrap_or(serde_json::Value::Null);
    let slides_config = read_json_collection(conn, "slidesConfig")?.unwrap_or(serde_json::Value::Null);
    let project = read_json_collection(conn, "project")?.unwrap_or(serde_json::Value::Null);
    let appearance = read_json_collection(conn, "appearance")?.unwrap_or(serde_json::Value::Null);

    Ok(ProjectSnapshot {
        version,
        project,
        appearance,
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
        ai_panel,
        slides_config,
    })
}

fn read_ideas(conn: &Connection) -> Result<Vec<IdeaRecord>, String> {
    let mut statement = conn
        .prepare("SELECT id, title, body, status, x, y, importance, created_at, added_at, updated_at, source_url, notes, scale, content, variant, ai_excluded FROM ideas ORDER BY rowid")
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
                content: row.get(13)?,
                variant: row.get(14)?,
                ai_excluded: row.get(15)?,
            })
        })
        .map_err(|error| error.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

fn read_references(conn: &Connection) -> Result<Vec<ReferenceRecord>, String> {
    let mut statement = conn
        .prepare(
            "SELECT id, title, source, origin_app, origin_id, source_path, palette_json, thumb, asset_path, thumb_path, fingerprint, perceptual_hash, x, y, width, height, size_bytes, mime_type, importance, created_at, added_at, updated_at, source_url, notes, scale, crop_x, crop_y, crop_width, crop_height, content, ai_excluded, tags_pinned, palette_pinned, block_order FROM reference_assets ORDER BY rowid",
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
                content: row.get(29)?,
                ai_excluded: row.get(30)?,
                tags_pinned: row.get(31)?,
                palette_pinned: row.get(32)?,
                block_order: row
                    .get::<_, Option<String>>(33)?
                    .and_then(|json| serde_json::from_str::<Vec<String>>(&json).ok()),
            })
        })
        .map_err(|error| error.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

fn read_links(conn: &Connection) -> Result<Vec<LinkRecord>, String> {
    let mut statement = conn
        .prepare(
            "SELECT id, image_id, idea_id, source_node_id, target_node_id, source_kind, target_kind, relation, note, label, confidence, created_at, updated_at FROM links ORDER BY rowid",
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
                label: row.get(9)?,
                confidence: row.get(10)?,
                created_at: row.get(11)?,
                updated_at: row.get(12)?,
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

// Resolves the user's own installed `codex` binary via PATH — mirrors
// claude_code_bin_path(); KIRA no longer vendors a copy of the Codex CLI.
// apps/codex-helper's resolveCodexBin() already treats "no override here" as
// "let the CLI/codex-sdk search PATH itself", so this only needs to match
// what that fallback would find, for status reporting in the Settings UI.
fn codex_bin_path() -> Option<PathBuf> {
    find_bin_in_dirs(&common_cli_search_dirs(), "codex")
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
    // status.ts reads ~/.codex/* directly and has no opinion on whether the
    // `codex` binary itself is installed — that check has to happen here.
    if codex_bin_path().is_none() {
        return Ok(CodexStatus::default());
    }
    let output = run_codex_helper(&[std::ffi::OsStr::new("status")], None)?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    let mut status: CodexStatus = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Invalid Codex status output: {e}"))?;
    status.installed = true;
    Ok(status)
}

// A panic anywhere else while this Mutex is held would poison it; a bare
// `.lock().unwrap()` here would then panic again on the very next command
// invocation, and that second panic crosses the IPC boundary (WKWebView's
// script-message-handler callback) as a non-unwinding abort. Poisoning only
// marks the guard, it never corrupts the `Option<Child>` payload itself, so
// recovering it with the poisoned guard's own data is safe.
fn lock_ignoring_poison<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

#[tauri::command]
async fn codex_login(
    app: AppHandle,
    state: tauri::State<'_, CodexLoginState>,
    method: String,
    api_key: Option<String>,
) -> Result<(), String> {
    use std::io::{BufRead, BufReader};

    if !matches!(method.as_str(), "chatgpt" | "device" | "api-key") {
        return Err(format!("Unknown login method: {method}"));
    }

    if codex_bin_path().is_none() {
        return Err("Codex CLI not found. Install it, then try Sign in with ChatGPT again.".to_string());
    }

    // Self-heal from any `codex login` left over from before process_group(0)
    // existed, or from KIRA being force-quit mid-login: such a process keeps
    // the OAuth callback's localhost:1455 listener, so a fresh attempt would
    // otherwise hang waiting on a callback that goes to that stale process
    // instead. Best-effort and scoped to this exact command line.
    #[cfg(unix)]
    let _ = Command::new("pkill").args(["-9", "-f", "codex login"]).status();

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

    // The helper spawns `codex login` as its own child; killing just the helper
    // (e.g. from codex_cancel_login) leaves that grandchild running as an
    // orphan that still holds the OAuth callback's localhost:1455 listener —
    // confirmed by hand: killing the helper alone leaves `codex login` alive
    // and the port bound, so every later login attempt hangs waiting on a
    // callback that goes to the wrong (orphaned) process. Making the helper
    // its own process group leader lets codex_cancel_login kill the whole
    // group at once instead of just the one tracked PID.
    #[cfg(unix)]
    command.process_group(0);

    let mut child = command.spawn().map_err(|e| format!("Unable to start login: {e}"))?;
    let stdout = child.stdout.take().ok_or_else(|| "no stdout".to_string())?;
    let stderr = child.stderr.take().ok_or_else(|| "no stderr".to_string())?;
    *lock_ignoring_poison(&state.child) = Some(child);

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
        let mut guard = lock_ignoring_poison(&state.child);
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
    if let Some(mut child) = lock_ignoring_poison(&state.child).take() {
        // codex_login spawns the helper as its own process group leader
        // specifically so this can kill `codex login` along with it — killing
        // only the tracked child PID leaves that grandchild running, still
        // bound to the OAuth callback port, so the next login attempt hangs.
        #[cfg(unix)]
        {
            let pid = child.id();
            let _ = Command::new("kill").args(["-9", "--", &format!("-{pid}")]).status();
        }
        let _ = child.kill();
        let _ = child.wait();
    }
    Ok(())
}

#[tauri::command]
async fn codex_logout() -> Result<(), String> {
    let output = run_codex_helper(&[std::ffi::OsStr::new("logout")], None)?;
    if output.status.success() { Ok(()) }
    else { Err(String::from_utf8_lossy(&output.stderr).trim().to_string()) }
}

// Search dirs shared by every "detect the user's own CLI install" lookup
// (claude, codex, ...). GUI apps launched from Finder/Dock inherit a minimal
// PATH that often skips the Node/npm install locations a user's own shell
// PATH would include, hence the extra fixed candidates below.
fn common_cli_search_dirs() -> Vec<PathBuf> {
    let mut search_dirs: Vec<PathBuf> = Vec::new();
    if let Ok(path_var) = std::env::var("PATH") {
        search_dirs.extend(std::env::split_paths(&path_var));
    }
    if let Some(home) = std::env::var_os("HOME").map(PathBuf::from) {
        search_dirs.push(home.join(".npm-global/bin"));
        search_dirs.push(home.join(".volta/bin"));
        search_dirs.push(home.join(".local/bin"));
    }
    search_dirs.push(PathBuf::from("/opt/homebrew/bin"));
    search_dirs.push(PathBuf::from("/usr/local/bin"));
    search_dirs
}

fn find_bin_in_dirs(dirs: &[PathBuf], binary_name: &str) -> Option<PathBuf> {
    dirs.iter()
        .map(|dir| dir.join(binary_name))
        .find(|candidate| candidate.is_file())
}

// Resolves the user's own installed `claude` binary via PATH — deliberately not a
// `bundled_sidecar_path` lookup, since KIRA doesn't vendor a copy of the Claude Code CLI.
fn claude_code_bin_path() -> Option<PathBuf> {
    find_bin_in_dirs(&common_cli_search_dirs(), "claude")
}

// `claude auth status` (verified against the real binary): exits 0 when logged in, prints a
// `{"loggedIn": bool, "email": "...", ...}` JSON object to stdout regardless of login state.
fn claude_code_status_native() -> Result<ClaudeCodeStatus, String> {
    let Some(bin) = claude_code_bin_path() else {
        return Ok(ClaudeCodeStatus { installed: false, logged_in: false, account: None });
    };
    let output = Command::new(&bin)
        .args(["auth", "status"])
        .output()
        .map_err(|e| format!("Unable to run Claude Code CLI: {e}"))?;
    let parsed: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap_or_default();
    let logged_in = parsed
        .get("loggedIn")
        .and_then(|v| v.as_bool())
        .unwrap_or_else(|| output.status.success());
    let account = parsed.get("email").and_then(|v| v.as_str()).map(ToString::to_string);
    Ok(ClaudeCodeStatus { installed: true, logged_in, account })
}

// Asks the CLI for its models through the stream-json `initialize` control request, the one the
// Agent SDK sends before any prompt. Nothing reaches the model, so it costs no tokens. Hooks, MCP
// servers, tools and session saving are off: this process only answers the handshake. Aliases
// ("default", "opus") are folded into the concrete id they resolve to, so the list holds each
// model once, by the id `--model` accepts.
fn claude_code_supported_models(
    bin: &std::path::Path,
) -> Result<(Vec<String>, std::collections::HashMap<String, String>), String> {
    use std::io::{BufRead, BufReader, Write};
    let mut child = Command::new(bin)
        .args([
            "-p",
            "--input-format",
            "stream-json",
            "--output-format",
            "stream-json",
            "--verbose",
            "--strict-mcp-config",
            "--tools",
            "",
            "--no-session-persistence",
            "--settings",
            r#"{"disableAllHooks":true}"#,
        ])
        .current_dir(std::env::temp_dir())
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map_err(|e| format!("Unable to run Claude Code CLI: {e}"))?;
    let pid = child.id();
    // Stdin stays open until the answer arrives: closing it ends the session before it replies.
    let mut stdin = child.stdin.take().ok_or("Claude Code CLI has no stdin")?;
    stdin
        .write_all(b"{\"type\":\"control_request\",\"request_id\":\"kira-models\",\"request\":{\"subtype\":\"initialize\"}}\n")
        .map_err(|e| format!("Unable to ask Claude Code for its models: {e}"))?;
    let stdout = child.stdout.take().ok_or("Claude Code CLI has no stdout")?;
    let (tx, rx) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            let Ok(value) = serde_json::from_str::<serde_json::Value>(&line) else { continue };
            if value.get("type").and_then(|v| v.as_str()) == Some("control_response")
                && value.pointer("/response/request_id").and_then(|v| v.as_str()) == Some("kira-models")
            {
                let _ = tx.send(value);
                return;
            }
        }
    });
    let answer = rx.recv_timeout(Duration::from_secs(10));
    drop(stdin);
    let _ = child.kill();
    let _ = child.wait();
    let value = answer.map_err(|_| format!("Claude Code did not report its models (pid {pid})"))?;

    let mut ids = Vec::new();
    let mut labels = std::collections::HashMap::new();
    for model in value
        .pointer("/response/response/models")
        .and_then(|v| v.as_array())
        .into_iter()
        .flatten()
    {
        let id = model
            .get("resolvedModel")
            .or_else(|| model.get("value"))
            .and_then(|v| v.as_str())
            .map(str::trim)
            .unwrap_or_default();
        if id.is_empty() || id == "default" {
            continue;
        }
        if !ids.iter().any(|known| known == id) {
            ids.push(id.to_string());
        }
        // "Default (recommended)" names a role, not the model; the same id comes again under its
        // own alias with the real name.
        if let Some(name) = model.get("displayName").and_then(|v| v.as_str()) {
            if !name.starts_with("Default") {
                labels.entry(id.to_string()).or_insert_with(|| name.to_string());
            }
        }
    }
    Ok((ids, labels))
}

// Hands the user a Terminal window with `claude auth login` already running. Deliberately shaped
// this way, not as an in-app sign-in: Anthropic's Agent SDK terms don't allow third-party apps to
// *offer* claude.ai login, so KIRA renders no login UI of its own, never sees the browser
// exchange, and never reads or persists the session token. The CLI owns the flow and its own
// storage end to end; KIRA only saves the user a trip to the terminal.
#[tauri::command]
fn claude_code_open_login_terminal() -> Result<(), String> {
    let bin = claude_code_bin_path()
        .ok_or_else(|| "Claude Code CLI not found. Install it first, then retry.".to_string())?;

    // Single-quote for the shell so a path with spaces survives, then escape for AppleScript.
    let shell_command = format!("{} auth login", shell_single_quote(&bin.to_string_lossy()));
    let script = format!(
        "tell application \"Terminal\"\nactivate\ndo script \"{}\"\nend tell",
        shell_command.replace('\\', "\\\\").replace('"', "\\\"")
    );

    let output = Command::new("osascript")
        .args(["-e", &script])
        .output()
        .map_err(|e| format!("Unable to open Terminal: {e}"))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            "Unable to open Terminal".to_string()
        } else {
            stderr
        });
    }
    Ok(())
}

fn shell_single_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', r"'\''"))
}

// Runs the CLI directly as a one-shot harness (headless print mode) rather than through any
// SDK/login layer — KIRA never initiates or stores a Claude Code session, it only reuses
// whatever the user already signed into via `claude auth login`.
fn generate_claude_code_text(provider: &AiProviderTestRequest, prompt: &str) -> Result<String, String> {
    let bin = claude_code_bin_path()
        .ok_or_else(|| "Claude Code CLI not found. Install it, then run `claude auth login`.".to_string())?;
    let model = generation_model(provider, "claude-sonnet-4-6");
    let output = Command::new(&bin)
        .args(["-p", prompt, "--model", &model, "--output-format", "json"])
        .output()
        .map_err(|e| format!("Unable to run Claude Code CLI: {e}"))?;

    // `claude -p --output-format json` writes a JSON result object to stdout even on failure
    // (verified against the real binary) — the error text lives in `result` alongside
    // `is_error: true`, not on stderr, so stdout is parsed first regardless of exit status.
    let value: serde_json::Value = serde_json::from_slice(&output.stdout).map_err(|_| {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        if stderr.is_empty() { "Claude Code CLI returned no output".to_string() } else { stderr }
    })?;
    let is_error = value
        .get("is_error")
        .and_then(|v| v.as_bool())
        .unwrap_or_else(|| !output.status.success());
    let result_text = value.get("result").and_then(|r| r.as_str()).unwrap_or_default().to_string();
    if is_error {
        return Err(if result_text.is_empty() { "Claude Code CLI reported an error".to_string() } else { result_text });
    }
    if result_text.is_empty() {
        return Err("Claude Code returned no content".to_string());
    }
    Ok(result_text)
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
            Ok(status) if !status.installed => Ok(AiProviderTestResult {
                connected: false,
                status: "unavailable".to_string(),
                message: "Codex CLI not found. Install it, then use Sign in with ChatGPT.".to_string(),
            }),
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

    if provider.provider_type == "claude_code" {
        return match claude_code_status_native() {
            Ok(status) if !status.installed => Ok(AiProviderTestResult {
                connected: false,
                status: "unavailable".to_string(),
                message: "Claude Code CLI not found. Install it, then run `claude auth login`.".to_string(),
            }),
            Ok(status) if status.logged_in => Ok(AiProviderTestResult {
                connected: true,
                status: "connected".to_string(),
                message: match status.account {
                    Some(account) => format!("Signed in as {account}"),
                    None => "Signed in to Claude Code".to_string(),
                },
            }),
            Ok(_) => Ok(AiProviderTestResult {
                connected: false,
                status: "unavailable".to_string(),
                message: "Claude Code CLI found but not signed in. Run `claude auth login` in your terminal.".to_string(),
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
        Ok(secret) if !secret.is_empty() => match verify_remote_provider_key(provider, &secret)
            .and_then(|_| list_remote_provider_models(provider, &secret))
        {
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
            model_labels: Default::default(),
            status: "local".to_string(),
            models: vec!["system default".to_string()],
        });
    }

    if provider.provider_type == "codex" {
        let status = codex_status_native()?;
        return Ok(AiModelListResult {
            model_labels: Default::default(),
            status: if !status.installed {
                "not installed".to_string()
            } else if status.logged_in {
                "codex".to_string()
            } else {
                "not signed in".to_string()
            },
            models: status.models,
        });
    }

    if provider.provider_type == "claude_code" {
        let status = claude_code_status_native()?;
        if !status.logged_in {
            return Ok(AiModelListResult {
                model_labels: Default::default(),
                status: "not signed in".to_string(),
                models: vec![],
            });
        }
        // The CLI has no "list models" subcommand, but its stream-json initialize handshake
        // reports the models this account can use, with display names (what the Agent SDK's
        // supportedModels() reads; Paseo lists Claude models the same way). No prompt is sent.
        let (models, model_labels) = claude_code_bin_path()
            .map(|bin| claude_code_supported_models(&bin))
            .transpose()?
            .unwrap_or_default();
        return Ok(AiModelListResult {
            model_labels,
            status: "claude-code".to_string(),
            models,
        });
    }

    if provider.provider_type == "ollama" {
        return match list_local_or_openai_compatible_models(provider, None) {
            Ok(models) => Ok(AiModelListResult {
                model_labels: Default::default(),
                status: "local endpoint".to_string(),
                models,
            }),
            Err(error) => Ok(AiModelListResult {
                model_labels: Default::default(),
                status: error,
                models: vec![],
            }),
        };
    }

    if provider.provider_type == "lm_studio" || provider.auth_mode == "openai_compatible" {
        let secret = read_secret_from_keychain(provider_id).ok();
        return match list_local_or_openai_compatible_models(provider, secret.as_deref()) {
            Ok(models) => Ok(AiModelListResult {
                model_labels: Default::default(),
                status: "openai-compatible".to_string(),
                models,
            }),
            Err(error) => Ok(AiModelListResult {
                model_labels: Default::default(),
                status: error,
                models: vec![],
            }),
        };
    }

    match read_secret_from_keychain(provider_id) {
        Ok(secret) if !secret.is_empty() => match list_remote_provider_models(provider, &secret) {
            Ok(models) => Ok(AiModelListResult {
                model_labels: Default::default(),
                status: "configured".to_string(),
                models,
            }),
            Err(error) => Ok(AiModelListResult {
                model_labels: Default::default(),
                status: error,
                models: vec![],
            }),
        },
        _ => Ok(AiModelListResult {
            model_labels: Default::default(),
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
        "claude_code" => generate_claude_code_text(provider, clean_prompt)?,
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
    let mut request = generation_http_client()?.post(url);
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
    let response = generation_http_client()?
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
    let response = generation_http_client()?
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
    let response = generation_http_client()?
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

// Splits a "data:<mime>;base64,<payload>" string (the shape every reference
// thumbnail is already stored as on the frontend) into its mime type and raw
// base64 payload — Anthropic/Gemini/Ollama's vision APIs all want those
// passed separately, unlike OpenAI's which takes the whole data URL as-is.
fn split_data_url(data_url: &str) -> Result<(String, String), String> {
    let without_prefix = data_url
        .strip_prefix("data:")
        .ok_or_else(|| "Image is not a data URL".to_string())?;
    without_prefix
        .split_once(";base64,")
        .map(|(mime_type, data)| (mime_type.to_string(), data.to_string()))
        .ok_or_else(|| "Image data URL is not base64-encoded".to_string())
}

fn generate_ai_vision_native(
    provider_id: &str,
    provider: &AiProviderTestRequest,
    prompt: &str,
    image_data_url: &str,
) -> Result<AiGenerationResult, String> {
    let clean_prompt = prompt.trim();
    if clean_prompt.is_empty() {
        return Err("Prompt is empty".to_string());
    }
    if image_data_url.trim().is_empty() {
        return Err("Image is empty".to_string());
    }

    let content = match provider.provider_type.as_str() {
        "apple_foundation" => {
            return Err("Vision generation is not supported for Apple Foundation Models — use on-device OCR instead".to_string());
        }
        "codex" => {
            return Err("Vision generation is not supported for the Codex CLI provider yet".to_string());
        }
        "claude_code" => {
            return Err("Vision generation is not supported for the Claude Code CLI provider yet".to_string());
        }
        "ollama" => generate_ollama_vision(provider, clean_prompt, image_data_url)?,
        "anthropic" => {
            let secret = read_secret_from_keychain(provider_id)?;
            generate_anthropic_vision(provider, &secret, clean_prompt, image_data_url)?
        }
        "gemini" => {
            let secret = read_secret_from_keychain(provider_id)?;
            generate_gemini_vision(provider, &secret, clean_prompt, image_data_url)?
        }
        "openai" | "openrouter" | "lm_studio" | "custom_openai_compatible" => {
            let secret = if provider.provider_type == "lm_studio" {
                read_secret_from_keychain(provider_id).ok()
            } else {
                Some(read_secret_from_keychain(provider_id)?)
            };
            generate_openai_compatible_vision(provider, secret.as_deref(), clean_prompt, image_data_url)?
        }
        _ if provider.auth_mode == "openai_compatible" => {
            let secret = read_secret_from_keychain(provider_id).ok();
            generate_openai_compatible_vision(provider, secret.as_deref(), clean_prompt, image_data_url)?
        }
        _ => return Err("Provider vision generation is not supported yet".to_string()),
    };

    Ok(AiGenerationResult {
        status: "generated".to_string(),
        content,
    })
}

fn generate_openai_compatible_vision(
    provider: &AiProviderTestRequest,
    secret: Option<&str>,
    prompt: &str,
    image_data_url: &str,
) -> Result<String, String> {
    let url = format!("{}/chat/completions", normalized_openai_chat_base_url(provider)?);
    let mut request = generation_http_client()?.post(url);
    if let Some(secret) = secret.filter(|secret| !secret.trim().is_empty()) {
        request = request.bearer_auth(secret);
    }
    let model = generation_model(provider, "gpt-4.1-mini");
    let response = request
        .json(&serde_json::json!({
            "model": model,
            "temperature": 0.2,
            "messages": [
                {
                    "role": "system",
                    "content": "You extract text and suggest tags from creative reference images for KIRA."
                },
                {
                    "role": "user",
                    "content": [
                        { "type": "text", "text": prompt },
                        { "type": "image_url", "image_url": { "url": image_data_url } }
                    ]
                }
            ]
        }))
        .send()
        .map_err(|error| format!("AI vision generation failed: {error}"))?;
    let value = response_json(response, "AI vision generation")?;
    value
        .get("choices")
        .and_then(serde_json::Value::as_array)
        .and_then(|choices| choices.first())
        .and_then(|choice| choice.get("message"))
        .and_then(|message| message.get("content"))
        .and_then(serde_json::Value::as_str)
        .map(|content| content.trim().to_string())
        .filter(|content| !content.is_empty())
        .ok_or_else(|| "AI vision generation returned no content".to_string())
}

fn generate_anthropic_vision(
    provider: &AiProviderTestRequest,
    secret: &str,
    prompt: &str,
    image_data_url: &str,
) -> Result<String, String> {
    let (media_type, data) = split_data_url(image_data_url)?;
    let url = format!("{}/v1/messages", normalized_provider_base_url(provider)?);
    let response = generation_http_client()?
        .post(url)
        .header("x-api-key", secret)
        .header("anthropic-version", "2023-06-01")
        .json(&serde_json::json!({
            "model": generation_model(provider, "claude-3-5-sonnet-latest"),
            "max_tokens": 900,
            "temperature": 0.2,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        { "type": "text", "text": prompt },
                        { "type": "image", "source": { "type": "base64", "media_type": media_type, "data": data } }
                    ]
                }
            ]
        }))
        .send()
        .map_err(|error| format!("Anthropic vision generation failed: {error}"))?;
    let value = response_json(response, "Anthropic vision generation")?;
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
        .ok_or_else(|| "Anthropic vision returned no content".to_string())
}

fn generate_gemini_vision(
    provider: &AiProviderTestRequest,
    secret: &str,
    prompt: &str,
    image_data_url: &str,
) -> Result<String, String> {
    let (mime_type, data) = split_data_url(image_data_url)?;
    let url = format!(
        "{}/v1beta/models/{}:generateContent?key={}",
        normalized_provider_base_url(provider)?,
        generation_model(provider, "gemini-1.5-pro"),
        secret
    );
    let response = generation_http_client()?
        .post(url)
        .json(&serde_json::json!({
            "contents": [
                {
                    "parts": [
                        { "text": prompt },
                        { "inlineData": { "mimeType": mime_type, "data": data } }
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 900
            }
        }))
        .send()
        .map_err(|error| format!("Gemini vision generation failed: {error}"))?;
    let value = response_json(response, "Gemini vision generation")?;
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
        .ok_or_else(|| "Gemini vision returned no content".to_string())
}

fn generate_ollama_vision(
    provider: &AiProviderTestRequest,
    prompt: &str,
    image_data_url: &str,
) -> Result<String, String> {
    let (_, data) = split_data_url(image_data_url)?;
    let url = format!("{}/api/generate", normalized_ollama_base_url(provider)?);
    let response = generation_http_client()?
        .post(url)
        .json(&serde_json::json!({
            "model": generation_model(provider, "llava"),
            "prompt": prompt,
            "images": [data],
            "stream": false,
        }))
        .send()
        .map_err(|error| format!("Ollama vision generation failed: {error}"))?;
    let value = response_json(response, "Ollama vision generation")?;
    value
        .get("response")
        .and_then(serde_json::Value::as_str)
        .map(|content| content.trim().to_string())
        .filter(|content| !content.is_empty())
        .ok_or_else(|| "Ollama vision returned no content".to_string())
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

// Listing models proves a key only where listing needs one. OpenRouter's
// model list is public, so any string connected (a made-up key showed
// "Connected · 454 models" in Settings, 2026-11-06) and every call then failed.
// Its key endpoint does need auth, so check that first.
fn verify_remote_provider_key(provider: &AiProviderTestRequest, secret: &str) -> Result<(), String> {
    if provider.provider_type != "openrouter" {
        return Ok(());
    }
    let url = format!("{}/key", normalized_openai_chat_base_url(provider)?);
    let response = http_client()?
        .get(url)
        .bearer_auth(secret)
        .send()
        .map_err(|error| format!("Key check failed: {error}"))?;
    // OpenRouter answers an unknown key with "Missing Authentication header", which reads like
    // our bug. Say what it means instead.
    if matches!(response.status().as_u16(), 401 | 403) {
        return Err("OpenRouter did not accept this key. Copy it again from openrouter.ai/keys, all of it.".to_string());
    }
    response_json(response, "Key check").map(|_| ())
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
    let response = http_client()?
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
    let mut request = http_client()?.get(url);
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
    let response = http_client()?
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
    let response = http_client()?
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

fn http_client() -> Result<reqwest::blocking::Client, String> {
    reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(8))
        .build()
        .map_err(|error| format!("Unable to build HTTP client: {error}"))
}

fn generation_http_client() -> Result<reqwest::blocking::Client, String> {
    reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(45))
        .build()
        .map_err(|error| format!("Unable to build generation HTTP client: {error}"))
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

fn extension_disabled_in_preferences(contents: &str, path_string: &str) -> bool {
    // Best-effort only: Chrome's extension `state` field (0 = disabled, 1 =
    // enabled) has been part of the extension system since its earliest
    // versions, so this is low-risk — but the exact JSON shape is still an
    // internal Chrome implementation detail, not a stable public API. If
    // parsing fails or nothing matches, this just returns false, identical
    // to the behavior before this check existed.
    let Ok(json) = serde_json::from_str::<serde_json::Value>(contents) else {
        return false;
    };
    let Some(settings) = json
        .get("extensions")
        .and_then(|e| e.get("settings"))
        .and_then(|s| s.as_object())
    else {
        return false;
    };
    for entry in settings.values() {
        let matches_path = entry.get("path").and_then(|p| p.as_str()) == Some(path_string);
        let matches_name = entry
            .get("manifest")
            .and_then(|m| m.get("name"))
            .and_then(|n| n.as_str())
            .is_some_and(|name| name.contains("KIRA"));
        if matches_path || matches_name {
            return entry.get("state").and_then(|s| s.as_i64()) == Some(0);
        }
    }
    false
}

fn detect_chrome_extension_status(app: Option<&AppHandle>) -> ExtensionTargetStatus {
    let install_path = extension_dist_path(app);
    let path_string = install_path.to_string_lossy().to_string();
    let mut checked_profiles = 0;
    let mut matched_profile = None;
    let mut disabled = false;
    for preferences_path in chrome_preferences_paths() {
        checked_profiles += 1;
        if let Ok(contents) = fs::read_to_string(&preferences_path) {
            if contents.contains(&path_string)
                || contents.contains("KIRA Capture")
                || contents.contains("kiraCapture")
            {
                matched_profile = preferences_path.parent().map(|path| path.to_string_lossy().to_string());
                disabled = extension_disabled_in_preferences(&contents, &path_string);
                break;
            }
        }
    }
    let available = install_path.join("manifest.json").exists();
    let detail = if disabled {
        "Installed but disabled by Chrome — click Load unpacked again".to_string()
    } else if let Some(profile) = &matched_profile {
        format!("Detected in {profile}")
    } else if checked_profiles > 0 {
        format!("Not detected across {checked_profiles} Chromium profile(s)")
    } else {
        "No Chromium profile preferences found".to_string()
    };
    ExtensionTargetStatus {
        installed: matched_profile.is_some(),
        disabled,
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
            let matched = stdout.contains("vxstudio.kira.safari")
                || stdout.contains("studio.kira.desktop.safari")
                || stdout.contains("app.kira.safari.Extension")
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
        // pluginkit reports registered/not, not enabled/disabled — Safari
        // has no equivalent "auto-disabled" state for this to distinguish.
        disabled: false,
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

fn extension_bundled_dist_path(app: Option<&AppHandle>) -> PathBuf {
    bundled_resource_path(app, Path::new("dist"))
        .or_else(|| bundled_resource_dir_containing(app, "manifest.json", "extension/dist"))
        .unwrap_or_else(|| {
        workspace_root_guess().join("apps").join("extension").join("dist")
    })
}

// A path inside the versioned .app bundle would shift (or vanish) across a
// KIRA update, silently orphaning whatever Chrome loaded via "Load unpacked"
// at the old path. Mirroring the bundled dist into Application Support once
// per launch gives Chrome a install target that survives updates in place.
fn chrome_stable_dist_dir(app: Option<&AppHandle>) -> Option<PathBuf> {
    let dir = app?.path().app_data_dir().ok()?.join("extension").join("chrome-dist");
    Some(dir)
}

fn extension_dist_path(app: Option<&AppHandle>) -> PathBuf {
    if let Some(stable) = chrome_stable_dist_dir(app) {
        if stable.join("manifest.json").exists() {
            return stable;
        }
    }
    extension_bundled_dist_path(app)
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> std::io::Result<()> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let dest_path = dst.join(entry.file_name());
        if entry.file_type()?.is_dir() {
            copy_dir_recursive(&entry.path(), &dest_path)?;
        } else {
            fs::copy(entry.path(), &dest_path)?;
        }
    }
    Ok(())
}

// Mirrors the bundled extension/dist into the stable Application Support
// path `extension_dist_path` prefers once it exists. Cheap to call on every
// launch and every Settings > Capture refresh: skips the actual copy unless
// the bundled manifest changed, so it isn't rewriting the folder (and its
// mtime) on every app start.
fn sync_chrome_extension_dist(app: &AppHandle) -> Result<PathBuf, String> {
    let source = extension_bundled_dist_path(Some(app));
    if !source.join("manifest.json").exists() {
        return Err("Bundled Chrome extension files were not found".to_string());
    }
    let stable = chrome_stable_dist_dir(Some(app))
        .ok_or_else(|| "Could not resolve the app data directory".to_string())?;

    let needs_copy = match (fs::read(source.join("manifest.json")), fs::read(stable.join("manifest.json"))) {
        (Ok(src_manifest), Ok(dst_manifest)) => src_manifest != dst_manifest,
        _ => true,
    };
    if needs_copy {
        if stable.exists() {
            fs::remove_dir_all(&stable).map_err(|error| error.to_string())?;
        }
        copy_dir_recursive(&source, &stable).map_err(|error| error.to_string())?;
    }
    Ok(stable)
}

#[tauri::command]
fn sync_chrome_extension_dist_command(app: AppHandle) -> Result<String, String> {
    sync_chrome_extension_dist(&app).map(|path| path.to_string_lossy().to_string())
}

fn safari_container_app_path(app: Option<&AppHandle>) -> PathBuf {
    embedded_safari_extension_path()
        .or_else(|| bundled_resource_path(app, Path::new("KIRA Safari Extension.appex")))
        .or_else(|| bundled_resource_named_dir(app, "KIRA Safari Extension.appex"))
        .unwrap_or_else(|| {
        workspace_root_guess()
        .join("apps")
        .join("extension")
        .join("safari")
        .join("DerivedData")
        .join("Build")
        .join("Products")
        .join("Release")
        .join("KIRA Safari Extension.appex")
    })
}

#[cfg(target_os = "macos")]
fn embedded_safari_extension_path() -> Option<PathBuf> {
    let executable = std::env::current_exe().ok()?;
    let contents_dir = executable.parent()?.parent()?;
    let extension = contents_dir
        .join("PlugIns")
        .join("KIRA Safari Extension.appex");
    extension.exists().then_some(extension)
}

#[cfg(not(target_os = "macos"))]
fn embedded_safari_extension_path() -> Option<PathBuf> {
    None
}

#[cfg(target_os = "macos")]
fn register_safari_extension() -> Result<(), String> {
    let extension = embedded_safari_extension_path()
        .ok_or_else(|| "Bundled KIRA Safari extension was not found".to_string())?;
    let output = Command::new("pluginkit")
        .arg("-a")
        .arg(&extension)
        .output()
        .map_err(|error| format!("Could not register KIRA Safari extension: {error}"))?;
    if output.status.success() {
        Ok(())
    } else {
        Err(format!(
            "Safari extension registration failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ))
    }
}

#[cfg(not(target_os = "macos"))]
fn register_safari_extension() -> Result<(), String> {
    Err("Safari extensions are available on macOS only".to_string())
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

// The user's persona, shared with other creative tools (user decision
// 2026-11-08). Only this one file: Kira never lists or reads anything else
// under ~/.creative-os.
fn user_persona_path() -> Result<PathBuf, String> {
    home_dir()
        .map(|home| home.join(".creative-os").join("user.json"))
        .ok_or_else(|| "Home folder not found".to_string())
}

#[tauri::command]
fn read_user_persona() -> Result<Option<serde_json::Value>, String> {
    let path = user_persona_path()?;
    if !path.exists() {
        return Ok(None);
    }
    let text = fs::read_to_string(&path).map_err(|error| format!("Could not read user.json: {error}"))?;
    serde_json::from_str(&text)
        .map(Some)
        .map_err(|error| format!("user.json is not valid JSON: {error}"))
}

#[tauri::command]
fn save_user_persona(persona: serde_json::Value) -> Result<(), String> {
    if !persona.is_object() {
        return Err("Persona must be a JSON object".to_string());
    }
    let path = user_persona_path()?;
    let folder = path.parent().ok_or_else(|| "Invalid persona path".to_string())?;
    fs::create_dir_all(folder).map_err(|error| format!("Could not create ~/.creative-os: {error}"))?;
    let text = serde_json::to_string_pretty(&persona).map_err(|error| error.to_string())?;
    // Write beside it, then rename, so another tool never reads half a file.
    let temporary = folder.join("user.json.kira-tmp");
    fs::write(&temporary, format!("{text}\n")).map_err(|error| format!("Could not write user.json: {error}"))?;
    fs::rename(&temporary, &path).map_err(|error| format!("Could not save user.json: {error}"))
}

// docs/research/2026-11-09-pinterest-similar-flow.md §3.3/§3.4 + Orchestrator
// decision: open_system_target's existing callers only ever pass our own
// constant strings (chrome://extensions, a packaged extension path, ...),
// never anything derived from node data — widening either of them to accept
// an arbitrary URL would turn a closed list into "open anything". This gets
// its own narrow check instead: https only, no embedded credentials, no
// explicit port, and a host that is exactly `pinterest.<tld>` or a
// subdomain of it. The host check is label-exact (not a substring match) so
// a lookalike like `evilpinterest.com` or a suffix trick like
// `pinterest.com.evil.com` (a subdomain of evil.com, not of pinterest.com)
// both fail it.
fn validate_pinterest_url(raw: &str) -> Result<(), String> {
    let parsed = url::Url::parse(raw).map_err(|_| "Invalid URL".to_string())?;
    if parsed.scheme() != "https" {
        return Err("Only https URLs are allowed".to_string());
    }
    if !parsed.username().is_empty() || parsed.password().is_some() {
        return Err("URL must not contain credentials".to_string());
    }
    if parsed.port().is_some() {
        return Err("URL must not specify a port".to_string());
    }
    let host = parsed.host_str().ok_or_else(|| "URL has no host".to_string())?;
    // Exactly pinterest.com or a subdomain of it, matching the only URLs the
    // frontend builds (buildPinterestSimilarUrl). Not "pinterest.<any tld>":
    // a cheap lookalike TLD is not Pinterest's to vouch for.
    let host = host.to_ascii_lowercase();
    let is_pinterest_host = host == "pinterest.com" || host.ends_with(".pinterest.com");
    if !is_pinterest_host {
        return Err(format!("Host not allowed: {host}"));
    }
    Ok(())
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    validate_pinterest_url(&url)?;
    open_system_target(&url)
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

// A capture payload is small (URL, title, a few tags) — this just has to be
// well above any realistic size, not a real upload limit. Bounds the read
// loop below so a lying or malicious Content-Length can't hold a thread
// reading forever / blow up memory; a body that genuinely exceeds this gets
// read up to the cap, fails JSON parsing, and comes back as a 400 like any
// other malformed body (research 2026-11-09 §5#1 only measured ~70KB).
const CAPTURE_MAX_BODY_BYTES: usize = 5 * 1024 * 1024;
const CAPTURE_READ_CHUNK: usize = 8192;

fn handle_capture_stream(mut stream: TcpStream, app: &AppHandle) -> Result<(), String> {
    // The read loop below can block on a connection that opens but trickles
    // data (or none) — previously a single read() couldn't hang this way, so
    // there was no timeout; now there has to be one.
    stream
        .set_read_timeout(Some(Duration::from_secs(5)))
        .map_err(|error| error.to_string())?;
    let request = read_capture_http_request(&mut stream)?;
    let headers = request.split("\r\n\r\n").next().unwrap_or_default();
    let origin = extract_header_value(headers, "Origin");

    // research 2026-11-09 §7: ACAO: * plus no auth meant any webpage that
    // could reach loopback could read /context (file + node titles) or push
    // nodes via /capture. Only the browser extension's own origins (or no
    // Origin at all — curl, same-process tooling) get served; anyone else
    // gets a bare 403 with no payload, matching "/context trả gì cho origin
    // lạ" = nothing.
    if !origin_is_allowed(origin) {
        stream
            .write_all(http_response(403, "Forbidden", None, "{\"ok\":false,\"error\":\"origin not allowed\"}").as_bytes())
            .map_err(|error| error.to_string())?;
        return Ok(());
    }
    // Reflects the exact Origin back (the standard allow-listing pattern —
    // ACAO can't be "*" once requests are being distinguished by origin).
    // None here means no Origin header was sent at all, so there is nothing
    // to reflect and the header is simply omitted.
    let allow_origin = origin;

    let response = match parse_capture_http_request(&request) {
        CaptureHttpRequest::Options => http_response(204, "No Content", allow_origin, ""),
        CaptureHttpRequest::Context => {
            let state = app.state::<CaptureContextState>();
            let context = state
                .0
                .lock()
                .map(|value| value.clone())
                .unwrap_or_else(|_| "{}".to_string());
            http_response(200, "OK", allow_origin, &context)
        }
        CaptureHttpRequest::Post(payload) => match validate_capture_payload(&payload) {
            // Only acked once the payload is something parseKiraCapturePayload
            // (main.tsx) will actually accept — a prior version of this
            // handler emitted and replied 200 unconditionally, so a dropped
            // data: URL, a missing title, or truncated JSON (below) all came
            // back as success and the extension showed "Saved" for a capture
            // that silently went nowhere (research 2026-11-09 §5#1).
            Ok(()) => {
                app.emit(CAPTURE_EVENT, payload)
                    .map_err(|error| error.to_string())?;
                http_response(200, "OK", allow_origin, "{\"ok\":true}")
            }
            Err(reason) => http_response(
                400,
                "Bad Request",
                allow_origin,
                &format!("{{\"ok\":false,\"error\":{}}}", json_quote(&reason)),
            ),
        },
        CaptureHttpRequest::ConnectionPost(payload) => match validate_connection_payload(&payload) {
            Ok(()) => {
                app.emit(CONNECTION_EVENT, payload)
                    .map_err(|error| error.to_string())?;
                http_response(200, "OK", allow_origin, "{\"ok\":true}")
            }
            Err(reason) => http_response(
                400,
                "Bad Request",
                allow_origin,
                &format!("{{\"ok\":false,\"error\":{}}}", json_quote(&reason)),
            ),
        },
        CaptureHttpRequest::Invalid => http_response(404, "Not Found", allow_origin, "{\"ok\":false}"),
    };

    stream
        .write_all(response.as_bytes())
        .map_err(|error| error.to_string())
}

// Reads headers, then the declared Content-Length worth of body (if any),
// looping stream.read() until satisfied or the connection closes — the
// previous implementation read once into a fixed 64KB buffer, so a request
// delivered across two TCP writes (headers then body) came back 404 with an
// empty body, and a body over 64KB was silently truncated into broken JSON
// (research 2026-11-09 §5#1, measured at both ~70KB and a split write).
fn read_capture_http_request(stream: &mut TcpStream) -> Result<String, String> {
    let mut buffer: Vec<u8> = Vec::new();
    let mut chunk = [0_u8; CAPTURE_READ_CHUNK];

    let headers_end = loop {
        if let Some(pos) = find_subslice(&buffer, b"\r\n\r\n") {
            break pos + 4;
        }
        if buffer.len() > CAPTURE_MAX_BODY_BYTES {
            return Ok(String::from_utf8_lossy(&buffer).into_owned());
        }
        let read = stream.read(&mut chunk).map_err(|error| error.to_string())?;
        if read == 0 {
            // Closed before headers completed — whatever arrived is all there is.
            return Ok(String::from_utf8_lossy(&buffer).into_owned());
        }
        buffer.extend_from_slice(&chunk[..read]);
    };

    let headers = String::from_utf8_lossy(&buffer[..headers_end]).into_owned();
    let content_length = extract_header_value(&headers, "Content-Length")
        .and_then(|value| value.trim().parse::<usize>().ok())
        .unwrap_or(0)
        .min(CAPTURE_MAX_BODY_BYTES);

    while buffer.len() < headers_end + content_length {
        let read = stream.read(&mut chunk).map_err(|error| error.to_string())?;
        if read == 0 {
            break; // closed early; parse/validate whatever body arrived
        }
        buffer.extend_from_slice(&chunk[..read]);
    }

    Ok(String::from_utf8_lossy(&buffer).into_owned())
}

fn find_subslice(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    haystack
        .windows(needle.len())
        .position(|window| window == needle)
}

fn extract_header_value<'a>(headers: &'a str, name: &str) -> Option<&'a str> {
    headers.lines().find_map(|line| {
        let (key, value) = line.split_once(':')?;
        key.trim().eq_ignore_ascii_case(name).then(|| value.trim())
    })
}

fn origin_is_allowed(origin: Option<&str>) -> bool {
    match origin {
        None => true,
        Some(value) => {
            value.starts_with("chrome-extension://") || value.starts_with("safari-web-extension://")
        }
    }
}

enum CaptureHttpRequest {
    Options,
    Context,
    Post(String),
    ConnectionPost(String),
    Invalid,
}

fn parse_capture_http_request(request: &str) -> CaptureHttpRequest {
    let mut parts = request.splitn(2, "\r\n\r\n");
    let headers = parts.next().unwrap_or_default();
    let body = parts.next().unwrap_or_default().trim();

    if headers.starts_with("OPTIONS /capture ")
        || headers.starts_with("OPTIONS /context ")
        || headers.starts_with("OPTIONS /connection ")
    {
        return CaptureHttpRequest::Options;
    }
    if headers.starts_with("GET /context ") {
        return CaptureHttpRequest::Context;
    }
    if headers.starts_with("POST /connection ") {
        if body.is_empty() {
            return CaptureHttpRequest::Invalid;
        }
        return CaptureHttpRequest::ConnectionPost(body.to_string());
    }
    if !headers.starts_with("POST /capture ") || body.is_empty() {
        return CaptureHttpRequest::Invalid;
    }

    CaptureHttpRequest::Post(body.to_string())
}

// Mirrors parseKiraCapturePayload's structural checks (main.tsx) — kept in
// sync by hand, since the HTTP response has to be synchronous and
// app.emit() is fire-and-forget with no reply channel back from the
// webview. Duplicate-URL rejection stays frontend-only and out of scope
// here: that's an intentional silent no-op (main.tsx:3490), not a malformed
// payload, so it still acks 200 same as before.
fn validate_capture_payload(body: &str) -> Result<(), String> {
    let value: serde_json::Value =
        serde_json::from_str(body).map_err(|_| "invalid JSON".to_string())?;
    if value.get("kiraCapture").and_then(serde_json::Value::as_i64) != Some(1) {
        return Err("missing kiraCapture marker".to_string());
    }
    let kind = value.get("kind").and_then(serde_json::Value::as_str);
    if kind != Some("image") && kind != Some("page") {
        return Err("kind must be \"image\" or \"page\"".to_string());
    }
    let url = value
        .get("url")
        .and_then(serde_json::Value::as_str)
        .ok_or_else(|| "missing url".to_string())?;
    if !is_http_or_https_url(url) {
        return Err("url must be http(s): data: and blob: URLs aren't accepted yet".to_string());
    }
    if value.get("title").and_then(serde_json::Value::as_str).is_none() {
        return Err("missing title".to_string());
    }
    if value.get("source").and_then(serde_json::Value::as_str).is_none() {
        return Err("missing source".to_string());
    }
    Ok(())
}

// docs/research/2026-11-09-pinterest-similar-flow.md §A + Orchestrator
// decision 2026-11-11: the extension sends nothing but this one bit, never a
// cookie, URL, name, or picture (CLAUDE.md "Ràng buộc đã chốt", this task's
// own hard constraints) — so the schema is as narrow as the payload itself.
// Exactly two fields: `service` from a closed allowlist, room for a second
// connected service later without widening what any sender on loopback can
// write under an arbitrary key, and a plain bool. An extra field riding
// along on an otherwise-valid payload is rejected too, not silently
// ignored, so a sender that drifts from this shape finds out instead of a
// partial write landing quietly.
const KNOWN_CONNECTION_SERVICES: &[&str] = &["pinterest"];

fn validate_connection_payload(body: &str) -> Result<(), String> {
    let value: serde_json::Value =
        serde_json::from_str(body).map_err(|_| "invalid JSON".to_string())?;
    let object = value
        .as_object()
        .ok_or_else(|| "payload must be a JSON object".to_string())?;
    if let Some(unknown) = object
        .keys()
        .find(|key| key.as_str() != "service" && key.as_str() != "loggedIn")
    {
        return Err(format!("unknown field: {unknown}"));
    }
    let service = object
        .get("service")
        .and_then(serde_json::Value::as_str)
        .ok_or_else(|| "missing service".to_string())?;
    if !KNOWN_CONNECTION_SERVICES.contains(&service) {
        return Err(format!("unsupported service: {service}"));
    }
    if !matches!(object.get("loggedIn"), Some(serde_json::Value::Bool(_))) {
        return Err("loggedIn must be a boolean".to_string());
    }
    Ok(())
}

fn is_http_or_https_url(value: &str) -> bool {
    let lower = value.trim().to_ascii_lowercase();
    let rest = lower
        .strip_prefix("http://")
        .or_else(|| lower.strip_prefix("https://"));
    rest.is_some_and(|after| !after.is_empty())
}

// research 2026-11-09-visual-explore Pha 0: the native window's origin is
// tauri://localhost, so window.fetch() against a third-party CDN with no
// Access-Control-Allow-Origin header (Instagram, Behance, most sites — only
// a few, like picsum.photos's ACAO: *, happen to work) is blocked by the
// WebView's own CORS enforcement before the frontend ever sees a response.
// A native request has no such origin to police. Async (not a plain sync
// command) for the same reason run_apple_vision_ocr is: this can take
// seconds and must not freeze the window while it runs.
const CAPTURE_IMAGE_FETCH_MAX_BYTES: u64 = 25 * 1024 * 1024;
const CAPTURE_IMAGE_FETCH_TIMEOUT_SECS: u64 = 20;
const CAPTURE_IMAGE_FETCH_CHUNK_BYTES: usize = 65536;

#[derive(Debug, Serialize)]
struct CaptureImageBytes {
    mime: String,
    base64: String,
}

#[tauri::command]
async fn fetch_capture_image(url: String) -> Result<CaptureImageBytes, String> {
    // research 2026-11-09-visual-explore: calling fetch_capture_image_blocking
    // directly here used to build+drop a reqwest::blocking::Client while this
    // async command's future was being polled on a tokio worker. Dropping
    // that client panics ("Cannot drop a runtime in a context where blocking
    // is not allowed"), and the panicked task never resolves or rejects the
    // JS invoke() promise, so the download spinner hung forever. spawn_blocking
    // runs the blocking client on tokio's dedicated blocking-thread pool
    // instead, outside any worker's no-blocking context.
    tauri::async_runtime::spawn_blocking(move || fetch_capture_image_blocking(&url))
        .await
        .map_err(|error| format!("fetch_capture_image task failed: {error}"))?
}

fn fetch_capture_image_blocking(url: &str) -> Result<CaptureImageBytes, String> {
    if !is_http_or_https_url(url) {
        return Err("url must be http(s)".to_string());
    }

    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(CAPTURE_IMAGE_FETCH_TIMEOUT_SECS))
        .build()
        .map_err(|error| format!("unable to build HTTP client: {error}"))?;
    // reqwest::blocking::Client has no cookie store unless .cookie_store(true)
    // is set on the builder, so this request carries none by default.
    let mut response = client
        .get(url)
        .send()
        .map_err(|error| format!("could not reach {url}: {error}"))?;
    if !response.status().is_success() {
        return Err(format!("{url} returned HTTP {}", response.status()));
    }

    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("");
    let mime = content_type
        .split(';')
        .next()
        .unwrap_or("")
        .trim()
        .to_ascii_lowercase();
    if !mime.starts_with("image/") {
        return Err(format!("{url} is not an image (content-type: {content_type})"));
    }

    if let Some(length) = response.content_length() {
        if length > CAPTURE_IMAGE_FETCH_MAX_BYTES {
            return Err(format!(
                "{url} is {length} bytes, over the {CAPTURE_IMAGE_FETCH_MAX_BYTES}-byte limit"
            ));
        }
    }

    let mut buffer: Vec<u8> = Vec::new();
    let mut chunk = [0_u8; CAPTURE_IMAGE_FETCH_CHUNK_BYTES];
    loop {
        let read = response
            .read(&mut chunk)
            .map_err(|error| format!("error downloading {url}: {error}"))?;
        if read == 0 {
            break;
        }
        buffer.extend_from_slice(&chunk[..read]);
        if buffer.len() as u64 > CAPTURE_IMAGE_FETCH_MAX_BYTES {
            return Err(format!(
                "{url} exceeded the {CAPTURE_IMAGE_FETCH_MAX_BYTES}-byte limit while downloading"
            ));
        }
    }
    if buffer.is_empty() {
        return Err(format!("{url} returned an empty body"));
    }

    Ok(CaptureImageBytes {
        mime,
        base64: BASE64.encode(&buffer),
    })
}

fn json_quote(value: &str) -> String {
    serde_json::to_string(value).unwrap_or_else(|_| "\"invalid payload\"".to_string())
}

fn http_response(status: u16, reason: &str, allow_origin: Option<&str>, body: &str) -> String {
    let acao = allow_origin
        .map(|origin| format!("Access-Control-Allow-Origin: {origin}\r\n"))
        .unwrap_or_default();
    format!(
        "HTTP/1.1 {status} {reason}\r\n{acao}Access-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{body}",
        body.len()
    )
}

fn project_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join(PROJECT_DIR_NAME))
        .map_err(|error| error.to_string())
}

// The window is opaque (see tauri.conf.json: `transparent: false`,
// `backgroundColor`), not the desktop-vibrancy chrome it used to be — this
// only keeps the overlay title bar (traffic lights floating over the
// topbar, already implied by `titleBarStyle: Overlay` in config) and shadow
// explicit rather than relying on Tauri's own setup ordering.
#[cfg(target_os = "macos")]
fn configure_native_macos_window(window: &tauri::WebviewWindow) -> Result<(), String> {
    let ns_window = window.ns_window().map_err(|error| error.to_string())?;

    unsafe {
        let ns_window = &*(ns_window.cast::<NSWindow>());
        ns_window.setTitlebarAppearsTransparent(true);
        ns_window.setHasShadow(true);
    }

    Ok(())
}

// Holding Space arms a canvas pan, and the frontend shows an open hand for it
// through CSS. In the macOS app that hand never appeared while the pointer was
// still: WebKit treats a Space keydown as typing and hides the pointer until the
// mouse moves (+[NSCursor setHiddenUntilMouseMoves:]), so pressing Space made the
// pointer vanish instead. Captured with the pointer in frame at 442b979; the
// browser build does not do this.
//
// Two causes, two parts:
// - The arming keydown. WebKit hides the pointer for it asynchronously, after its
//   own handling of the key comes back, so set_space_pan_cursor re-shows the open
//   hand once immediately and twice more after that window.
// - Auto-repeat. A real held key sends ~30 more keydowns a second, and each one
//   would hide the pointer again. install_space_repeat_filter drops them before
//   WKWebView sees them while a pan is armed; the pan needs only the first
//   keydown and the keyup, which both still go through.
// The next mouse move hands the cursor back to WebKit, whose CSS cursor for an
// armed canvas is the same open hand, so the two never disagree.
#[cfg(target_os = "macos")]
static SPACE_PAN_ARMED: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);


#[cfg(target_os = "macos")]
fn install_space_repeat_filter() {
    use objc2_app_kit::{NSEvent, NSEventMask};
    use std::ptr::NonNull;
    use std::sync::atomic::Ordering;

    const KVK_SPACE: u16 = 49;
    const KVK_ESCAPE: u16 = 53;
    let block = block2::RcBlock::new(|event: NonNull<NSEvent>| -> *mut NSEvent {
        // The mask is key-down only, so keyCode is safe to read here.
        let key = unsafe { event.as_ref() };
        // Only while a pan is armed. Armed never happens with the caret in a text
        // field (blocksSpacePan in main.tsx), so typed spaces are never touched,
        // and the first keydown and the keyup still go through: the pan needs
        // exactly those two and nothing listens to the repeats.
        if SPACE_PAN_ARMED.load(Ordering::Relaxed) && key.keyCode() == KVK_SPACE && key.isARepeat() {
            return std::ptr::null_mut();
        }
        if key.keyCode() == KVK_ESCAPE && route_escape_to_webview(key) {
            return std::ptr::null_mut();
        }
        event.as_ptr()
    });
    let monitor = unsafe { NSEvent::addLocalMonitorForEventsMatchingMask_handler(NSEventMask::KeyDown, &block) };
    // One monitor for the life of the app. AppKit keeps its own reference; this
    // just stops our handle from being released, which is harmless either way.
    std::mem::forget(monitor);
}

// Escape never reached the page as a keydown in the macOS app, so nothing that
// closes on Escape (dialogs, menus, the onboarding overlay) did; the keyup still
// arrived, and every other key worked. For the key window AppKit offers a plain
// Escape to the key-equivalent path first (it is the Cancel-button key), and it
// never came back out as a keydown to the page. Handing it straight to the web
// view's keyDown: is what AppKit does for every other key, so WebKit, input
// methods and the page all see it the normal way. Only for the web view: a
// native control holding focus keeps AppKit's own Escape handling.
//
// WebKit re-sends a key the page did not handle back through the app, and that
// copy comes through this monitor again. It is the same event, so it is let
// through untouched; routing it again would feed it back into the page.
#[cfg(target_os = "macos")]
static LAST_ROUTED_ESCAPE: std::sync::Mutex<f64> = std::sync::Mutex::new(-1.0);

#[cfg(target_os = "macos")]
fn route_escape_to_webview(event: &objc2_app_kit::NSEvent) -> bool {
    use objc2_app_kit::NSEventModifierFlags;

    let Some(mtm) = objc2::MainThreadMarker::new() else { return false };
    let chord = NSEventModifierFlags::Command | NSEventModifierFlags::Control | NSEventModifierFlags::Option;
    if event.modifierFlags().intersects(chord) {
        return false;
    }
    let Some(window) = event.window(mtm) else { return false };
    let Some(responder) = window.firstResponder() else { return false };
    // The web view's class is a KVO subclass of wry's WKWebView subclass, so
    // match on the ancestry, not the name.
    let mut class = Some(responder.class());
    let mut is_web_view = false;
    while let Some(current) = class {
        if current.name().to_bytes() == b"WKWebView" {
            is_web_view = true;
            break;
        }
        class = current.superclass();
    }
    if !is_web_view {
        return false;
    }
    let stamp = event.timestamp();
    {
        let Ok(mut last) = LAST_ROUTED_ESCAPE.lock() else { return false };
        if *last == stamp {
            return false;
        }
        *last = stamp;
    }
    responder.keyDown(event);
    true
}

#[cfg(target_os = "macos")]
fn show_space_pan_cursor(active: bool) {
    objc2_app_kit::NSCursor::setHiddenUntilMouseMoves(false);
    if active {
        objc2_app_kit::NSCursor::openHandCursor().set();
    } else {
        objc2_app_kit::NSCursor::arrowCursor().set();
    }
}

#[tauri::command]
fn set_space_pan_cursor(app: tauri::AppHandle, active: bool) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use std::sync::atomic::Ordering;
        SPACE_PAN_ARMED.store(active, Ordering::Relaxed);
        app.run_on_main_thread(move || show_space_pan_cursor(active))
            .map_err(|error| error.to_string())?;
        if active {
            // WebKit hides the pointer for the arming keydown asynchronously, once
            // its own handling of that key comes back, so the call above can land
            // before the hide and be undone by it. Measured in the debug bundle:
            // the command ran 9ms after the keydown and the pointer still stayed
            // hidden for the whole hold; re-asserting after that window kept the
            // open hand on screen. Two late re-asserts cover it. Each is skipped
            // once the pan is released, or once a mouse button is down: a drag has
            // started, the mouse is moving, and WebKit's CSS closed hand is right.
            let later = app.clone();
            std::thread::spawn(move || {
                for wait_ms in [60u64, 190] {
                    std::thread::sleep(std::time::Duration::from_millis(wait_ms));
                    if !SPACE_PAN_ARMED.load(Ordering::Relaxed) {
                        return;
                    }
                    let _ = later.run_on_main_thread(|| {
                        if SPACE_PAN_ARMED.load(Ordering::Relaxed)
                            && objc2_app_kit::NSEvent::pressedMouseButtons() == 0
                        {
                            show_space_pan_cursor(true);
                        }
                    });
                }
            });
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app, active);
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
            // setup runs on the main thread, which AppKit's event monitor wants.
            #[cfg(target_os = "macos")]
            install_space_repeat_filter();
            start_capture_server(app.handle().clone());
            #[cfg(target_os = "macos")]
            if let Err(error) = register_safari_extension() {
                eprintln!("KIRA Safari extension registration skipped: {error}");
            }
            if let Err(error) = sync_chrome_extension_dist(&app.handle().clone()) {
                eprintln!("KIRA Chrome extension dist sync skipped: {error}");
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            set_space_pan_cursor,
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
            read_user_persona,
            save_user_persona,
            delete_provider_secret,
            test_ai_provider,
            list_ai_models,
            generate_ai_text,
            generate_ai_vision,
            get_extension_install_status,
            open_extension_install_target,
            open_external_url,
            sync_chrome_extension_dist_command,
            export_outline_markdown,
            export_outline_html,
            export_contact_sheet_html,
            export_slideshow_html,
            export_slideshow_pptx,
            update_capture_context,
            fetch_capture_image,
            codex_login,
            codex_cancel_login,
            codex_logout,
            claude_code_open_login_terminal
        ])
        .run(tauri::generate_context!())
        .expect("error while running KIRA desktop shell");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn image_data_url_splitter_returns_mime_and_payload() {
        let (mime_type, payload) = split_data_url("data:image/png;base64,aGVsbG8=")
            .expect("split valid image data URL");

        assert_eq!(mime_type, "image/png");
        assert_eq!(payload, "aGVsbG8=");
    }

    #[test]
    fn image_data_url_splitter_rejects_non_base64_input() {
        assert!(split_data_url("https://example.com/image.png").is_err());
        assert!(split_data_url("data:image/png,not-base64").is_err());
    }

    #[test]
    fn pinterest_url_allows_apex_and_www() {
        assert!(validate_pinterest_url("https://pinterest.com/pin/123456789012345678/").is_ok());
        assert!(validate_pinterest_url("https://www.pinterest.com/search/pins/?q=warm+metal").is_ok());
    }

    #[test]
    fn pinterest_url_allows_subdomains_only_on_com() {
        assert!(validate_pinterest_url("https://help.pinterest.com/en").is_ok());
        assert!(validate_pinterest_url("https://WWW.Pinterest.com/pin/1/").is_ok());
        // Other TLDs are not on the allowlist: the frontend never builds them.
        assert!(validate_pinterest_url("https://pinterest.de/pin/1/").is_err());
        assert!(validate_pinterest_url("https://pinterest.xyz/").is_err());
    }

    #[test]
    fn pinterest_url_rejects_non_https_scheme() {
        assert!(validate_pinterest_url("http://pinterest.com/pin/1/").is_err());
        assert!(validate_pinterest_url("file:///etc/passwd").is_err());
        assert!(validate_pinterest_url("javascript:alert(1)").is_err());
    }

    #[test]
    fn pinterest_url_rejects_lookalike_hosts() {
        // A different domain that merely contains "pinterest" in a label —
        // not a subdomain of pinterest.<tld>.
        assert!(validate_pinterest_url("https://evilpinterest.com/").is_err());
        // A subdomain of evil.com, not of pinterest.com, despite the string
        // "pinterest.com" appearing as a prefix of the host.
        assert!(validate_pinterest_url("https://pinterest.com.evil.com/").is_err());
        assert!(validate_pinterest_url("https://pinterest.evil.com/").is_err());
        assert!(validate_pinterest_url("https://notpinterest.io/").is_err());
    }

    #[test]
    fn pinterest_url_rejects_credentials_and_explicit_port() {
        assert!(validate_pinterest_url("https://user:pass@pinterest.com/").is_err());
        assert!(validate_pinterest_url("https://pinterest.com:8443/").is_err());
        // :443 is https's default port — url::Url normalizes it away, so
        // `.port()` returns None here exactly as it would with no port
        // written at all. Not a case this check needs to (or can) reject.
        assert!(validate_pinterest_url("https://pinterest.com:443/").is_ok());
    }

    #[test]
    fn pinterest_url_rejects_malformed_input() {
        assert!(validate_pinterest_url("not a url").is_err());
        assert!(validate_pinterest_url("").is_err());
    }

    #[test]
    fn lock_ignoring_poison_recovers_value_after_a_poisoning_panic() {
        let mutex = Arc::new(Mutex::new(41));

        // Poison the mutex from another thread: panic while the lock is held.
        let poisoner = Arc::clone(&mutex);
        let result = std::thread::spawn(move || {
            let mut guard = poisoner.lock().unwrap();
            *guard += 1;
            panic!("simulated panic while holding the lock");
        })
        .join();
        assert!(result.is_err(), "the spawned thread should have panicked");
        assert!(mutex.is_poisoned(), "the mutex should now be poisoned");

        // A bare `.lock().unwrap()` would panic again here; the helper must not.
        let mut guard = lock_ignoring_poison(&mutex);
        assert_eq!(*guard, 42, "the write made before the panic must still be visible");
        *guard = 100;
        drop(guard);
        assert_eq!(*lock_ignoring_poison(&mutex), 100);
    }

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
            project: serde_json::json!({"title": "Roundtrip", "kind": "ideaboard"}),
            appearance: serde_json::json!({"colorMode": "light", "accentColor": "#cc5500"}),
            ideas: vec![IdeaRecord {
                id: "idea-a".to_string(),
                title: "Idea A".to_string(),
                body: None,
                content: Some("Body".to_string()),
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
                variant: Some("sticker".to_string()),
                ai_excluded: Some(true),
            }],
            images: vec![ReferenceRecord {
                id: "img-a".to_string(),
                title: "Reference A".to_string(),
                content: None,
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
                ai_excluded: Some(true),
                tags_pinned: Some(true),
                palette_pinned: Some(false),
                block_order: Some(vec!["palette".to_string(), "tags".to_string()]),
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
                label: Some("supports".to_string()),
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
            ai_panel: serde_json::json!({
                "schemaVersion": 1,
                "threads": [{"id": "thread-a", "title": "Thread A"}]
            }),
            slides_config: serde_json::json!({"aspectRatio": "16:9"}),
        };

        write_snapshot(&mut conn, &snapshot, &project_dir).expect("write snapshot");
        let restored = read_snapshot(&conn).expect("read snapshot");

        assert_eq!(restored.version, 2);
        assert_eq!(restored.ai_panel["threads"][0]["id"], "thread-a");
        assert_eq!(restored.slides_config["aspectRatio"], "16:9");
        assert_eq!(restored.project["title"], "Roundtrip");
        assert_eq!(restored.appearance["colorMode"], "light");
        assert_eq!(restored.ideas[0].variant.as_deref(), Some("sticker"));
        assert_eq!(restored.ideas[0].ai_excluded, Some(true));
        assert_eq!(restored.images[0].ai_excluded, Some(true));
        assert_eq!(restored.images[0].tags_pinned, Some(true));
        assert_eq!(restored.images[0].palette_pinned, Some(false));
        assert_eq!(
            restored.images[0].block_order,
            Some(vec!["palette".to_string(), "tags".to_string()])
        );
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
        assert_eq!(migration_count, 11);

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
    fn claude_code_bin_discovery_finds_executable_in_search_dirs() {
        let id = timestamp_millis();
        let dir = std::env::temp_dir().join(format!("kira-claude-bin-test-{id}"));
        fs::create_dir_all(&dir).expect("create dir");
        let bin = dir.join("claude");
        fs::write(&bin, b"stub").expect("write stub");

        let unrelated_dir = std::env::temp_dir().join(format!("kira-claude-bin-test-miss-{id}"));
        let discovered = find_bin_in_dirs(&[unrelated_dir, dir.clone()], "claude");

        assert_eq!(discovered, Some(bin));
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn claude_code_bin_discovery_returns_none_when_not_found() {
        let id = timestamp_millis();
        let dir = std::env::temp_dir().join(format!("kira-claude-bin-test-empty-{id}"));
        assert_eq!(find_bin_in_dirs(&[dir], "claude"), None);
    }

    #[test]
    fn codex_bin_discovery_finds_executable_in_search_dirs() {
        let id = timestamp_millis();
        let dir = std::env::temp_dir().join(format!("kira-codex-bin-test-{id}"));
        fs::create_dir_all(&dir).expect("create dir");
        let bin = dir.join("codex");
        fs::write(&bin, b"stub").expect("write stub");

        let unrelated_dir = std::env::temp_dir().join(format!("kira-codex-bin-test-miss-{id}"));
        let discovered = find_bin_in_dirs(&[unrelated_dir, dir.clone()], "codex");

        assert_eq!(discovered, Some(bin));
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn codex_bin_discovery_returns_none_when_not_found() {
        let id = timestamp_millis();
        let dir = std::env::temp_dir().join(format!("kira-codex-bin-test-empty-{id}"));
        assert_eq!(find_bin_in_dirs(&[dir], "codex"), None);
    }

    // Shape of Chrome's `Preferences` JSON for a matched unpacked extension —
    // `extensions.settings.<id>` with `state: 0/1` (disabled/enabled). Field
    // name only, not exhaustive of every key Chrome actually writes there.
    #[test]
    fn extension_disabled_in_preferences_detects_state_zero_by_path() {
        let json = r#"{"extensions":{"settings":{"abcdefghijklmnop":{"path":"/Users/x/Library/Application Support/KIRA/extension/chrome-dist","state":0,"manifest":{"name":"KIRA"}}}}}"#;
        assert!(extension_disabled_in_preferences(
            json,
            "/Users/x/Library/Application Support/KIRA/extension/chrome-dist"
        ));
    }

    #[test]
    fn extension_disabled_in_preferences_false_when_enabled() {
        let json = r#"{"extensions":{"settings":{"abcdefghijklmnop":{"path":"/some/dist","state":1,"manifest":{"name":"KIRA"}}}}}"#;
        assert!(!extension_disabled_in_preferences(json, "/some/dist"));
    }

    #[test]
    fn extension_disabled_in_preferences_false_when_no_match() {
        let json = r#"{"extensions":{"settings":{"other":{"path":"/unrelated","state":0}}}}"#;
        assert!(!extension_disabled_in_preferences(json, "/some/dist"));
    }

    #[test]
    fn extension_disabled_in_preferences_false_on_malformed_json() {
        assert!(!extension_disabled_in_preferences("not json", "/some/dist"));
    }

    // The sign-in command interpolates a resolved binary path into an AppleScript string that
    // is itself a shell command line, so the path crosses two layers of quoting. `~/.local/bin`
    // is the common install location and is plain, but "Application Support" paths are not.
    #[test]
    fn shell_single_quote_survives_spaces_and_quotes() {
        assert_eq!(shell_single_quote("/Users/me/.local/bin/claude"), "'/Users/me/.local/bin/claude'");
        assert_eq!(
            shell_single_quote("/Volumes/My Disk/App Code/claude"),
            "'/Volumes/My Disk/App Code/claude'"
        );
        // A single quote in the path has to terminate, escape, and reopen the quoted run,
        // otherwise the rest of the path would leak out of the string as shell tokens.
        assert_eq!(shell_single_quote("/tmp/it's/claude"), r"'/tmp/it'\''s/claude'");
    }

    // `claude auth status` output shape, verified against the real installed binary:
    // `{"loggedIn": bool, "authMethod": "...", "email": "...", ...}` on stdout, exit 0 either way.
    #[test]
    fn claude_code_status_parses_real_cli_json_shape() {
        let json = br#"{"loggedIn":true,"authMethod":"claude.ai","apiProvider":"firstParty","email":"user@example.com","orgId":"org_1","orgName":"Example Org","subscriptionType":"pro"}"#;
        let value: serde_json::Value = serde_json::from_slice(json).expect("parse");
        let logged_in = value.get("loggedIn").and_then(|v| v.as_bool()).unwrap_or(false);
        let account = value.get("email").and_then(|v| v.as_str()).map(ToString::to_string);
        assert!(logged_in);
        assert_eq!(account.as_deref(), Some("user@example.com"));
    }

    #[test]
    fn generate_claude_code_text_extracts_result_field_on_success() {
        let stdout = br#"{"type":"result","subtype":"success","is_error":false,"result":"hello from claude code"}"#;
        let value: serde_json::Value = serde_json::from_slice(stdout).unwrap();
        let is_error = value.get("is_error").and_then(|v| v.as_bool()).unwrap_or(false);
        let result_text = value.get("result").and_then(|r| r.as_str()).unwrap_or_default();
        assert!(!is_error);
        assert_eq!(result_text, "hello from claude code");
    }

    // Verified against the real binary: even on failure the CLI writes a well-formed JSON
    // result object to stdout (not stderr) with `is_error: true` and the message in `result`.
    #[test]
    fn generate_claude_code_text_surfaces_is_error_message() {
        let stdout = br#"{"type":"result","subtype":"success","is_error":true,"api_error_status":401,"result":"Failed to authenticate. API Error: 401 OAuth access token has been revoked."}"#;
        let value: serde_json::Value = serde_json::from_slice(stdout).unwrap();
        let is_error = value.get("is_error").and_then(|v| v.as_bool()).unwrap_or(false);
        let result_text = value.get("result").and_then(|r| r.as_str()).unwrap_or_default();
        assert!(is_error);
        assert_eq!(result_text, "Failed to authenticate. API Error: 401 OAuth access token has been revoked.");
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
    fn validate_capture_payload_accepts_well_formed_image_capture() {
        let payload = "{\"kiraCapture\":1,\"kind\":\"image\",\"url\":\"https://example.com/a.png\",\"title\":\"A\",\"source\":\"example.com\"}";
        assert_eq!(validate_capture_payload(payload), Ok(()));
    }

    #[test]
    fn validate_capture_payload_rejects_broken_json() {
        let error = validate_capture_payload("{not json").unwrap_err();
        assert_eq!(error, "invalid JSON");
    }

    #[test]
    fn validate_capture_payload_rejects_data_url() {
        let payload = "{\"kiraCapture\":1,\"kind\":\"image\",\"url\":\"data:image/gif;base64,AA==\",\"title\":\"A\",\"source\":\"example.com\"}";
        let error = validate_capture_payload(payload).unwrap_err();
        assert!(error.contains("http(s)"), "unexpected reason: {error}");
    }

    #[test]
    fn validate_capture_payload_rejects_missing_title() {
        let payload = "{\"kiraCapture\":1,\"kind\":\"image\",\"url\":\"https://example.com/a.png\",\"source\":\"example.com\"}";
        let error = validate_capture_payload(payload).unwrap_err();
        assert_eq!(error, "missing title");
    }

    #[test]
    fn validate_capture_payload_rejects_missing_source() {
        let payload = "{\"kiraCapture\":1,\"kind\":\"image\",\"url\":\"https://example.com/a.png\",\"title\":\"A\"}";
        let error = validate_capture_payload(payload).unwrap_err();
        assert_eq!(error, "missing source");
    }

    #[test]
    fn validate_capture_payload_rejects_unknown_kind() {
        let payload = "{\"kiraCapture\":1,\"kind\":\"video\",\"url\":\"https://example.com/a.mp4\",\"title\":\"A\",\"source\":\"example.com\"}";
        let error = validate_capture_payload(payload).unwrap_err();
        assert_eq!(error, "kind must be \"image\" or \"page\"");
    }

    #[test]
    fn connection_http_request_parses_post_body_and_options() {
        let request = "POST /connection HTTP/1.1\r\nContent-Type: application/json\r\n\r\n{\"service\":\"pinterest\",\"loggedIn\":true}";
        match parse_capture_http_request(request) {
            CaptureHttpRequest::ConnectionPost(payload) => {
                assert_eq!(payload, "{\"service\":\"pinterest\",\"loggedIn\":true}")
            }
            _ => panic!("expected connection post"),
        }

        match parse_capture_http_request("OPTIONS /connection HTTP/1.1\r\n\r\n") {
            CaptureHttpRequest::Options => {}
            _ => panic!("expected options"),
        }

        match parse_capture_http_request("POST /connection HTTP/1.1\r\n\r\n") {
            CaptureHttpRequest::Invalid => {}
            _ => panic!("expected invalid for an empty body"),
        }
    }

    #[test]
    fn validate_connection_payload_accepts_known_service_and_bool() {
        assert_eq!(
            validate_connection_payload("{\"service\":\"pinterest\",\"loggedIn\":true}"),
            Ok(())
        );
        assert_eq!(
            validate_connection_payload("{\"service\":\"pinterest\",\"loggedIn\":false}"),
            Ok(())
        );
    }

    #[test]
    fn validate_connection_payload_rejects_broken_json() {
        let error = validate_connection_payload("{not json").unwrap_err();
        assert_eq!(error, "invalid JSON");
    }

    #[test]
    fn validate_connection_payload_rejects_non_object() {
        let error = validate_connection_payload("[1,2,3]").unwrap_err();
        assert_eq!(error, "payload must be a JSON object");
    }

    #[test]
    fn validate_connection_payload_rejects_unknown_service() {
        let error =
            validate_connection_payload("{\"service\":\"instagram\",\"loggedIn\":true}")
                .unwrap_err();
        assert_eq!(error, "unsupported service: instagram");
    }

    #[test]
    fn validate_connection_payload_rejects_missing_service() {
        let error = validate_connection_payload("{\"loggedIn\":true}").unwrap_err();
        assert_eq!(error, "missing service");
    }

    #[test]
    fn validate_connection_payload_rejects_non_bool_logged_in() {
        let error =
            validate_connection_payload("{\"service\":\"pinterest\",\"loggedIn\":\"yes\"}")
                .unwrap_err();
        assert_eq!(error, "loggedIn must be a boolean");
    }

    #[test]
    fn validate_connection_payload_rejects_missing_logged_in() {
        let error = validate_connection_payload("{\"service\":\"pinterest\"}").unwrap_err();
        assert_eq!(error, "loggedIn must be a boolean");
    }

    // The schema is exactly {service, loggedIn} — a well-formed payload that
    // also smuggles a third field (a cookie, a URL, anything else a sender
    // on loopback might try to widen this to) is rejected outright rather
    // than the extra field being silently dropped.
    #[test]
    fn validate_connection_payload_rejects_unknown_extra_field() {
        let error = validate_connection_payload(
            "{\"service\":\"pinterest\",\"loggedIn\":true,\"cookie\":\"abc\"}",
        )
        .unwrap_err();
        assert_eq!(error, "unknown field: cookie");
    }

    #[test]
    fn is_http_or_https_url_accepts_http_and_https_only() {
        assert!(is_http_or_https_url("https://example.com/a.png"));
        assert!(is_http_or_https_url("HTTP://example.com"));
        assert!(!is_http_or_https_url("data:image/gif;base64,AA=="));
        assert!(!is_http_or_https_url("blob:https://example.com/abc"));
        assert!(!is_http_or_https_url("javascript:alert(1)"));
        assert!(!is_http_or_https_url("https://"));
    }

    #[test]
    fn origin_is_allowed_accepts_extension_origins_and_absent_origin() {
        assert!(origin_is_allowed(None));
        assert!(origin_is_allowed(Some(
            "chrome-extension://abcdefghijklmnopabcdefghijklmnop"
        )));
        assert!(origin_is_allowed(Some("safari-web-extension://abc-def")));
        assert!(!origin_is_allowed(Some("https://evil.example")));
        assert!(!origin_is_allowed(Some("null")));
    }

    #[test]
    fn fetch_capture_image_rejects_non_http_url() {
        let error = fetch_capture_image_blocking("data:image/png;base64,AA==").unwrap_err();
        assert_eq!(error, "url must be http(s)");
    }

    // The three tests below spin up a tiny raw-socket HTTP server (same
    // technique as read_capture_http_request's own test) so the size and
    // content-type checks are exercised against a real streamed response,
    // not just a pure-function slice of the logic.

    #[test]
    fn fetch_capture_image_rejects_declared_oversized_content_length() {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind ephemeral port");
        let addr = listener.local_addr().expect("local addr");
        let server = thread::spawn(move || {
            let (mut stream, _) = listener.accept().expect("accept");
            let mut buffer = [0_u8; 1024];
            let _ = stream.read(&mut buffer);
            let response = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: image/png\r\nContent-Length: {}\r\n\r\n",
                CAPTURE_IMAGE_FETCH_MAX_BYTES + 1
            );
            let _ = stream.write_all(response.as_bytes());
        });

        let url = format!("http://{addr}/big.png");
        let error = fetch_capture_image_blocking(&url).unwrap_err();
        server.join().expect("server thread panicked");
        assert!(error.contains("limit"), "unexpected error: {error}");
    }

    #[test]
    fn fetch_capture_image_rejects_body_that_exceeds_the_limit_while_streaming() {
        // Content-Length lies (declares small) — the limit still has to catch
        // a body that grows past it while being read, not just the header.
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind ephemeral port");
        let addr = listener.local_addr().expect("local addr");
        let oversized_body = vec![0_u8; (CAPTURE_IMAGE_FETCH_MAX_BYTES as usize) + 1024];
        let server = thread::spawn(move || {
            let (mut stream, _) = listener.accept().expect("accept");
            let mut buffer = [0_u8; 1024];
            let _ = stream.read(&mut buffer);
            let headers = "HTTP/1.1 200 OK\r\nContent-Type: image/png\r\n\r\n";
            let _ = stream.write_all(headers.as_bytes());
            let _ = stream.write_all(&oversized_body);
        });

        let url = format!("http://{addr}/big-streamed.png");
        let error = fetch_capture_image_blocking(&url).unwrap_err();
        server.join().expect("server thread panicked");
        assert!(error.contains("limit"), "unexpected error: {error}");
    }

    #[test]
    fn fetch_capture_image_rejects_non_image_content_type() {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind ephemeral port");
        let addr = listener.local_addr().expect("local addr");
        let server = thread::spawn(move || {
            let (mut stream, _) = listener.accept().expect("accept");
            let mut buffer = [0_u8; 1024];
            let _ = stream.read(&mut buffer);
            let body = "<html></html>";
            let response = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: {}\r\n\r\n{}",
                body.len(),
                body
            );
            let _ = stream.write_all(response.as_bytes());
        });

        let url = format!("http://{addr}/page.html");
        let error = fetch_capture_image_blocking(&url).unwrap_err();
        server.join().expect("server thread panicked");
        assert!(error.contains("not an image"), "unexpected error: {error}");
    }

    #[test]
    fn fetch_capture_image_returns_base64_bytes_for_a_real_image_response() {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind ephemeral port");
        let addr = listener.local_addr().expect("local addr");
        let mut png = Cursor::new(Vec::new());
        image::RgbaImage::from_pixel(1, 1, image::Rgba([10, 20, 30, 255]))
            .write_to(&mut png, ImageFormat::Png)
            .expect("write png fixture");
        let png_bytes = png.into_inner();
        let png_bytes_for_server = png_bytes.clone();

        let server = thread::spawn(move || {
            let (mut stream, _) = listener.accept().expect("accept");
            let mut buffer = [0_u8; 1024];
            let _ = stream.read(&mut buffer);
            let mut response = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: image/png\r\nContent-Length: {}\r\n\r\n",
                png_bytes_for_server.len()
            )
            .into_bytes();
            response.extend_from_slice(&png_bytes_for_server);
            let _ = stream.write_all(&response);
        });

        let url = format!("http://{addr}/ok.png");
        let result = fetch_capture_image_blocking(&url).expect("expected a successful fetch");
        server.join().expect("server thread panicked");
        assert_eq!(result.mime, "image/png");
        assert_eq!(
            BASE64.decode(result.base64).expect("valid base64"),
            png_bytes
        );
    }

    // Guards research 2026-11-09-visual-explore's hang: fetch_capture_image
    // used to build+drop a reqwest::blocking::Client inline inside the async
    // command body. Tauri polls an async command's future as a task on its
    // tokio runtime, so this test spawns the command the same way (not just
    // calling fetch_capture_image_blocking on a plain thread) to reproduce
    // that context. The blocking client panics with "Cannot drop a runtime
    // in a context where blocking is not allowed" when dropped from a tokio
    // worker — the panicked task never resolves or rejects the JS invoke()
    // promise, so the download spinner hangs forever.
    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn fetch_capture_image_resolves_when_polled_on_a_tokio_runtime() {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind ephemeral port");
        let addr = listener.local_addr().expect("local addr");
        let mut png = Cursor::new(Vec::new());
        image::RgbaImage::from_pixel(1, 1, image::Rgba([10, 20, 30, 255]))
            .write_to(&mut png, ImageFormat::Png)
            .expect("write png fixture");
        let png_bytes = png.into_inner();
        let png_bytes_for_server = png_bytes.clone();

        let server = thread::spawn(move || {
            let (mut stream, _) = listener.accept().expect("accept");
            let mut buffer = [0_u8; 1024];
            let _ = stream.read(&mut buffer);
            let mut response = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: image/png\r\nContent-Length: {}\r\n\r\n",
                png_bytes_for_server.len()
            )
            .into_bytes();
            response.extend_from_slice(&png_bytes_for_server);
            let _ = stream.write_all(&response);
        });

        let url = format!("http://{addr}/ok.png");
        let result = tokio::spawn(fetch_capture_image(url))
            .await
            .expect("command task must not panic");
        server.join().expect("server thread panicked");
        let result = result.expect("expected a successful fetch");
        assert_eq!(result.mime, "image/png");
    }

    #[test]
    fn extract_header_value_is_case_insensitive_and_trims() {
        let headers = "POST /capture HTTP/1.1\r\nContent-Length: 42\r\nOrigin: chrome-extension://abc\r\n";
        assert_eq!(extract_header_value(headers, "content-length"), Some("42"));
        assert_eq!(
            extract_header_value(headers, "ORIGIN"),
            Some("chrome-extension://abc")
        );
        assert_eq!(extract_header_value(headers, "X-Missing"), None);
    }

    // Guards the actual bug (research 2026-11-09 §5#1): a request whose
    // headers and body arrive as two separate TCP writes used to come back
    // 404 with an empty body (single read() only saw the headers), and a
    // body past 64KB was silently truncated into broken JSON. Both have to
    // survive in one read_capture_http_request() call now.
    #[test]
    fn read_capture_http_request_handles_split_writes_and_bodies_over_64kb() {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind ephemeral port");
        let addr = listener.local_addr().expect("local addr");

        let big_note = "x".repeat(70_000);
        let payload = format!(
            "{{\"kiraCapture\":1,\"kind\":\"page\",\"url\":\"https://example.com\",\"title\":\"t\",\"source\":\"s\",\"note\":\"{big_note}\"}}"
        );
        let request = format!(
            "POST /capture HTTP/1.1\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{}",
            payload.len(),
            payload
        );

        let server = thread::spawn(move || {
            let (mut stream, _) = listener.accept().expect("accept");
            stream
                .set_read_timeout(Some(Duration::from_secs(2)))
                .expect("set read timeout");
            read_capture_http_request(&mut stream).expect("read request")
        });

        thread::sleep(Duration::from_millis(20));
        let mut client = TcpStream::connect(addr).expect("connect");
        let split_at = request.find("\r\n\r\n").expect("header terminator") + 4;
        client
            .write_all(request[..split_at].as_bytes())
            .expect("write headers");
        thread::sleep(Duration::from_millis(20));
        client
            .write_all(request[split_at..].as_bytes())
            .expect("write body");

        let received = server.join().expect("server thread panicked");
        assert!(
            received.ends_with(&payload),
            "body should arrive whole across two writes and past 64KB, not truncated"
        );
        match parse_capture_http_request(&received) {
            CaptureHttpRequest::Post(body) => {
                assert_eq!(validate_capture_payload(&body), Ok(()));
            }
            _ => panic!("expected a parsed capture post"),
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
    fn ai_panel_field_round_trips_through_save_and_load() {
        // apps/desktop/src/kira/aiPanelModel.ts toSnapshot() produces this
        // shape. lib.rs never needs to parse it — just carry it through
        // save (write_project_package_to_dir -> write_snapshot ->
        // canvas_collections) and load (read_project_package ->
        // read_snapshot, which is what wins whenever project.sqlite exists,
        // i.e. on every real save/reload).
        let id = timestamp_millis();
        let project_dir = std::env::temp_dir().join(format!("kira-ai-panel-roundtrip-test-{id}.kira"));
        let snapshot_json = serde_json::json!({
            "version": 2,
            "ideas": [],
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
                    "createdAt": "2026-09-14T00:00:00.000Z"
                }]
            },
            "versionHistory": [],
            "nodeVersions": [],
            "links": [],
            "outlineDrafts": [],
            "aiPanel": {
                "schemaVersion": 1,
                "threads": [{
                    "id": "thread-a",
                    "title": "Tách nhánh concept Hanoi noir",
                    "createdAt": "2026-09-14T14:30:00.000Z",
                    "updatedAt": "2026-09-14T14:32:00.000Z",
                    "anchorNodeIds": ["idea-hanoi-noir"]
                }],
                "changeSets": [{
                    "id": "cs-branches",
                    "runId": "run-branches",
                    "threadId": "thread-a",
                    "title": "Tách nhánh concept Hanoi noir",
                    "createdAt": "2026-09-14T14:32:00.000Z",
                    "items": []
                }],
                "provenance": {
                    "idea:idea-brass-bar": {
                        "aiGenerated": true,
                        "runId": "run-branches",
                        "threadId": "thread-a",
                        "editedAfterGeneration": false
                    }
                }
            }
        })
        .to_string();

        write_project_package_to_dir(project_dir.clone(), snapshot_json).expect("write project package");
        let restored = read_project_package(&project_dir)
            .expect("read saved package")
            .expect("restored saved snapshot");
        let restored_json: serde_json::Value =
            serde_json::from_str(&restored).expect("parse restored saved snapshot");

        assert_eq!(restored_json["aiPanel"]["threads"][0]["id"], "thread-a");
        assert_eq!(restored_json["aiPanel"]["changeSets"][0]["id"], "cs-branches");
        assert_eq!(
            restored_json["aiPanel"]["provenance"]["idea:idea-brass-bar"]["aiGenerated"],
            true
        );

        let _ = fs::remove_dir_all(project_dir);
    }

    #[test]
    fn snapshot_without_ai_panel_field_still_loads() {
        // Old projects saved before the aiPanel field existed must keep
        // loading — #[serde(default)] on ProjectSnapshot.ai_panel is what
        // makes this work rather than a hard deserialize error.
        let id = timestamp_millis();
        let project_dir = std::env::temp_dir().join(format!("kira-ai-panel-absent-test-{id}.kira"));
        let snapshot_json = serde_json::json!({
            "version": 2,
            "ideas": [{
                "id": "idea-legacy",
                "title": "Legacy project",
                "body": "No aiPanel field at all.",
                "status": "forming",
                "x": 10,
                "y": 10
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
                    "createdAt": "2026-09-14T00:00:00.000Z"
                }]
            },
            "versionHistory": [],
            "nodeVersions": [],
            "links": [],
            "outlineDrafts": []
        })
        .to_string();

        let info = write_project_package_to_dir(project_dir.clone(), snapshot_json)
            .expect("write project package without aiPanel");
        assert!(PathBuf::from(&info.path).exists());

        let restored = read_project_package(&project_dir)
            .expect("read saved package")
            .expect("restored saved snapshot");
        let restored_json: serde_json::Value =
            serde_json::from_str(&restored).expect("parse restored saved snapshot");

        assert_eq!(restored_json["ideas"][0]["title"], "Legacy project");
        assert_eq!(restored_json["aiPanel"], serde_json::Value::Null);

        let _ = fs::remove_dir_all(project_dir);
    }

    #[test]
    fn slides_config_round_trips_through_save_and_load() {
        // Bug found while wiring aiPanel persistence (task brief, "while
        // there" note): the TS ProjectSnapshot type (main.tsx ~439-456)
        // has an optional `slidesConfig` field, but ProjectSnapshot here
        // had no matching field before this change. A native save's SQLite
        // round trip (the path read_project_package always takes once
        // project.sqlite exists — i.e. after any real save) silently
        // dropped it. This test would fail without the `slides_config`
        // field + its write_json_collection/read_json_collection wiring
        // added alongside aiPanel above.
        let id = timestamp_millis();
        let project_dir = std::env::temp_dir().join(format!("kira-slides-config-test-{id}.kira"));
        let snapshot_json = serde_json::json!({
            "version": 2,
            "ideas": [],
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
                    "createdAt": "2026-09-14T00:00:00.000Z"
                }]
            },
            "versionHistory": [],
            "nodeVersions": [],
            "links": [],
            "outlineDrafts": [],
            "slidesConfig": {
                "aspectRatio": "16:9",
                "template": "editorial",
                "transition": "fade"
            }
        })
        .to_string();

        write_project_package_to_dir(project_dir.clone(), snapshot_json).expect("write project package");
        let restored = read_project_package(&project_dir)
            .expect("read saved package")
            .expect("restored saved snapshot");
        let restored_json: serde_json::Value =
            serde_json::from_str(&restored).expect("parse restored saved snapshot");

        assert_eq!(restored_json["slidesConfig"]["aspectRatio"], "16:9");
        assert_eq!(restored_json["slidesConfig"]["template"], "editorial");
        assert_eq!(restored_json["slidesConfig"]["transition"], "fade");

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
            project: serde_json::Value::Null,
            appearance: serde_json::Value::Null,
            ideas: vec![IdeaRecord {
                id: "idea-sqlite".to_string(),
                title: "SQLite fallback idea".to_string(),
                body: None,
                content: Some("Recovered from SQLite.".to_string()),
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
                variant: None,
                ai_excluded: None,
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
            ai_panel: serde_json::Value::Null,
            slides_config: serde_json::Value::Null,
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
            project: serde_json::Value::Null,
            appearance: serde_json::Value::Null,
            ideas: vec![IdeaRecord {
                id: "idea-authoritative".to_string(),
                title: "SQLite authoritative title".to_string(),
                body: None,
                content: Some("The normalized database should win over a stale manifest.".to_string()),
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
                variant: None,
                ai_excluded: None,
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
            ai_panel: serde_json::Value::Null,
            slides_config: serde_json::Value::Null,
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

    // ---- Snapshot field coverage -------------------------------------------
    //
    // Every field the frontend puts in a ProjectSnapshot must survive a real
    // save and reload. The failure mode is silent: `isProjectSnapshot()` in
    // main.tsx swaps a missing `project`/`appearance` for defaults, and a
    // dropped `aiExcluded` re-admits a node into the AI context, so nothing
    // throws. Earlier fixes added one test per field after the fact
    // (slidesConfig, aiPanel). These tests cover the class instead: the key
    // list is read from the TS type declarations, so a field added there and
    // not carried here fails immediately.

    /// Top-level keys of `type <name> = {` in main.tsx: lines indented exactly
    /// two spaces, so nested object types and comments are skipped.
    fn ts_type_keys(source: &str, type_name: &str) -> Vec<String> {
        let headers = [format!("type {type_name} = {{"), format!("export type {type_name} = {{")];
        let mut lines = source.lines().skip_while(|line| !headers.iter().any(|h| line == h));
        assert!(
            lines.next().is_some(),
            "type {type_name} not found in main.tsx: it was renamed or moved, update this test"
        );
        let mut keys = Vec::new();
        for line in lines {
            if line == "}" {
                break;
            }
            let Some(rest) = line.strip_prefix("  ") else { continue };
            if rest.starts_with([' ', '/', '*']) {
                continue;
            }
            let end = rest.find(['?', ':']).unwrap_or(0);
            if end > 0 && rest[..end].chars().all(|c| c.is_alphanumeric() || c == '_') {
                keys.push(rest[..end].to_string());
            }
        }
        keys
    }

    fn main_tsx_source() -> String {
        fs::read_to_string(Path::new(env!("CARGO_MANIFEST_DIR")).join("../src/main.tsx"))
            .expect("read apps/desktop/src/main.tsx")
    }

    /// One value for every key the TS type declares, for the record types Rust
    /// models field by field. Palettes, diagrams, placeholders and frames are
    /// opaque to Rust, so a bare object stands in for them. Numbers that Rust
    /// stores as f64 are fractional so JSON equality is exact after the trip.
    fn full_snapshot_fixture(thumb: &str) -> serde_json::Value {
        // Built in pieces: one json! literal this size hits the macro
        // recursion limit.
        let project = serde_json::json!({
            "title": "Bản lưu đầy đủ", "description": "Mô tả dự án", "author": "VietX",
            "kind": "ideaboard", "styleNote": "Giấy và mực"
        });
        let appearance = serde_json::json!({
            "colorMode": "light", "canvasColor": "#f4efe6",
            "accentPreset": "custom", "accentColor": "#cc5500"
        });
        let ideas = serde_json::json!([
            {
                "id": "idea-plain", "title": "Idea", "content": "Nội dung",
                "status": "strong", "x": 10.5, "y": 20.5, "importance": 3.5,
                "scale": 1.5, "createdAt": "2026-09-01T00:00:00.000Z",
                "addedAt": "2026-09-01T00:01:00.000Z",
                "updatedAt": "2026-09-01T00:02:00.000Z",
                "sourceUrl": "https://example.com/idea", "notes": "Ghi chú",
                "aiExcluded": true
            },
            {
                "id": "idea-sticky", "title": "Sticky", "content": "Dán",
                "status": "forming", "x": 30.5, "y": 40.5, "variant": "sticker"
            }
        ]);
        let images = serde_json::json!([{
            "id": "img-a", "title": "Ảnh", "content": "Chú thích",
            "source": "ref.png", "originApp": "eagle", "originId": "e-1",
            "sourcePath": "/library/ref.png",
            "palette": ["#111111", "#222222"], "tags": ["a", "b"],
            "suggestions": [{
                "label": "noir", "source": "local", "confidence": 0.75,
                "status": "accepted"
            }],
            "x": 50.5, "y": 60.5, "thumb": thumb, "importance": 2.5,
            "scale": 1.25, "createdAt": "2026-09-02T00:00:00.000Z",
            "addedAt": "2026-09-02T00:01:00.000Z",
            "updatedAt": "2026-09-02T00:02:00.000Z",
            "sourceUrl": "https://example.com/ref", "notes": "Ghi chú ảnh",
            "aiExcluded": true, "tagsPinned": true, "palettePinned": false,
            "blockOrder": ["palette", "tags", "source"],
            "width": 1, "height": 1, "sizeBytes": 68, "mimeType": "image/png",
            "fingerprint": "sha256:fixture", "perceptualHash": "ahash:fixture",
            "cropRect": {"x": 0.125, "y": 0.25, "width": 0.5, "height": 0.5}
        }]);
        let links = serde_json::json!([{
            "id": "link-a", "imageId": "img-a", "ideaId": "idea-plain",
            "sourceNodeId": "img-a", "targetNodeId": "idea-plain",
            "sourceKind": "image", "targetKind": "idea", "relation": "supports",
            "note": "Liên kết", "label": "hỗ trợ", "confidence": 0.75,
            "createdAt": "2026-09-03T00:00:00.000Z",
            "updatedAt": "2026-09-03T00:01:00.000Z"
        }]);
        let outline_drafts = serde_json::json!([{
            "id": "outline-a", "title": "Dàn ý", "createdAt": "2026-09-04T00:00:00.000Z",
            "sections": [{
                "id": "sec-a", "ideaId": "idea-plain", "title": "Mục",
                "summary": "Tóm tắt", "referenceIds": ["img-a"], "strength": "strong"
            }]
        }]);
        let opaque = serde_json::json!({
            "palettes": [{"id": "pal-a", "title": "P", "colors": ["#111111"], "x": 1, "y": 2}],
            "diagrams": [{"id": "dia-a", "title": "D", "format": "mermaid", "source": "graph TD", "x": 1, "y": 2}],
            "placeholders": [{"id": "ph-a", "title": "H", "targetKind": "image", "x": 1, "y": 2}],
            "frames": [{"id": "frame-a", "title": "F", "x": 1, "y": 2, "width": 3, "height": 4}],
            "aiSettings": {"providers": [], "routingMode": "prefer_local", "selectedProviderId": "openai"},
            "versionState": {
                "schemaVersion": 1, "currentBranchId": "main",
                "branches": [{"id": "main", "name": "Main", "createdAt": "2026-09-01T00:00:00.000Z"}]
            },
            "versionHistory": [{"id": "v-1", "label": "Lần một"}],
            "nodeVersions": [{"id": "nv-1", "nodeId": "idea-plain"}],
            "slidesConfig": {"aspectRatio": "16:9", "template": "editorial", "transition": "fade"},
            "aiPanel": {"schemaVersion": 1, "threads": [{"id": "thread-a", "title": "Thread A"}]}
        });
        let mut root = opaque.as_object().expect("opaque fixture").clone();
        root.insert("version".into(), serde_json::json!(2));
        root.insert("project".into(), project);
        root.insert("appearance".into(), appearance);
        root.insert("ideas".into(), ideas);
        root.insert("images".into(), images);
        root.insert("links".into(), links);
        root.insert("outlineDrafts".into(), outline_drafts);
        serde_json::Value::Object(root)
    }

    fn tiny_png_data_url() -> String {
        let mut png = Cursor::new(Vec::new());
        image::RgbaImage::from_pixel(1, 1, image::Rgba([255, 255, 255, 255]))
            .write_to(&mut png, ImageFormat::Png)
            .expect("write png fixture");
        format!("data:image/png;base64,{}", BASE64.encode(png.into_inner()))
    }

    fn temp_project_dir(label: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "kira-{label}-{}-{}.kira",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .expect("system time")
                .as_nanos()
        ));
        let _ = fs::remove_dir_all(&dir);
        dir
    }

    fn save_and_reload(project_dir: &Path, snapshot: &serde_json::Value) -> serde_json::Value {
        write_project_package_to_dir(project_dir.to_path_buf(), snapshot.to_string())
            .expect("write project package");
        let restored = read_project_package(project_dir)
            .expect("read saved package")
            .expect("restored saved snapshot");
        serde_json::from_str(&restored).expect("parse restored snapshot")
    }

    /// `expected` must appear in `actual` key by key. `actual` may carry extra
    /// keys (the legacy `body` column); `skip` lists keys whose value is
    /// regenerated on load rather than stored.
    fn assert_fields_survive(
        what: &str,
        expected: &serde_json::Value,
        actual: &serde_json::Value,
        skip: &[&str],
    ) {
        for (key, value) in expected.as_object().expect("expected is an object") {
            if skip.contains(&key.as_str()) {
                continue;
            }
            assert_eq!(
                actual.get(key),
                Some(value),
                "{what}.{key} did not survive a save and reload"
            );
        }
    }

    #[test]
    fn fixture_covers_every_key_the_frontend_declares() {
        // The other half of the guard: the fixture is the list of what Rust is
        // asked to carry. A key added to a TS type below but not to the
        // fixture fails here, telling you to add it to both the fixture and
        // the Rust side.
        let source = main_tsx_source();
        let fixture = full_snapshot_fixture("data:image/png;base64,AA==");
        let cases: [(&str, &serde_json::Value); 6] = [
            ("ProjectSnapshot", &fixture),
            ("Idea", &fixture["ideas"][0]),
            ("EvidenceImage", &fixture["images"][0]),
            ("EvidenceLink", &fixture["links"][0]),
            ("OutlineDraft", &fixture["outlineDrafts"][0]),
            ("OutlineDraftSection", &fixture["outlineDrafts"][0]["sections"][0]),
        ];
        for (type_name, sample) in cases {
            let keys = ts_type_keys(&source, type_name);
            // Guard against a parser that quietly reads nothing.
            assert!(
                keys.len() >= 4 && keys.iter().any(|key| key == "id" || key == "version"),
                "read {} keys for {type_name}, the parser is not seeing the type: {keys:?}",
                keys.len()
            );
            let mut haystack = sample.as_object().expect("fixture sample").clone();
            if type_name == "Idea" {
                // `variant` and `aiExcluded` live on different Idea records.
                haystack.extend(fixture["ideas"][1].as_object().expect("sticky idea").clone());
            }
            let missing: Vec<&String> = keys.iter().filter(|key| !haystack.contains_key(*key)).collect();
            assert!(
                missing.is_empty(),
                "{type_name} declares {missing:?} in main.tsx but full_snapshot_fixture() has no value for it"
            );
        }
    }

    #[test]
    fn every_fixture_field_survives_save_and_reload() {
        let project_dir = temp_project_dir("all-fields");
        let fixture = full_snapshot_fixture(&tiny_png_data_url());
        let restored = save_and_reload(&project_dir, &fixture);

        // Opaque and top-level collections: exact equality.
        for key in [
            "project", "appearance", "palettes", "diagrams", "placeholders", "frames",
            "aiSettings", "versionState", "versionHistory", "nodeVersions", "slidesConfig",
            "aiPanel", "outlineDrafts", "links",
        ] {
            assert_eq!(restored[key], fixture[key], "{key} did not survive a save and reload");
        }
        assert_eq!(restored["version"], 2);
        for index in 0..fixture["ideas"].as_array().unwrap().len() {
            assert_fields_survive(
                &format!("ideas[{index}]"),
                &fixture["ideas"][index],
                &restored["ideas"][index],
                &[],
            );
        }
        // `thumb` is re-encoded from the stored PNG on load, not stored as sent.
        assert_fields_survive("images[0]", &fixture["images"][0], &restored["images"][0], &["thumb"]);

        let _ = fs::remove_dir_all(project_dir);
    }

    #[test]
    fn legacy_package_recovers_lost_fields_from_its_manifest() {
        // A project saved before the fix has the right values only in
        // manifest.json: its SQLite lacks project, appearance and the node
        // flags. Simulate that by stripping exactly what the old writer never
        // stored, then check a load restores it.
        let project_dir = temp_project_dir("legacy-rescue");
        let fixture = full_snapshot_fixture(&tiny_png_data_url());
        save_and_reload(&project_dir, &fixture);
        {
            let conn = Connection::open(project_dir.join(SQLITE_NAME)).expect("open sqlite");
            conn.execute_batch(
                "DELETE FROM canvas_collections WHERE key IN ('project', 'appearance');
                 DELETE FROM project_meta WHERE key = 'snapshot_fields';
                 UPDATE ideas SET variant = NULL, ai_excluded = NULL;
                 UPDATE reference_assets SET ai_excluded = NULL, tags_pinned = NULL,
                     palette_pinned = NULL, block_order = NULL;",
            )
            .expect("strip the fields a legacy save never wrote");
        }
        let restored: serde_json::Value = serde_json::from_str(
            &read_project_package(&project_dir).expect("read").expect("snapshot"),
        )
        .expect("parse");
        assert_eq!(restored["project"], fixture["project"]);
        assert_eq!(restored["appearance"], fixture["appearance"]);
        assert_eq!(restored["ideas"][0]["aiExcluded"], true);
        assert_eq!(restored["ideas"][1]["variant"], "sticker");
        assert_fields_survive("images[0]", &fixture["images"][0], &restored["images"][0], &["thumb"]);

        // Without a manifest there is nothing to recover: the keys are absent
        // (which main.tsx handles), never null.
        fs::remove_file(project_dir.join(MANIFEST_NAME)).expect("remove manifest");
        let bare: serde_json::Value = serde_json::from_str(
            &read_project_package(&project_dir).expect("read").expect("snapshot"),
        )
        .expect("parse");
        assert!(bare.get("project").is_none() && bare.get("appearance").is_none());

        let _ = fs::remove_dir_all(project_dir);
    }

    #[test]
    fn stale_manifest_never_overrides_a_current_save() {
        // The rescue path is only for packages an older build wrote. A package
        // saved by this build carries the marker, so SQLite alone decides.
        let project_dir = temp_project_dir("no-override");
        let mut fixture = full_snapshot_fixture(&tiny_png_data_url());
        fixture["ideas"][0]["aiExcluded"] = serde_json::json!(false);
        fixture["project"]["title"] = serde_json::json!("Current title");
        save_and_reload(&project_dir, &fixture);

        let mut stale = fixture.clone();
        stale["ideas"][0]["aiExcluded"] = serde_json::json!(true);
        stale["project"]["title"] = serde_json::json!("Stale title");
        fs::write(project_dir.join(MANIFEST_NAME), stale.to_string()).expect("write stale manifest");

        let restored: serde_json::Value = serde_json::from_str(
            &read_project_package(&project_dir).expect("read").expect("snapshot"),
        )
        .expect("parse");
        assert_eq!(restored["ideas"][0]["aiExcluded"], false);
        assert_eq!(restored["project"]["title"], "Current title");

        let _ = fs::remove_dir_all(project_dir);
    }

    // ---- Snapshot version ---------------------------------------------------
    //
    // The app wrote snapshot version 1 until 621a5ef (June 2026) moved it to 2
    // without a migration. main.tsx only accepts 2, so a v1 package used to
    // open as nothing at all.

    /// The schema the app created while it still wrote version 1, copied from
    /// migrate() at 621a5ef^: narrower tables, `links` with foreign keys, and
    /// no canvas_collections table.
    const V1_SCHEMA: &str = "
        CREATE TABLE schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE project_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE ideas (id TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL,
          status TEXT NOT NULL, x REAL NOT NULL, y REAL NOT NULL);
        CREATE TABLE reference_assets (id TEXT PRIMARY KEY, title TEXT NOT NULL, source TEXT NOT NULL,
          origin_app TEXT, origin_id TEXT, source_path TEXT, palette_json TEXT NOT NULL,
          thumb TEXT NOT NULL, asset_path TEXT, thumb_path TEXT,
          fingerprint TEXT NOT NULL DEFAULT '', perceptual_hash TEXT NOT NULL DEFAULT '',
          x REAL NOT NULL, y REAL NOT NULL);
        CREATE TABLE links (id TEXT PRIMARY KEY, image_id TEXT NOT NULL, idea_id TEXT NOT NULL,
          relation TEXT NOT NULL, note TEXT NOT NULL, confidence REAL NOT NULL,
          FOREIGN KEY(image_id) REFERENCES reference_assets(id) ON DELETE CASCADE,
          FOREIGN KEY(idea_id) REFERENCES ideas(id) ON DELETE CASCADE);
        CREATE TABLE reference_tags (reference_id TEXT NOT NULL, tag TEXT NOT NULL, position INTEGER NOT NULL,
          PRIMARY KEY(reference_id, tag),
          FOREIGN KEY(reference_id) REFERENCES reference_assets(id) ON DELETE CASCADE);
        CREATE TABLE tag_suggestions (reference_id TEXT NOT NULL, suggestion TEXT NOT NULL,
          source TEXT NOT NULL DEFAULT 'local', confidence REAL NOT NULL DEFAULT 0.5,
          status TEXT NOT NULL DEFAULT 'pending', position INTEGER NOT NULL,
          PRIMARY KEY(reference_id, suggestion),
          FOREIGN KEY(reference_id) REFERENCES reference_assets(id) ON DELETE CASCADE);
        CREATE TABLE outline_drafts (id TEXT PRIMARY KEY, title TEXT NOT NULL, created_at TEXT NOT NULL,
          sections_json TEXT NOT NULL, position INTEGER NOT NULL);
        INSERT INTO project_meta (key, value) VALUES ('version', '1');
        INSERT INTO ideas VALUES ('idea-old', 'Ý tưởng cũ', 'Nội dung viết bằng body', 'strong', 11.5, 22.5);
    ";

    /// The rows of a v1 project, added after V1_SCHEMA. The image row is a
    /// separate statement because it needs a real PNG for the re-save below.
    const V1_ROWS: &str = "
        INSERT INTO reference_tags VALUES ('img-old', 'archive', 0);
        INSERT INTO links VALUES ('link-old', 'img-old', 'idea-old', 'supports', 'Ghi chú', 0.75);
        INSERT INTO outline_drafts VALUES ('outline-old', 'Dàn ý cũ', '2026-06-01T00:00:00.000Z', '[]', 0);
    ";

    fn v1_package(label: &str, with_manifest: bool) -> PathBuf {
        let project_dir = temp_project_dir(label);
        ensure_project_dirs(&project_dir).expect("create project dirs");
        let conn = Connection::open(project_dir.join(SQLITE_NAME)).expect("open sqlite");
        conn.execute_batch(V1_SCHEMA).expect("build a v1 package");
        conn.execute(
            "INSERT INTO reference_assets (id, title, source, palette_json, thumb, x, y)
             VALUES ('img-old', 'Ảnh cũ', 'old.png', '[\"#111111\"]', ?1, 33.5, 44.5)",
            params![tiny_png_data_url()],
        )
        .expect("insert v1 image");
        conn.execute_batch(V1_ROWS).expect("insert v1 rows");
        if with_manifest {
            fs::write(
                project_dir.join(MANIFEST_NAME),
                serde_json::json!({
                    "version": 1,
                    "ideas": [{"id": "idea-old", "title": "Ý tưởng cũ", "body": "Nội dung viết bằng body",
                               "status": "strong", "x": 11.5, "y": 22.5}],
                    "images": [],
                    "links": [],
                    "outlineDrafts": []
                })
                .to_string(),
            )
            .expect("write v1 manifest");
        }
        project_dir
    }

    fn read_json(project_dir: &Path) -> Result<serde_json::Value, String> {
        read_project_package(project_dir).map(|text| {
            serde_json::from_str(&text.expect("a package to read")).expect("parse snapshot")
        })
    }

    #[test]
    fn v1_package_opens_as_v2_with_all_of_its_data() {
        let project_dir = v1_package("v1-open", true);
        let opened = read_json(&project_dir).expect("a v1 package must open");

        assert_eq!(opened["version"], 2, "the frontend only accepts 2");
        assert_eq!(opened["ideas"][0]["id"], "idea-old");
        assert_eq!(opened["ideas"][0]["body"], "Nội dung viết bằng body");
        assert_eq!(opened["ideas"][0]["x"], 11.5);
        assert_eq!(opened["images"][0]["id"], "img-old");
        assert_eq!(opened["images"][0]["tags"][0], "archive");
        assert_eq!(opened["links"][0]["id"], "link-old");
        assert_eq!(opened["links"][0]["confidence"], 0.75);
        assert_eq!(opened["outlineDrafts"][0]["title"], "Dàn ý cũ");
        // Everything v2 added and v1 lacks comes back defaulted, not missing.
        for key in ["palettes", "diagrams", "placeholders", "versionHistory", "nodeVersions"] {
            assert_eq!(opened[key], serde_json::json!([]), "{key}");
        }
        assert!(opened["aiSettings"]["providers"].is_array());
        assert_eq!(opened["versionState"]["currentBranchId"], "main");

        // Reading did not rewrite the package: it still says 1 on disk.
        let conn = Connection::open(project_dir.join(SQLITE_NAME)).expect("open sqlite");
        let stored: String = conn
            .query_row("SELECT value FROM project_meta WHERE key = 'version'", [], |row| row.get(0))
            .expect("version row");
        assert_eq!(stored, "1");

        // The frontend saves what it loaded; the next open is a plain v2 one.
        drop(conn);
        write_project_package_to_dir(project_dir.clone(), opened.to_string())
            .expect("re-save the upgraded snapshot");
        let reopened = read_json(&project_dir).expect("reopen after save");
        assert_eq!(reopened["version"], 2);
        assert_eq!(reopened["ideas"][0]["body"], "Nội dung viết bằng body");
        assert_eq!(reopened["links"][0]["id"], "link-old");

        let _ = fs::remove_dir_all(project_dir);
    }

    #[test]
    fn v1_manifest_without_sqlite_opens_as_v2() {
        let project_dir = v1_package("v1-manifest-only", true);
        fs::remove_file(project_dir.join(SQLITE_NAME)).expect("remove sqlite");
        let opened = read_json(&project_dir).expect("a v1 manifest must open");
        assert_eq!(opened["version"], 2);
        assert_eq!(opened["ideas"][0]["id"], "idea-old");
        let _ = fs::remove_dir_all(project_dir);
    }

    #[test]
    fn version_marker_edge_cases_are_explicit() {
        let project_dir = temp_project_dir("version-edges");
        save_and_reload(&project_dir, &full_snapshot_fixture(&tiny_png_data_url()));
        let set_version = |value: Option<&str>| {
            let conn = Connection::open(project_dir.join(SQLITE_NAME)).expect("open sqlite");
            match value {
                Some(value) => conn.execute(
                    "INSERT OR REPLACE INTO project_meta (key, value) VALUES ('version', ?1)",
                    params![value],
                ),
                None => conn.execute("DELETE FROM project_meta WHERE key = 'version'", []),
            }
            .expect("edit version row");
        };

        // A missing row still opens: saves write it alongside the data.
        set_version(None);
        assert_eq!(read_json(&project_dir).expect("missing row")["version"], 2);

        // Newer than this build: an error that says so, not a snapshot the
        // frontend would discard. A real newer package has a matching manifest.
        set_version(Some("3"));
        let manifest = fs::read_to_string(project_dir.join(MANIFEST_NAME)).expect("manifest");
        let mut newer: serde_json::Value = serde_json::from_str(&manifest).expect("parse manifest");
        newer["version"] = serde_json::json!(3);
        fs::write(project_dir.join(MANIFEST_NAME), newer.to_string()).expect("write manifest");
        let error = read_json(&project_dir).expect_err("a newer package must not open silently");
        assert!(error.contains("newer version of KIRA"), "unhelpful error: {error}");

        // Garbage is corruption, also an error.
        set_version(Some("abc"));
        let error = read_json(&project_dir).expect_err("an unreadable marker must not open");
        assert!(error.contains("unreadable"), "unhelpful error: {error}");

        let _ = fs::remove_dir_all(project_dir);
    }
}

#[cfg(test)]
mod claude_code_models_probe {
    // Talks to the real CLI; run by hand: cargo test claude_code_models -- --ignored --nocapture
    #[test]
    #[ignore]
    fn claude_code_models_from_real_cli() {
        let bin = super::claude_code_bin_path().expect("claude CLI on this machine");
        let (ids, labels) = super::claude_code_supported_models(&bin).expect("models");
        println!("{ids:?}\n{labels:?}");
        assert!(!ids.is_empty());
        assert!(!ids.iter().any(|id| id == "default"));
        assert!(ids.iter().all(|id| labels.contains_key(id)), "every model has a name");
    }
}
