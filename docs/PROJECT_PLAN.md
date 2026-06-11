# KIRA Project Plan

> Updated: June 2026  
> Current direction: standalone desktop app first, Eagle as workflow reference and later import/sync adapter.

---

## Product thesis

KIRA is a visual research workspace where ideas are built from traceable visual references.

The core loop is:

```txt
Import references
→ create ideas
→ link references to ideas
→ tag and inspect the collection
→ generate an outline with traceable sources
```

KIRA is not primarily an image manager, moodboard, or graph toy. The product value is the relationship layer:

```txt
Which reference supports which idea?
Why?
What outline can be produced from that evidence?
```

---

## Vocabulary

Visible UI should use familiar interface language. Avoid domain-heavy labels in default chrome.

| Use in UI | Avoid in UI chrome | Notes |
|---|---|---|
| Library | Evidence Inbox | Standard term for asset browser. |
| References | Captured references / Evidence | Good for images, screenshots, links, and source material. |
| Canvas | Evidence Graph title text | The canvas should not explain itself with headings. |
| Inspector | Detail panel / Evidence editor | Standard right-panel pattern. |
| Selection | Idea selected / Image selected / Evidence link | Inspector state can be generic. |
| Idea | Idea node | Node is implementation language. |
| Link | Evidence relation | Use relation details inside fields, not panel titles. |
| Tags | Taxonomy | Taxonomy is a concept, Tags is the control. |
| Outline | Draft outline | Keep action labels short. |

Domain terms such as `EvidenceLink`, `TagSuggestion`, and `IdeaNode` are still valid internally.

---

## Eagle reference

Eagle is the strongest reference for the Library side of the app:

- fast visual browsing
- folders and smart folders
- tags and tag groups
- image comments / annotations
- source-like metadata
- batch organization
- reference-first density

Relevant docs:

- Eagle organize support: <https://en.eagle.cool/support/desktop/organize>
- Eagle plugin item API: <https://developer.eagle.cool/plugin-api/api/item>
- Eagle Web API: <https://developer.eagle.cool/web-api>

What to borrow from Eagle:

- left Library panel should feel fast and asset-native
- tags should be compact, visible, and easy to apply in batches
- search/filter should be always nearby
- import should be obvious but not visually dominant
- metadata belongs in Inspector, not repeated everywhere
- smart folders are a useful mental model for saved filters

What not to copy:

- KIRA should not become a full image manager clone
- folder/tag organization is secondary to idea-reference links
- references can come from Eagle later, but KIRA owns the meaning graph

Integration stance:

```txt
Round 1: standalone app
Round 2: import from Eagle library or selected Eagle export
Round 3: optional Eagle plugin/adapter if standalone workflow proves valuable
```

Do not make KIRA an Eagle plugin first. That increases integration complexity before the core workflow is proven.

---

## Current prototype status

Implemented in `apps/desktop`:

- React + Vite prototype
- Tauri desktop shell scaffold
- three-pane layout: Library / Canvas / Inspector
- image reference list with tags and source
- Library renders a virtual row window for larger reference sets
- local image, native folder, pasted image, pasted URL, and native screenshot capture
- duplicate reference skip through persisted fingerprints and local perceptual hashes
- near-duplicate candidates are surfaced in diagnostics through local `ahash` distance
- browser JSON fallback and Tauri project package manifest save/load
- graph canvas with idea nodes, image nodes, and links
- direct graph node repositioning with persisted `x/y` layout
- graph scope and relation filters in the canvas controls
- graph zoom/reset controls and background panning
- graph node cap for large libraries, plus dev-only benchmark fixtures exposed through `window.__kiraDev`
- graph Edit / Discover mode with inferred weak-support edges that do not mutate saved links
- Discover support filter for all, candidate, and open references
- 3D discovery view using `3d-force-graph`, with relation filters, All / Linked / Focus scope controls, camera focus/reset, and non-mutating cloned graph data
- Slideshow view with autolayout (`focus`, `grid`, `stack`) derived from evidence density, relation mix, support ratio, and content length
- Slideshow presenter mode with browser CSS fallback and Tauri fullscreen support
- Slideshow HTML export writes layout reason and relation mix into the generated file
- Tauri shell uses a frameless transparent window with custom controls, drag fallback, native window effects where available, and CSS liquid-glass fallback
- create idea
- outline drafts are stored in project snapshots and SQLite packages
- Library can export the current reference view as a static contact sheet
- edit idea title/body in Inspector
- select references and links
- change link relation
- Inspector linked reference/idea lists cap default rendering with an explicit expand control for large projects
- Outline review includes compact project diagnostics for weak ideas, unlinked references, missing thumbnails, and duplicate candidates
- choose relation while creating links from Canvas or selected references
- filter graph by visibility scope and relation
- edit link note
- remove links
- accept tag suggestions
- add and remove reference tags in Inspector

