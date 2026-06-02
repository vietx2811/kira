# Roadmap

`docs/PROJECT_PLAN.md` is the canonical product/implementation plan. This file is a short execution roadmap for the current desktop prototype.

## Round 1 — Standalone Desktop Workflow

Goal: prove the core loop locally before adding heavier integrations.

- [x] React/Vite desktop prototype
- [x] Tauri 2 desktop shell
- [x] Library / Canvas / Inspector / Outline
- [x] image import, folder import, paste URL/image, screenshot capture
- [x] Chrome MV3 capture helper with direct localhost delivery and clipboard fallback
- [x] deterministic local taxonomy suggestions
- [x] Apple Vision OCR helper
- [x] Apple Natural Language helper
- [x] Apple Foundation Models helper for local tag refinement
- [x] idea CRUD
- [x] link CRUD with relations and notes
- [x] graph node position persistence
- [x] project package save/open with SQLite, assets, and thumbnails
- [x] accepted tags and tag suggestions stored separately
- [x] outline drafts stored in snapshots and SQLite packages
- [ ] import a real 100-300 reference project and benchmark readability
- [ ] tune duplicate thresholds against real libraries

## Round 2 — Large Library Readability

Goal: keep Vixio usable when the reference set grows.

- [x] Library search/filter/sort
- [x] Library multi-select and batch tags
- [x] Canvas node cap and scope/relation filters
- [x] Discover mode with inferred weak-support edges
- [x] Inspector caps high-degree reference/idea lists
- [x] Outline caps long reference rows
- [x] virtualize Library rows for larger reference sets
- [ ] compare current Canvas against `react-force-graph-2d` only if real-project readability breaks
- [ ] evaluate `3d-force-graph` only as optional discovery, not core CRUD

## Round 3 — Eagle Adapter

Goal: let Eagle feed references into Vixio without making Vixio an Eagle plugin.

- [x] folder import maps Eagle-style item metadata
- [x] preserve optional `originApp`, `originId`, and `sourcePath`
- [x] import Eagle tags as suggestions, not accepted truth
- [ ] import selected Eagle library/export at larger scale
- [x] optional Eagle Web API reader
- [ ] optional accepted-flat-tag writeback

## Round 4 — Export And Review

Goal: make outputs useful outside the app.

- [x] Markdown export for outline drafts
- [x] static HTML export for traceable outline/reference review
- [x] board/contact-sheet export
- [x] project diagnostics: missing assets, duplicate candidates, weak ideas

## Deferred

- cloud sync
- collaborative editing
- full plugin architecture
- remote AI providers
- 3D-first graph editing
