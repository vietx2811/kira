# Roadmap

---

## Phase 1 — Capture & Taxonomy (2–3 weeks)

**Goal:** End-to-end: drag image from Chrome → tag it → see it in grid

### Desktop app
- [ ] Tauri 2.0 project init (React 19 + Vite 6 + Tailwind v4)
- [ ] SQLite schema migration setup (tauri-plugin-sql)
- [ ] Always-on-top drop zone window (Tauri multi-window)
- [ ] System tray icon → toggle drop zone visibility
- [ ] Image download + thumbnail generation (Rust)
- [ ] Dominant color extraction (colorthief v3, JS side)
- [ ] Grid view with virtual scroll
- [ ] Sidebar with axes + tags + filter
- [ ] TaxonomyPanel (cmdk) — assign tags

### Chrome extension (WXT)
- [ ] WXT project init (React + TypeScript)
- [ ] Content script: intercept drag events → send to Tauri
- [ ] Context menu: "Capture to Research Board"
- [ ] WebSocket client → connect to Tauri WS server
- [ ] Popup: recent captures, connection status

### Infrastructure
- [ ] Monorepo setup (pnpm workspaces)
- [ ] Shared TypeScript types (apps/shared)
- [ ] WebSocket server in Rust (tokio-tungstenite)

---

## Phase 2 — Graph Visualization (2 weeks)

**Goal:** Switch from grid to live force graph and see taxonomy structure

- [ ] reagraph integration (2D force graph)
- [ ] Image thumbnails as node textures (Three.js material)
- [ ] Node size = number of tags
- [ ] Node glow color = dominant color of image
- [ ] Edge generation from shared tags (SQLite query)
- [ ] Motion v12 layout transitions: Grid ↔ Graph
- [ ] Filter real-time → graph re-simulates
- [ ] Axis view (X/Y scatter by two taxonomy axes)
- [ ] reagraph 3D Galaxy mode

---

## Phase 3 — Intelligence (2–3 weeks)

**Goal:** App starts helping the user tag and discover

- [ ] transformers.js CLIP integration
- [ ] Background model download with progress
- [ ] Auto-tag suggestions when image is imported
- [ ] Embedding storage in SQLite
- [ ] "Find similar images" — cosine similarity search
- [ ] Bulk tagging (select multiple → assign tag)
- [ ] Tag autocomplete / create from taxonomy panel
- [ ] Branch/mind-map view (tree of branches with images)

---

## Phase 4 — Polish & Export (1–2 weeks)

**Goal:** App feels finished, shareable

- [ ] Export board view → PNG / PDF
- [ ] Full keyboard shortcut coverage
- [ ] Onboarding flow (empty state → first capture)
- [ ] Settings panel (default axes, shortcuts, storage path)
- [ ] Undo/redo for tag operations
- [ ] Performance audit (virtual list, graph node cap)
- [ ] App icon + branding
- [ ] Auto-updater (Tauri built-in)

---

## Future (post-v1)

- [ ] Sync to cloud (Supabase) — optional, privacy-first
- [ ] Share board as static HTML
- [ ] Firefox extension support (WXT supports it)
- [ ] Multiple research boards / projects
- [ ] Import from Figma (drag frame → board)
- [ ] AI-generated taxonomy axes from image collection