Implemented in `apps/extension`:

- Chrome MV3 extension scaffold
- popup capture for the active page
- context-menu image capture
- popup image discovery and multi-select capture from the active page
- direct localhost delivery to the running KIRA app
- clipboard payload fallback that KIRA can paste into the Library

Current prototype is moving from UI/workflow proof toward desktop architecture. The Tauri shell currently writes a package manifest, normalized SQLite database, imported image assets, generated PNG thumbnails, and a basic migration ledger.

---

## Architecture direction

### App layers

```txt
KIRA Desktop Shell
├── Library
│   ├── references
│   ├── import
│   ├── tags
│   └── search/filter
├── Canvas
│   ├── idea nodes
│   ├── reference nodes
│   ├── links
│   └── graph layout
├── Inspector
│   ├── selected reference
│   ├── selected idea
│   ├── selected link
│   └── actions
├── Outline
│   ├── generated sections
│   ├── evidence back-links
│   └── weak/missing support
└── Local Intelligence
    ├── deterministic tags
    ├── Apple Vision / OCR
    ├── Apple Foundation Models for text reasoning
    └── future local CLIP/Core ML
```

### Source of truth

Round 1 should use a local project package:

```txt
project.kira/
  project.sqlite
  images/
  thumbs/
  exports/
```

Core entities:

- `Project`
- `Reference`
- `Idea`
- `Link`
- `Tag`
- `TagSuggestion`
- `Outline`

The important invariant:

```txt
Reference stores material.
Idea stores concept.
Link stores meaning.
Outline stores synthesis.
```

---

## UI plan

### Phase UI-1: reduce chrome and finalize vocabulary

Goal: make the prototype feel like a real desktop tool, not a dashboard mock.

Tasks:

- remove explanatory headings from canvas
- keep panels named `Library`, `Canvas`, `Inspector`, `Outline`
- replace verbose labels with standard terms
- hide secondary metadata unless selected
- remove unnecessary border boxes
- keep only selected states, hover states, and section separators
- use icons for primary actions where obvious
- avoid empty instructional copy on the main canvas

Acceptance:

- first screen reads as a tool, not a landing page or dashboard
- graph remains the visual center
- Discover mode is a reading layer; Edit remains the source of CRUD and saved layout
- no visible copy explains the product concept
- all copy is short and standard

### Phase UI-2: Library polish

Goal: make reference browsing feel Eagle-like.

Tasks:

- implement working search/filter over title/source/tags
- add multi-select
- add batch tag action
- add import drop area only when dragging or empty
- add compact filter chips
- add view density toggle: compact / relaxed
- add source and tag sorting
- add selected count footer

Eagle reference:

- visual list density
- tags shown inline
- smart folder mental model for saved filters

Acceptance:

- user can find and select references quickly
- tags do not dominate thumbnails
- import affordance is present but not loud

### Phase UI-3: Canvas interaction

Goal: make linking references to ideas feel direct.

Tasks:

- drag reference from Library onto idea
- create link from selected reference to selected idea
- add relation picker near link creation (done)
- add keyboard shortcut to create idea (done)
- allow repositioning idea and reference nodes (done)
- prevent graph overlap at default zoom
- add subtle pan/zoom controls only on demand (done)
- distinguish confirmed links from suggestions

Acceptance:

- user can answer "this image supports this idea" in one interaction
- graph stays clean with 20-50 references
- selected link is obvious without heavy glow

### Phase UI-4: Inspector polish

Goal: make Inspector the only place for detailed editing.

Tasks:

- normalize selected states: Reference / Idea / Link (done)
- use editable title/body/note fields with low form chrome
- move destructive actions to bottom
- add relation selector for links
- add tag editing for references (done)
- add source metadata under disclosure (done)
- add confidence/suggestions under disclosure (confidence done)
- add keyboard focus behavior (new idea title focus done)
- cap long linked-reference and linked-idea lists with explicit expand controls (done)

