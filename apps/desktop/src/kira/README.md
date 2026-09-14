# apps/desktop/src/kira

Data layer for the Kira right panel (Chat + "Cần bạn"). Pure TypeScript,
tested in isolation with `bun test apps/desktop/src/kira`. No React, no
zustand, no DOM, no import from `main.tsx` — this module was written while
another thread held `main.tsx`/`styles.css`, and staying decoupled means it
can be unit tested without the app at all (see CLAUDE.md "HMR resets state"
gotcha, and research §A8 "làm phần lõi trong module riêng thì test được").

Spec sources: `docs/design/right-panel/DECISIONS.md`,
`docs/research/2026-09-13-right-panel-and-research-harness.md` (§A2-A6),
`docs/research/2026-09-13-right-panel-harness-oss.md` (§2.2),
`docs/design/right-panel/mockup.js`.

## Files

- **`aiPanelTypes.ts`** — `AiThread`, `AiMessage`, `AiRun`, `AiChangeSet`,
  `AiChangeItem` (discriminated union: `create-node` / `edit-text` /
  `edit-palette` / `delete-node`), `AiSkillCheckpoint`, `AiNodeProvenance`,
  the `AiCanvasOperation` union returned by mutating model functions, and
  the aggregate `AiPanelState` these functions all operate over.
  `GraphNodeKind` and `AiProviderType` here are **copies** of the unions
  main.tsx already declares (main.tsx:568 and main.tsx:596) — kept in sync
  manually, since this module cannot import from main.tsx. If either union
  changes in main.tsx, mirror the change here.

- **`aiPanelModel.ts`** — pure functions over `AiPanelState`:
  `needsYouCount`, `summaryLine`, `bulkAcceptable`, `markStaleOnUserEdit`,
  `acceptItem` / `rejectItem` / `keepNode` / `removeAppliedNode` (+
  `acceptBulk` convenience), `setNodeProvenance` /
  `markNodeEditedAfterGeneration`, `threadsForNode`, and the serialization
  pair `toSnapshot` / `fromSnapshot`.

  Mutating functions return a uniform result instead of throwing on domain
  refusals (wrong status, missing `force`, not found):
  ```ts
  type AiModelResult =
    | { ok: true; state: AiPanelState; operations: AiCanvasOperation[] }
    | { ok: false; reason: string }
  ```
  `operations` is the list of canvas mutations for main.tsx to apply
  through its existing zundo history — this module never touches the
  canvas store directly.

- **`aiPanelModel.test.ts`** — `bun test apps/desktop/src/kira`. Fixtures
  mirror `mockup.js` scenarios s3 (`NEEDS_DECISION = 4`), s6 (a waiting
  skill checkpoint bumps it to 5), and s7 (accepting the one pending text
  edit drops it to 3).

- **`bun-test.d.ts`** — minimal ambient `declare module 'bun:test'` so
  `npx tsc --noEmit -p apps/desktop` typechecks the test file. There is no
  `bun-types`/`@types/bun` package in this workspace; see the file's own
  comment. Delete this file if `bun-types` is added later (it would
  redeclare the same module).

## Integration points for main.tsx (not done in this change — main.tsx was a
claimed hot file the whole time this module was written)

