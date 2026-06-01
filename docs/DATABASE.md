# Database Schema

SQLite via `tauri-plugin-sql`. All data stored locally at `~/.visual-research-board/db.sqlite`.

---

## Full schema

```sql
-- ─────────────────────────────────────────
-- TAXONOMY
-- ─────────────────────────────────────────

-- Taxonomy axes (dimensions of classification)
-- Built-in axes: mood, style, color, subject, project
-- Users can add custom axes
CREATE TABLE axes (
  id          TEXT PRIMARY KEY,         -- nanoid
  name        TEXT NOT NULL,
  color       TEXT NOT NULL,            -- OKLCH string for UI badge
  icon        TEXT,                     -- lucide icon name
  is_builtin  INTEGER DEFAULT 0,        -- 1 = cannot delete
  is_hidden   INTEGER DEFAULT 0,
  sort_order  INTEGER DEFAULT 0,
  created_at  INTEGER NOT NULL          -- unix ms
);

-- Tag values within each axis
CREATE TABLE tags (
  id          TEXT PRIMARY KEY,         -- nanoid
  axis_id     TEXT NOT NULL REFERENCES axes(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  color       TEXT,                     -- override axis color if set
  sort_order  INTEGER DEFAULT 0,
  created_at  INTEGER NOT NULL,
  UNIQUE(axis_id, label)
);

-- ─────────────────────────────────────────
-- IMAGES
-- ─────────────────────────────────────────

CREATE TABLE images (
  id               TEXT PRIMARY KEY,    -- nanoid
  file_path        TEXT NOT NULL,       -- absolute path to cached original
  thumb_path       TEXT NOT NULL,       -- absolute path to 300px thumbnail
  source_url       TEXT,                -- original web URL
  page_url         TEXT,                -- URL of page image was found on
  page_title       TEXT,
  width            INTEGER,
  height           INTEGER,
  file_size        INTEGER,             -- bytes
  mime_type        TEXT,
  dominant_colors  TEXT,               -- JSON: string[] of OKLCH values (top 5)
  embedding        TEXT,               -- JSON: number[] CLIP vector (768 dims)
  note             TEXT,               -- user freetext note
  is_deleted       INTEGER DEFAULT 0,  -- soft delete
  captured_at      INTEGER NOT NULL    -- unix ms
);

-- ─────────────────────────────────────────
-- IMAGE ↔ TAGS  (many-to-many)
-- ─────────────────────────────────────────

CREATE TABLE image_tags (
  image_id    TEXT NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  tag_id      TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  assigned_at INTEGER NOT NULL,
  PRIMARY KEY (image_id, tag_id)
);

-- ─────────────────────────────────────────
-- BRANCHES  (mind-map grouping)
-- ─────────────────────────────────────────

CREATE TABLE branches (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  parent_id   TEXT REFERENCES branches(id) ON DELETE SET NULL,
  color       TEXT,
  icon        TEXT,
  pos_x       REAL DEFAULT 0,
  pos_y       REAL DEFAULT 0,
  is_expanded INTEGER DEFAULT 1,
  created_at  INTEGER NOT NULL
);

CREATE TABLE branch_images (
  branch_id   TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  image_id    TEXT NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  sort_order  INTEGER DEFAULT 0,
  PRIMARY KEY (branch_id, image_id)
);

-- ─────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────

CREATE INDEX idx_image_tags_image   ON image_tags(image_id);
CREATE INDEX idx_image_tags_tag     ON image_tags(tag_id);
CREATE INDEX idx_images_captured    ON images(captured_at DESC);
CREATE INDEX idx_tags_axis          ON tags(axis_id);
CREATE INDEX idx_branches_parent    ON branches(parent_id);
```

---

## Seed data (built-in axes)