Acceptance:

- no duplicated metadata across Library and Inspector
- Inspector feels like a native detail panel
- common edits need no modal
- selecting a high-degree idea does not flood the right panel by default

### Phase UI-5: Outline view

Goal: prove KIRA is more than moodboarding.

Tasks:

- add Outline tab
- generate static mock outline from selected idea cluster
- show each outline section with linked references
- click outline item highlights supporting references and ideas (done)
- mark weak sections with missing support
- add "Create outline" action from idea selection
- add Outline quality filters and compact support counts (done)
- cap long outline reference rows with explicit expand controls (done)

Acceptance:

- outline is traceable to references
- user can navigate from outline back to graph
- UI makes evidence quality visible
- sections with many references remain scannable by default

---

## Functional plan

### Phase 1: UI workflow prototype

Status: in progress.

Scope:

- no real persistence required beyond local React state
- no Tauri backend yet
- no remote AI

Deliverables:

- Library / Canvas / Inspector / Outline prototype
- CRUD for ideas
- CRUD for links
- tag suggestion accept/reject
- mock outline from graph selection
- browser-verified UI

### Phase 2: project persistence

Status: in progress.

Current state:

- `src-tauri` app shell exists
- frontend can call Rust through Tauri commands
- native New, Open, and Save As dialogs are wired for `.kira` project package paths
- native folder import is wired from Library and creates local reference records
- native folder import now detects Eagle-style item folders with metadata JSON and maps item metadata into KIRA references
- native screenshot capture is wired from Library through macOS `screencapture`
- Chrome extension capture is scaffolded and sends image/page captures directly to the running app, with clipboard fallback
- Chrome extension popup can discover page images and send selected images as separate references
- deterministic local image analysis adds palette, aspect, brightness, and color-family tags
- Apple Vision OCR is wired as a local Tauri command for data-backed images and writes text-derived terms as suggestions
- Apple Vision OCR now uses a bundled Tauri sidecar helper in the `.app`, with script fallback retained
- Apple Foundation Models availability and tag refinement use a bundled Tauri sidecar helper; when available, the Inspector can refine reference tag suggestions locally
- `save_project_package` creates:

```txt
KIRA Demo.kira/
  manifest.json
  project.sqlite
  images/
  thumbs/
  exports/
```

- SQLite currently stores `ideas`, `reference_assets`, `links`, accepted tags, tag suggestions, and outline drafts
- SQLite records applied schema migrations in `schema_migrations`
- data URL imports are materialized into `images/` and `thumbs/`
- pasted URLs are captured as references with source URL metadata
- reference fingerprints and perceptual hashes are persisted for duplicate detection
- near-duplicate diagnostics use an 8-bit local `ahash` distance threshold until real-library tuning is available
- optional origin metadata (`originApp`, `originId`, `sourcePath`) is persisted for adapter imports
- browser mode still falls back to localStorage and JSON download

Scope:

- save/open `.kira` project package
- SQLite schema
- reference asset paths and thumbnails
- ideas, tags, links, outline drafts

Tasks:

- create `project.sqlite` (done)
- implement migrations (basic schema ledger done)
- save graph layout (done for node `x/y`)
- save inspector edits
- save outline drafts (done)
- save tag suggestions separately from accepted tags
- materialize imported assets into `images/` (done for data URL imports)
- generate thumbnails into `thumbs/` (done for data URL imports)
- implement project new/open/save-as (done for Tauri shell)
- persist duplicate fingerprints and perceptual hashes for imported/captured references (done)

Acceptance:

- quitting and reopening preserves project state
- graph links are not encoded as flat tags
- references can be missing and show recoverable state (done with shared thumbnail fallback)

### Phase 3: import and capture

Scope:

- practical local import first
- browser capture later

Tasks:

- file drag/drop import
- folder import (done for native desktop shell)
- paste image or URL (done for focused app / Library)
- native screenshot capture (done for macOS desktop shell)
- Chrome extension image/page capture via direct localhost delivery with clipboard fallback (done)
- extension multi-image page capture (done)
- thumbnail generation
- dominant colors (basic local palette done)
- source URL field
- duplicate detection (fingerprint and basic perceptual hash skip done)

Deferred:

- richer extension metadata extraction for selected images
- always-on-top drop zone
- Eagle sync

Acceptance:

- user can build a reference set without developer tools
- import is reliable before adding browser integrations