1. **State home.** Add an `AiPanelState` slice to the app (its own
   `useState`/reducer or a small zustand store — this module doesn't care).
   Seed it with `createEmptyAiPanelState()` and, on project load, with
   `fromSnapshot(loadedSnapshot.aiPanel)`.

2. **Kira toggle / "Cần bạn" tab / dock status line — DECISIONS.md #6.**
   All three must render the exact same number. Call
   `needsYouCount(aiPanelState)` once per render and pass it to
   `renderKiraDock()`, the file-tab-bar panel toggle, and the panel's tab
   badge. Do not compute this count three separate times.

3. **`createAiNode` (main.tsx:4711).** Currently builds an `Idea` and calls
   `recordNodeVersion('idea', undefined, idea, 'created')` with no
   provenance option (main.tsx:4794) — this is the `aiGenerated` bug noted
   in research §E.1. After this change lands:
   - Call `recordNodeVersion('idea', undefined, idea, 'created', { aiGenerated: true, note: runId })`.
   - Call `setNodeProvenance(aiPanelState, 'idea', idea.id, { aiGenerated: true, runId, threadId, editedAfterGeneration: false })`.
   - Append a `create-node` `AiChangeItem` (`status: 'applied'`,
     `editedByUserAfterApply: false`) to the run's `AiChangeSet` (create one
     if the run doesn't have one yet).
   - When the user later edits that node's content, call
     `markNodeEditedAfterGeneration(aiPanelState, 'idea', idea.id)` so the
     canvas badge can switch to "AI, đã sửa", **and** call
     `markStaleOnUserEdit(aiPanelState, idea.id, 'content', nowIso())` in
     case a separate pending `edit-text` proposal also targets this node.
   - "Gỡ node" in the panel calls `removeAppliedNode(aiPanelState, 'idea', nodeId)`;
     on `{ ok: false, reason: 'needs-force' }` show the mockup's
     "Bạn đã sửa nội dung node này…" guard and retry with `{ force: true }`
     only after the user confirms.

4. **`regeneratePalette` (main.tsx:4896).** Currently overwrites
   `before.colors` directly and records the version with trigger
   `'user_edit'` even when the AI path produced the colors (research §E.1,
   §A4 table: `set_palette_colors` must always wait for approval, decision
   #3). After this change lands, when the provider call succeeds:
   - Do **not** apply `colors` to the palette immediately.
   - Create an `AiEditPaletteItem` (`status: 'pending'`, `beforeColors:
     before.colors`, `afterColors: colors`) in the run's `AiChangeSet`
     instead.
   - Only when the user accepts it from "Cần bạn" (`acceptItem(...)` ->
     `{ type: 'update-node-palette', nodeId, colors }` operation) does
     main.tsx call `pushCanvasHistory()` + `setPalettes(...)` +
     `recordNodeVersion('palette', before, after, 'user_edit', { aiGenerated: true, note: runId })`.
   - If the provider call fails and falls back to local harmony math (the
     existing `generatePaletteHarmony` fallback), that path is a plain user
     action — keep applying it immediately as today, with no ChangeSet
     item, no `aiGenerated` provenance, and no silent "this is actually
     AI" ambiguity (fixing the "no source label" complaint in research
     §B4/color-expert row).

5. **Applying `AiCanvasOperation[]`.** Every mutating model function
   returns these instead of touching the store. main.tsx applies them
   through its existing history:
   ```ts
   const result = acceptItem(aiPanelState, changeSetId, itemId)
   if (result.ok) {
     pushCanvasHistory() // once per accept, so one Cmd+Z undoes one accept
     for (const op of result.operations) applyAiCanvasOperation(op) // switch on op.type
     setAiPanelState(result.state)
   }
   ```
   `applyAiCanvasOperation` is a small switch main.tsx needs to write:
   `update-node-text` -> the matching `set{Kind}s` setter for `op.field`;
   `update-node-palette` -> `setPalettes`; `delete-node` -> the existing
   delete path (already saves a version checkpoint per research §A4.3 —
   reuse it, don't add a second one here); `remove-node` -> undo an applied
   AI creation; `clear-node-provenance` -> delete the
   `provenanceKey(kind, id)` entry from wherever main.tsx keeps the
   provenance map (or just trust the one already removed in the returned
   `state.provenance`, since `removeAppliedNode` already did that).
   `record-node-version` carries `nodeKind`/`nodeId`/`runId`/`aiGenerated`
   but **not** a `NodeVersionTrigger` — main.tsx's `NodeVersionTrigger` union
   (main.tsx:483) has no "AI change accepted" value today (closest existing
   value is `'user_edit'`); decide there whether to reuse `'user_edit'` or
   add a new trigger literal, since that union lives in the hot file this
   module cannot edit.

6. **Persistence.** Before calling `save_project_package` /
   `invoke('save_project_package', { snapshotJson })`, set
   `snapshot.aiPanel = toSnapshot(aiPanelState)` on the object that gets
   `JSON.stringify`'d. On load, call
   `fromSnapshot(loadedSnapshot.aiPanel)` — it never throws, even on a
   project saved before this field existed (see
   `apps/desktop/src-tauri/src/lib.rs` tests
   `ai_panel_field_round_trips_through_save_and_load` and
   `snapshot_without_ai_panel_field_still_loads`). Per research §A2, do
   **not** fold `aiPanel` into `snapshotForVersionArchive`/
   `ProjectVersionRecord.snapshotJson` (the 50-entry version history) —
   restoring a version must not rewind chat (DECISIONS.md #4).

7. **`threadsForNode`** backs the "Liên quan node đang chọn" filter chip in
   the mockup's thread list (`docs/design/right-panel/mockup.js`
   `threadList()`).

8. **`summaryLine`** backs the "Cần bạn" tab's `cs-summary` line
   ("N cần xử lý · N đã áp dụng · N đã nhận" in `changesView()`).

## Rust side (already wired, `apps/desktop/src-tauri/src/lib.rs`)

`ProjectSnapshot.ai_panel: serde_json::Value` (`#[serde(default, rename =
"aiPanel")]`) round-trips whatever `toSnapshot()` produces through
`canvas_collections` (`write_json_collection`/`read_json_collection`, same
pattern as `versionHistory`/`nodeVersions`). No migration needed — it's a
new key in the existing key/value table. A project saved before this field
existed loads fine (`ai_panel` defaults to `null`).

`ProjectSnapshot.slides_config: serde_json::Value` was added the same way —
see "Bug found" in the top-level task report; the TS `ProjectSnapshot` type
(main.tsx ~439-456) has an optional `slidesConfig` field this struct had no
matching field for, so the SQLite round trip (`read_project_package`'s
preferred path whenever `project.sqlite` exists, i.e. after any real save)
silently dropped it.
