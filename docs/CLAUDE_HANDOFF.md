# Claude Handoff: KIRA Desktop Shell / Settings / Theme Work

## Current State

- Repo path: `/Volumes/VX Data/Users/VietX/App Code/vixio`
- Product name in UI/conversation: `KIRA`
- Current git branch: `main`
- Worktree is dirty by design. Do not discard user/Codex changes.
- Modified files at handoff:
  - `apps/desktop/src/main.tsx`
  - `apps/desktop/src/styles.css`
- Latest verified command:
  - `pnpm --filter @kira/desktop build`
  - `git diff --check`

## Where To Get Context

Use these first, in this order:

1. Current worktree diff:
   - `git diff -- apps/desktop/src/main.tsx apps/desktop/src/styles.css`
   - `git diff --stat`
2. Product/architecture docs:
   - `docs/PROJECT_PLAN.md`
   - `docs/UI_DESIGN.md`
   - `docs/ARCHITECTURE.md`
3. Codex memory index:
   - `/Volumes/VXData/Users/VietX/.codex/memories/MEMORY.md`
   - Search terms: `KIRA`, `TopBar`, `EvidenceInbox`, `GraphCanvas`, `Inspector`, `Welcome.kira`, `onboardingStorageKey`, `Full Redesign`
4. Most relevant memory rollout:
   - `/Volumes/VXData/Users/VietX/.codex/memories/rollout_summaries/2026-06-09T10-43-42-ibqm-kira_onboarding_extension_welcome_ai_node_bundle.md`
   - Backing session path from memory: `/Volumes/VXData/Users/VietX/.codex/sessions/2026/06/09/rollout-2026-06-09T17-43-42-019eabfb-1fd1-7740-a6cb-355ccd78678e.jsonl`
5. Runtime preview screenshots generated during this pass:
   - `/Volumes/VXData/Users/VietX/App Code/vixio/kira-canvas-inspector-hidden-topbar-settings.png`
   - `/Volumes/VXData/Users/VietX/App Code/vixio/kira-settings-tabs-advanced.png`
   - `/Volumes/VXData/Users/VietX/App Code/vixio/kira-accent-first-theme.png`
   - `/Volumes/VXData/Users/VietX/App Code/vixio/kira-accent-first-editor.png`
   - `/Volumes/VXData/Users/VietX/App Code/vixio/kira-onboarding-minimal-redesign.png`

Important memory notes:

- Use `KIRA` / `kira` in user-facing wording. Only use `vixio` for exact package/path names.
- Shell work is not cosmetic only. Existing responsibilities are split across `TopBar`, `EvidenceInbox`, `GraphCanvas`, and `Inspector`; sidebar/drawer changes usually require component responsibility moves.
- Preserve canonical IA terms: `Library`, `Canvas`, `Inspector`, `Outline`.
- Onboarding should be first-run friendly, OpenAI/Anthropic first, and explicit that ChatGPT/Claude subscriptions are not API billing.
- Empty state direction is template-first, especially `Welcome.kira`, not blank-canvas-only.

## Recent User Feedback Addressed

The latest user feedback was:

- Settings UX was too confusing and dense.
- Settings area was not fully following design tokens.
- Move Settings button to topbar right.
- Remove Settings from sidebar.
- Remove Inspector hide button from Inspector header.
- Show/hide Inspector should live at the top-right of the canvas/content, not as a full right-side collapsed bar.
- Settings should be grouped into tabs to avoid overwhelming users.

Implemented response:

- `Settings` button moved to `TopBar` right actions.
- Sidebar no longer has the Settings button.
- Inspector show/hide is controlled by topbar only.
- Parent shell no longer renders `Inspector` when `isInspectorCollapsed` is true, so the collapsed right-side inspector bar is gone.
- Inspector header no longer includes its own collapse button.
- `SettingsView` now has tabs:
  - `Overview`: routing, selected remote provider, provider/local/status summaries.
  - `AI`: provider workbench and routing preview.
  - `Capture`: onboarding actions and browser extension install/status.
  - `Advanced`: local runtime, secrets, and usage disclosures.
- Settings CSS moved toward semantic tokens:
  - `--glass-content`
  - `--surface-drawer`
  - `--surface-inset`
  - `--border-soft`
  - `--glass-active`
  - `--accent-*`