### Phase 4: local taxonomy

Scope:

- no remote AI
- deterministic first
- Apple local frameworks where available

Tasks:

- deterministic tags: colors, aspect ratio, source domain, filename (basic local image analysis done)
- OCR via Apple Vision (basic local command done)
- OCR helper packaging (bundled Tauri sidecar done)
- text keyword extraction from OCR output (basic local token extraction done)
- text keyword extraction via Natural Language (bundled helper done)
- Apple Foundation Models for tag normalization from text context (bundled helper done)
- suggestion records with source/confidence/status (done)
- accept/reject workflow (done)

Acceptance:

- suggestions are visibly different from accepted tags
- no AI suggestion silently becomes truth
- app works when Apple Intelligence is unavailable

### Phase 5: graph engines

Scope:

- keep 2D graph as main editing surface
- use 3D graph only for discovery

Tasks:

- replace handmade graph with graph engine if needed
- evaluate `react-force-graph-2d`
- evaluate `react-force-graph-3d`
- add graph layout persistence
- add node cap and visibility filters (node cap and scope filter done)
- add relation filters (done)
- add 3D discovery view with relation + scope filtering (done)
- add local discovery layout for idea/reference support clusters (done)
- add weak-support filters for large graphs (done)
- add repeatable browser benchmark fixture for 120/300 references (done)

Acceptance:

- editing remains simple in 2D
- 3D does not become required for core CRUD
- performance remains acceptable with 100-300 visible nodes

Current benchmark notes:

- Browser QA at 1180x760 with dev fixture 120 references: 126 total nodes, 90 saved links, 30 Discover suggestions, no horizontal or vertical document overflow.
- Browser QA at 1180x760 with dev fixture 300 references and cap 300: 308 total nodes, 300 visible nodes, 225 saved links, no document overflow.
- Browser QA at 1180x760 with dev fixture 300 references and cap 75 in Discover: 75 visible nodes, no document overflow.
- Browser QA at 1180x760 with dev fixture 300 references: selecting a high-degree idea renders 8 Inspector references by default, exposes `Show 21 more`, and does not create document overflow.
- Browser QA at 1180x760 with dev fixture 300 references: Outline renders 8 sections, caps the first section to 6 references by default, exposes `Show 23 more`, expands to 29 references, and does not create document overflow.
- Browser QA at 1180x760 with dev fixture 120 references: Canvas, 3D discovery, and slideshow presenter mode render without horizontal or vertical document overflow.
- Browser QA at 1440x900 with dev fixture 120 references: 3D discovery renders 126 nodes / 90 links in All scope with a WebGL canvas, while slideshow presenter mode hides the rail and keeps the slide surface one-column.
- Interpretation: keep the current DOM/SVG graph for Round 1 editing. Use the 3D force graph as a discovery view only; 2D remains the source of editing and CRUD.

### Phase 6: Eagle integration

Scope:

- Eagle is an adapter, not the app shell.

Options:

1. Import from Eagle export / folder
2. Read Eagle via local Web API
3. Optional Eagle plugin once workflow is stable

Tasks:

- map Eagle item metadata to KIRA Reference (folder/export metadata done)
- preserve Eagle item id/source path where available (done through optional origin metadata)
- import tags as candidate tags (done as tag suggestions, not accepted tags)
- read first-page Eagle Web API V2 items from local `/api/v2/item/get` when Eagle is running (done)
- never store KIRA idea links as Eagle-only tags
- optional write-back for accepted flat tags

Acceptance:

- Eagle can feed references into KIRA
- KIRA project remains portable
- idea/reference links stay in KIRA

---

## UI quality bar

Before calling a UI pass done:

- run the app in browser
- inspect desktop viewport around 1440x900
- inspect smaller desktop around 1180x760
- verify no text overlaps
- verify the canvas is the visual center
- verify all primary controls have visible selected/hover states
- verify no unnecessary explanatory copy appears in default view
- verify terms match the vocabulary table
- verify the core workflow:
  - create idea
  - select reference
  - link reference to idea
  - edit link relation/note
  - create outline from idea

---

## Immediate next steps

1. Import a larger real project and compare readability against the dev 120/300 reference benchmark.
2. Tune perceptual duplicate thresholds once larger real libraries are imported.
3. Evaluate graph engines for discovery views only if real-project readability breaks the current capped Canvas.
4. Add Natural Language keyword extraction when it improves over current token extraction.
