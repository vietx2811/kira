# Database Schema

Vixio stores each desktop project as a local package directory:

```txt
Project.vixio/
  manifest.json
  project.sqlite
  images/
  thumbs/
  exports/
```

`manifest.json` mirrors the current `ProjectSnapshot`. `project.sqlite` is the normalized working store used by the Tauri shell.

## Snapshot Shape

```ts
type ProjectSnapshot = {
  version: 1
  ideas: Idea[]
  images: Reference[]
  links: Link[]
  outlineDrafts: OutlineDraft[]
}
```

At this prototype stage, snapshots must include `outlineDrafts`; no backward compatibility layer is maintained for older local test snapshots.

## SQLite Schema

```sql
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
```

## Entity Invariants

- `reference_assets` stores material and source/origin metadata.
- `ideas` stores concept text and graph position.
- `links` stores meaning between a reference and an idea.
- `reference_tags` stores accepted tags only.
- `tag_suggestions` stores pending/rejected/accepted suggestion metadata separately from accepted tags.
- `outline_drafts` stores synthesis snapshots; each section keeps `ideaId`, `summary`, `referenceIds`, and `strength`.

Graph links are never encoded as flat tags. Eagle metadata can seed references and tag suggestions, but Vixio-owned idea/reference links stay in Vixio.

## Current Migrations

The Rust Tauri layer applies migrations directly in `src-tauri/src/lib.rs` and records them in `schema_migrations`:

```txt
001_base_schema
002_asset_paths
003_reference_fingerprint
004_reference_perceptual_hash
005_reference_origin
006_tag_suggestion_meta
007_outline_drafts
```

## Common Queries

### Ideas With Support Count

```sql
SELECT
  ideas.id,
  ideas.title,
  ideas.status,
  COUNT(links.id) AS support_count
FROM ideas
LEFT JOIN links ON links.idea_id = ideas.id
GROUP BY ideas.id
ORDER BY ideas.rowid;
```

### References With Tags

```sql
SELECT
  reference_assets.id,
  reference_assets.title,
  reference_assets.source,
  reference_assets.thumb_path,
  json_group_array(reference_tags.tag) AS tags
FROM reference_assets
LEFT JOIN reference_tags ON reference_tags.reference_id = reference_assets.id
GROUP BY reference_assets.id
ORDER BY reference_assets.rowid;
```

### Traceable Outline Draft

```sql
SELECT
  id,
  title,
  created_at,
  sections_json
FROM outline_drafts
ORDER BY position;
```

`sections_json` is intentionally snapshot-like so an outline can preserve the exact synthesis at rebuild time while still resolving current reference thumbnails by `referenceIds`.