```sql
INSERT INTO axes (id, name, color, icon, is_builtin, sort_order, created_at) VALUES
  ('axis_mood',    'Mood',    'oklch(68% 0.18 265)', 'sparkles',   1, 0, unixepoch() * 1000),
  ('axis_style',   'Style',   'oklch(68% 0.18 150)', 'palette',    1, 1, unixepoch() * 1000),
  ('axis_color',   'Color',   'oklch(68% 0.18 30)',  'droplets',   1, 2, unixepoch() * 1000),
  ('axis_subject', 'Subject', 'oklch(68% 0.18 330)', 'eye',        1, 3, unixepoch() * 1000),
  ('axis_project', 'Project', 'oklch(68% 0.18 200)', 'folder',     1, 4, unixepoch() * 1000);
```

---

## Common queries

### Images with all their tags (for graph nodes)

```sql
SELECT
  i.id,
  i.thumb_path,
  i.dominant_colors,
  i.captured_at,
  json_group_array(
    json_object(
      'tagId',    t.id,
      'label',    t.label,
      'axisId',   t.axis_id,
      'axisName', a.name,
      'color',    COALESCE(t.color, a.color)
    )
  ) AS tags
FROM images i
LEFT JOIN image_tags it ON it.image_id = i.id
LEFT JOIN tags t        ON t.id = it.tag_id
LEFT JOIN axes a        ON a.id = t.axis_id
WHERE i.is_deleted = 0
GROUP BY i.id
ORDER BY i.captured_at DESC;
```

### Filter images by tag combination (AND)

```sql
-- Images that have ALL of the given tag ids
SELECT i.*
FROM images i
WHERE i.is_deleted = 0
  AND (
    SELECT COUNT(DISTINCT it.tag_id)
    FROM image_tags it
    WHERE it.image_id = i.id
      AND it.tag_id IN ('tag_abc', 'tag_def', 'tag_ghi')
  ) = 3  -- must equal number of filter tags
ORDER BY i.captured_at DESC;
```

### Graph edges (shared tags between images)

```sql
-- Pairs of images sharing at least N tags (for force graph edges)
SELECT
  a.image_id AS source,
  b.image_id AS target,
  COUNT(*)   AS shared_tags
FROM image_tags a
JOIN image_tags b ON a.tag_id = b.tag_id AND a.image_id < b.image_id
GROUP BY a.image_id, b.image_id
HAVING shared_tags >= 1
ORDER BY shared_tags DESC
LIMIT 2000;  -- cap edges for graph performance
```

### Axis view (X/Y scatter layout)

```sql
-- Images positioned on two axes
-- Returns x_tag, y_tag for each image
WITH x_tags AS (
  SELECT it.image_id, t.label AS x_label, t.id AS x_tag_id
  FROM image_tags it
  JOIN tags t ON t.id = it.tag_id
  WHERE t.axis_id = ?  -- x axis id
),
y_tags AS (
  SELECT it.image_id, t.label AS y_label, t.id AS y_tag_id
  FROM image_tags it
  JOIN tags t ON t.id = it.tag_id
  WHERE t.axis_id = ?  -- y axis id
)
SELECT
  i.id,
  i.thumb_path,
  x.x_label,
  x.x_tag_id,
  y.y_label,
  y.y_tag_id
FROM images i
JOIN x_tags x ON x.image_id = i.id
JOIN y_tags y ON y.image_id = i.id
WHERE i.is_deleted = 0;
```

### Taxonomy summary (for sidebar stats)

```sql
SELECT
  a.id         AS axis_id,
  a.name       AS axis_name,
  a.color,
  t.id         AS tag_id,
  t.label,
  COUNT(it.image_id) AS image_count
FROM axes a
JOIN tags t        ON t.axis_id = a.id
LEFT JOIN image_tags it ON it.tag_id = t.id
LEFT JOIN images i ON i.id = it.image_id AND i.is_deleted = 0
GROUP BY a.id, t.id
ORDER BY a.sort_order, image_count DESC;
```

---

## Migration strategy

Migrations run on app startup via `tauri-plugin-sql`. Each migration is a numbered SQL file:

```
src-tauri/migrations/
├── 001_initial_schema.sql
├── 002_add_branches.sql
└── 003_add_embedding.sql
```

The plugin tracks applied migrations in a `_migrations` table automatically.