## Earlier Current-Pass Changes Also In Worktree

These are still in the same dirty worktree and should be preserved unless the user asks otherwise:

- Onboarding redesign:
  - Minimal first-run overlay.
  - Orbit animation around the app icon.
  - Complex API key/local/browser helper content hidden behind disclosures.
- Accent-first color algorithm:
  - User selects accent first.
  - Canvas/UI surfaces are generated from accent + formula in OKLCH.
  - Background chroma/lightness are constrained so canvas, drawer, inspector, node surface, and UI background stay in the same family.
  - Formulas currently exposed:
    - `Material`: tonal harmony
    - `Fluent`: calm analogous
    - `Apple Glass`: low-chroma glass
    - `Carbon`: cool complement
- Native window transparency:
  - Tauri background effect alpha was reduced to make glass/transparency more visible.

## Key Code Locations

`apps/desktop/src/main.tsx`

- `projectAccentPresets`: around the color preset definitions.
- `projectColorFormulas`: formula labels/descriptions.
- `defaultProjectAppearance`: now derives canvas from accent.
- `updateProjectAppearance`: accent-first update path.
- App shell render: where `SystemSidebar`, `TopBar`, `EvidenceInbox`, `GraphCanvas`, and `Inspector` are composed.
- `OnboardingOverlay`: minimal onboarding UI.
- `SystemSidebar`: source buttons + file actions, no Settings button.
- `TopBar`: view tabs, Settings button, Inspector toggle.
- `SettingsView`: tabbed settings layout.
- `Inspector`: project metadata and color scheme editor.
- `projectColorTokens`, `deriveCanvasFromAccent`, `deriveAccentTokenFromAccent`, `accentThemeRecipe`, `accentThemeFormulaRecipe`: accent-first color system.
- `normalizeProjectAppearance`: loads old snapshots into the new accent-first generation path.

`apps/desktop/src/styles.css`

- Topbar and chrome:
  - `.topbar`
  - `.content-toolbar-actions`
  - `.top-settings-button`
  - `.top-inspector-button`
- Settings:
  - `.settings-shell`
  - `.settings-tabs`
  - `.settings-control-strip`
  - `.settings-overview-grid`
  - `.settings-onboarding-grid`
  - `.provider-workbench-grid`
  - `.settings-compact-disclosures`
- Onboarding:
  - `.onboarding-*`
- Color editor:
  - `.project-color-editor`
  - `.color-formula-grid`
  - `.accent-color-recommendations`
  - `.generated-color-row`

## Verification Already Done

Build:

```sh
pnpm --filter @kira/desktop build
git diff --check
```

Browser QA done with Playwright:

- Sidebar no longer contains `.sidebar-settings`.
- Topbar contains `.top-settings-button`.
- Clicking `.top-inspector-button` sets workspace class to `is-inspector-collapsed`.
- After hiding inspector:
  - `.inspector--collapsed` is not rendered.
  - `.inspector.panel:not(.inspector--collapsed)` is not rendered.
- Opening Settings:
  - `.workspace.is-settings-workspace` exists.
  - `.top-inspector-button` is hidden.
  - `.settings-tabs` renders `Overview`, `AI`, `Capture`, `Advanced`.
- Tab behavior:
  - `AI` renders `.provider-workbench-grid` and `.settings-route-preview`.
  - `Capture` renders `.settings-extension-grid`.
  - `Advanced` renders `.settings-compact-disclosures`.

## Suggested Next Steps

1. Start by reading the current diff, not by assuming the committed tree reflects the latest UX.
2. Preview the app:

```sh
pnpm --filter @kira/desktop dev --host 127.0.0.1
```

3. Re-check the Settings tabs visually, especially `Overview` and `Advanced`.
4. If continuing the color work, inspect computed CSS variables from `.app-shell`; avoid introducing raw RGB/hex outside token generation.
5. If changing shell chrome, keep Settings in topbar and keep source buttons (`Images`, `Ideas`, `Links`) visually separated from file/global actions in the sidebar.
6. Run:

```sh
pnpm --filter @kira/desktop build
git diff --check
```

7. Do not commit unless the user explicitly asks.

