# System Architecture

---

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Chrome Browser                        │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  WXT Extension (MV3)                                  │  │
│  │  ├── content_script.ts  ← intercept drag events      │  │
│  │  ├── context_menu.ts    ← right-click "Capture"      │  │
│  │  └── background.ts      ← WebSocket client           │  │
│  └──────────────────────────┬───────────────────────────┘  │
└─────────────────────────────┼───────────────────────────────┘
                              │ WebSocket ws://127.0.0.1:9001
┌─────────────────────────────┼───────────────────────────────┐
│  Tauri 2.0 Desktop App      │                               │
│                             ▼                               │
│  ┌─────────────────── Rust Backend ───────────────────┐    │
│  │  ws_server.rs      ← tokio-tungstenite              │    │
│  │  commands/                                          │    │
│  │  ├── images.rs     ← download, thumbnail, colors   │    │
│  │  ├── taxonomy.rs   ← CRUD axes/tags                │    │
│  │  └── search.rs     ← similarity queries            │    │
│  │  db/                                               │    │
│  │  └── sqlite via tauri-plugin-sql                   │    │
│  └──────────────────────┬──────────────────────────────┘   │
│                         │ Tauri Events / Commands           │
│  ┌──────────────────────▼──────────────────────────────┐   │
│  │  React 19 Frontend                                   │   │
│  │  ├── DropZoneWindow   (always-on-top, 200×200px)    │   │
│  │  ├── MainWindow                                     │   │
│  │  │   ├── GridView      (thumbnail grid)            │   │
│  │  │   ├── GraphView     (reagraph 2D)               │   │
│  │  │   ├── GalaxyView    (reagraph 3D)               │   │
│  │  │   └── AxisView      (2-axis scatter)            │   │
│  │  └── TaxonomyPanel    (cmdk overlay)               │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Data flow: Image Capture

```
1. User drags image in Chrome
        ↓
2. WXT content_script detects dragstart
   - Reads: event.dataTransfer.getData('text/uri-list')
   - Reads: document.title, window.location.href
        ↓
3. background.ts sends via WebSocket:
   {
     type: "image_import",
     imageUrl: "https://...",
     sourceUrl: "https://page.com/...",
     pageTitle: "Article title"
   }
        ↓
4. Rust ws_server.rs receives message
        ↓
5. images.rs:
   a. reqwest::get(imageUrl)         → raw bytes
   b. image::thumbnail(300, 300)     → thumb bytes
   c. sha256(bytes)                  → dedup check
   d. write to ~/.vrb/images/{id}.*
   e. write to ~/.vrb/thumbs/{id}.*
        ↓
6. Frontend receives Tauri event: "image:imported"
   { imageId, thumbPath, dominantColors }
        ↓
7. TaxonomyPanel (cmdk) opens
   - Shows CLIP suggestions (async, may arrive later)
   - User assigns tags with keyboard
        ↓
8. taxonomy.rs saves image_tags to SQLite
        ↓
9. GraphView updates — new node appears
```

---

## Data flow: CLIP Auto-tagging

```
1. Image saved to disk
        ↓
2. Rust emits event: "image:ready_for_embedding"
        ↓
3. React: transformers.js worker picks up
   - Loads Xenova/clip-vit-base-patch16 (cached)
   - Generates 768-dim embedding for image
        ↓
4. Embedding stored in SQLite (images.embedding JSON)
        ↓
5. Cosine similarity vs pre-computed label embeddings
   Labels: all existing tag names in user's taxonomy
        ↓
6. Top 5 suggestions surfaced in TaxonomyPanel
   "Looks like: minimalist, blue, architecture"
```

---

## Multi-window architecture

```
Main Process (Rust)
├── Window: "drop-zone"
│   ├── Size: 200×200px
│   ├── always_on_top: true
│   ├── transparent: true
│   └── React: <DropZoneWindow />
│
└── Window: "main"
    ├── Size: 1280×800px (resizable)
    ├── React: <MainApp />
    └── Views: Grid | Graph | Galaxy | Axis
```

System tray icon toggles drop-zone window visibility.

---

## WebSocket protocol

All messages are JSON with a `type` discriminant.

### Extension → Tauri

```typescript
// Import image from drag or context menu
{
  type: "image_import",
  imageUrl: string,
  sourceUrl: string,
  pageTitle: string,
  timestamp: number
}
```

### Tauri → Extension

```typescript
// Confirm receipt + processing
{
  type: "import_ack",
  imageId: string,
  status: "processing" | "duplicate" | "error"
}

// Processing complete
{
  type: "import_complete",
  imageId: string,
  thumbDataUrl: string,       // for inline preview in extension popup
  dominantColors: string[],   // OKLCH strings
  clipSuggestions: string[]   // top tag suggestions
}
```

---

## File system layout

```
~/.visual-research-board/
├── db.sqlite              ← all metadata, tags, taxonomy
├── images/
│   ├── {id}.jpg           ← original cached image
│   └── ...
├── thumbs/
│   ├── {id}.jpg           ← 300px thumbnail
│   └── ...
└── models/
    └── clip-vit-base/     ← transformers.js model cache
        ├── config.json
        ├── tokenizer.json
        └── model.onnx
```

---

## State management (Zustand stores)

```typescript
// Image store
{
  images: Map<string, Image>,
  selectedIds: Set<string>,
  fetchImages: (filter?: TagFilter) => void,
  importFromUrl: (url: string) => void
}

// Taxonomy store
{
  axes: Axis[],
  tags: Map<string, Tag[]>,         // axisId → tags
  createAxis: (name: string) => void,
  assignTag: (imageId, tagId) => void
}

// View store
{
  currentView: 'grid' | 'graph' | 'galaxy' | 'axis',
  activeFilters: TagFilter[],
  graphLayout: 'force' | 'radial' | 'hierarchical',
  axisX: string | null,             // axis id
  axisY: string | null
}

// UI store
{
  taxonomyPanelOpen: boolean,
  taxonomyPanelTarget: string | null,   // imageId being tagged
  commandOpen: boolean
}
```
