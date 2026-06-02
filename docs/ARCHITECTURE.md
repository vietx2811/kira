# System Architecture

Vixio is a standalone desktop-first visual research workspace. Eagle and the Chrome extension are adapters into Vixio; the idea/reference graph remains owned by the Vixio project package.

## Runtime Shape

```txt
Chrome Extension (MV3)
  ├─ context menu capture
  ├─ popup page image discovery
  ├─ direct localhost POST to Vixio
  └─ clipboard fallback

Tauri Desktop App
  ├─ Rust commands
  │  ├─ project package save/open
  │  ├─ folder import and Eagle-style metadata import
  │  ├─ screenshot capture
  │  ├─ Apple Vision OCR helper
  │  ├─ Apple Natural Language helper
  │  └─ Apple Foundation Models helper
  ├─ local capture HTTP listener on 127.0.0.1:47653
  └─ React/Vite frontend
     ├─ Library
     ├─ Canvas
     ├─ Inspector
     └─ Outline
```

## Project Package

```txt
Project.vixio/
  manifest.json
  project.sqlite
  images/
  thumbs/
  exports/
```

- `manifest.json` stores the current `ProjectSnapshot` for portability and browser fallback.
- `project.sqlite` stores normalized project data for native desktop open/save.
- `images/` stores materialized imported image assets when the source is a data URL.
- `thumbs/` stores generated PNG thumbnails.
- `exports/` stores generated outputs such as `outline.md`, `outline.html`, and `contact-sheet.html`.

## Core Data Model

```txt
Reference stores material.
Idea stores concept.
Link stores meaning.
OutlineDraft stores synthesis.
```

Current snapshot shape:

```ts
type ProjectSnapshot = {
  version: 1
  ideas: Idea[]
  images: Reference[]
  links: Link[]
  outlineDrafts: OutlineDraft[]
}
```

At this prototype stage, snapshot v1 requires `outlineDrafts`; older local test snapshots are not supported.

## Frontend Data Flow

```txt
Import reference
  -> create Reference in Library
  -> deterministic local taxonomy suggestions
  -> optional OCR/local model suggestions
  -> user accepts/rejects tags in Inspector

Create or select Idea
  -> link selected/dragged References to Idea
  -> Link stores relation, note, confidence
  -> Canvas and Inspector update from the same state

Create Outline
  -> graph is synthesized into OutlineDraft sections
  -> sections preserve ideaId and referenceIds
  -> Outline resolves current thumbnails and navigates back to Canvas
```

## Persistence Flow

```txt
React state
  -> ProjectSnapshot
  -> browser mode: localStorage + JSON download
  -> Tauri mode: manifest.json + project.sqlite + assets/thumbs
```

Native `save_project_package`:

1. parse `ProjectSnapshot`
2. ensure package directories exist
3. write `manifest.json`
4. open/migrate `project.sqlite`
5. write normalized ideas, references, links, tags, tag suggestions, and outline drafts
6. materialize data URL images into `images/` and `thumbs/`

Native `open_project_package`:

1. prefer `project.sqlite` when present
2. read normalized rows back into `ProjectSnapshot`
3. fall back to `manifest.json` only when SQLite is absent

## Local Intelligence

No remote AI is required for Round 1.

- deterministic image analysis: palette, aspect, brightness, color-family tags
- Apple Vision OCR: text-derived suggestions for data-backed images
- Apple Natural Language: local keyword refinement when available
- Apple Foundation Models: local tag normalization when available

All generated suggestions remain suggestions until the user accepts them. Accepted tags are stored separately from suggestion records.

## Graph Strategy

Round 1 keeps the DOM/SVG Canvas as the editing surface:

- confirmed links are the source of truth
- Discover mode shows inferred weak-support edges without saving them as truth
- node cap and filters keep 100-300 reference projects usable
- 3D/force engines are deferred until real-project readability, not raw node count, proves the need

## Extension Protocol

The extension sends capture payloads directly to the local app listener. If the app is unavailable, it writes a Vixio capture payload to the clipboard for paste import.

```ts
type VixioCapturePayload = {
  vixioCapture: 1
  kind: 'image' | 'page'
  url: string
  title: string
  source: string
  pageUrl?: string
  capturedAt: string
}
```
