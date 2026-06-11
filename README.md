# KIRA

Visual research workspace for linking references to ideas and producing traceable outlines.

Core loop:

```txt
Import references -> create ideas -> link references to ideas -> tag the collection -> create outline
```

KIRA is a standalone desktop app first. Eagle can become an import/sync adapter later, but KIRA owns the idea-reference graph.

## Apps

```txt
apps/
  desktop/      Tauri 2 + React prototype
  extension/    Chrome MV3 capture helper
```

## Run

```bash
pnpm install
pnpm dev
```

Desktop shell:

```bash
pnpm --filter @kira/desktop tauri dev
```

Build gates:

```bash
pnpm build
pnpm --filter @kira/desktop tauri build --debug
```

Chrome extension build:

```bash
pnpm --filter @kira/extension build
```

Load `apps/extension/dist` as an unpacked Chrome extension.

The debug desktop bundle is written to:

```txt
apps/desktop/src-tauri/target/debug/bundle/macos/KIRA.app
```

## Current State

- React/Vite workflow prototype
- Tauri desktop shell scaffold
- Library / Canvas / Inspector / Outline
- local image, native folder, pasted image, pasted URL, and native screenshot capture
- native folder import can read Eagle-style item folders and map item metadata into KIRA references
- Tauri can import the first page of local Eagle Web API V2 items when Eagle is running
- Chrome extension helper captures image/page references and sends them directly to the running KIRA app
- extension popup can discover page images, select multiple references, and send them as individual captures
- clipboard payload capture remains as fallback when the app is unavailable
- duplicate reference skip through persisted fingerprints and local perceptual hashes
- idea CRUD and link CRUD
- Library search, tag filters, density toggle, multi-select, batch tag
- Library rows are virtualized for larger reference sets
- tag add/remove editing in Inspector
- tag suggestions can carry source, confidence, and status metadata while older plain suggestions remain readable
- tag suggestions can be accepted or rejected directly in Inspector
- local deterministic taxonomy adds palette, aspect, brightness, and color-family tags for image captures/imports
- Apple Vision OCR can add local text-derived tag suggestions for data-backed images in the Tauri app
- Apple Vision OCR uses a bundled sidecar helper in the `.app`, with Swift script fallback for development machines
- OCR suggestions are refined locally with a bundled Apple Natural Language helper when available
- Apple Foundation Models availability and tag refinement use a bundled sidecar helper in the `.app`
- selected references can be linked directly to the selected idea
- relation picker applies to drag/drop links and selected-reference linking
- graph nodes can be repositioned directly and saved with the project
- graph canvas has scope and relation filters for larger reference sets
- graph canvas caps visible nodes for larger libraries while preserving the current selection neighborhood
- dev builds expose `window.__kiraDev` for loading 120/300-reference benchmark fixtures and reading Canvas metrics
- graph canvas has compact zoom and reset controls, with background panning
- graph canvas has an Edit / Discover mode; Discover clusters references around idea support and shows inferred weak-support edges without saving them as truth
- Discover mode can filter all references, candidate support, or open references
- project snapshot save/load through browser JSON fallback
- Tauri package save/load in app data
- native New, Open, and Save As for `.kira` project packages
- normalized SQLite tables for ideas, references, links, tags, and tag suggestions
- schema migration ledger in SQLite
- outline drafts and reference contact sheets can export to static files, with native exports written to `exports/`
- persisted reference fingerprints and perceptual hashes for duplicate detection
- near-duplicate candidates appear in project diagnostics through local perceptual hash distance
- persisted optional reference origin metadata for adapter imports
- reference thumbnails show a recoverable missing state if an image path or URL fails
- imported data URL images are copied into `images/`
- generated PNG thumbnails are written into `thumbs/`

Persistence is not complete yet. The next step is graph engine evaluation for larger discovery views once real 100-300 node libraries are imported.

## Documentation

- [Project Plan](./docs/PROJECT_PLAN.md)
- [Tech Stack Research](./docs/RESEARCH.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [Database Schema](./docs/DATABASE.md)
- [UI Design System](./docs/UI_DESIGN.md)
