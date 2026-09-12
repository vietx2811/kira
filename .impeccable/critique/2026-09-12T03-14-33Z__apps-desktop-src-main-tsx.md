---
target: apps/desktop (KIRA desktop app UI, all flows)
total_score: 30
p0_count: 0
p1_count: 1
timestamp: 2026-09-12T03-14-33Z
slug: apps-desktop-src-main-tsx
---
# KIRA desktop UI — critique (all flows, re-run)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Codex login now has a real spinner (`styles.css:8324`, `main.tsx:7215`) — prior P1 gap closed. Long AI generations still surface only via `setLibraryStatus` text, no progress bar. |
| 2 | Match System / Real World | 3 | Proper `t()` i18n system exists (`main.tsx:694-788`) with a labeled Settings toggle (`main.tsx:6982-6994`) — no more stray Vietnamese literals. Coverage is thin (~90 calls, concentrated in `library`/`kira`/`tool` namespaces); the toggle promises more translation than it delivers. |
| 3 | User Control and Freedom | 3 | Per-tab undo (`createCanvasHistoryStore()` factory, `main.tsx:677`), dirty-tab close confirmation, non-destructive crop with Reset. |
| 4 | Consistency and Standards | 2 | Codex login now uses `.primary-button`/`.quiet-button` (fixed). But `.codex-login__status-dot` and `.cli-status[data-status="connected"]` hardcode `var(--success, #8fcf9f)` (`styles.css:8285-8286`, `8362-8363`) — a second "active/good" color never defined as a real token, breaking DESIGN.md's One Accent Rule. |
| 5 | Error Prevention | 3 | Dirty-close confirm, crop Reset always available, API key field gating. No change. |
| 6 | Recognition Rather Than Recall | 3 | Advanced tab now uses labeled `<details>` disclosures with icon+text chips (`main.tsx:7413-7454`) instead of empty cards. Left rail still icon-only. |
| 7 | Flexibility and Efficiency | 3 | Multi-tab, per-tab undo, drag-node-between-tabs, semantic zoom, frame grouping — real power-user surface. |
| 8 | Aesthetic and Minimalist Design | 4 | Still the standout. Onboarding is now dark (`styles.css:1260-1282`, `background: var(--bg-canvas)`) — confirmed live via browser screenshot (dark near-black theme, teal-cyan buttons, zero console errors). Prior P2 light/dark mismatch resolved. |
| 9 | Error Recovery | 3 | `.codex-login__error` and inline hints present. No regression. |
| 10 | Help and Documentation | 3 | Advanced tab copy now teaches ("Replay first-run setup for AI providers…") instead of sitting empty. |
| **Total** | | **30/40** | **Good, improving — up from 28/40 on 2026-06-29. Consistency (One Accent Rule) is now the ceiling.** |

## Anti-Patterns Verdict

**LLM assessment (Assessment A):** Would not stop a Linear/Figma/Raycast-fluent user cold — the warm-near-black palette, hairline provider list, restrained type still reads as a considered, non-templated tool. Two seams a category-fluent user *would* clock on closer use: a second "success" green sitting next to the app's one deliberate teal-cyan accent (Codex/CLI status dots), and a bilingual toggle that only translates a thin slice of the UI — the exact mixed-language smell the last audit flagged, now structural (reachable via an intentional setting) rather than accidental.

**Deterministic scan (Assessment B):** The bundled `detect.mjs` detector is **broken in this environment** — `Error: bundled detector not found`; its implementation file (`detect-antipatterns.mjs`) does not exist anywhere under `.claude/` (confirmed via recursive `find`). This is a missing/incomplete install of the impeccable skill itself, not a usage error, and should be fixed independently of this critique. Assessment B substituted manual `grep` evidence and confirms, with counts:
- Hardcoded `#fff`/white-as-color: **0**. Hardcoded `#000`/black-as-color: **2**, both defensible (`styles.css:453` splash-screen fill; `styles.css:2887/2894` are mask-image opacity stops, not paint color — false positive on the ban).
- Gradient text (`background-clip: text` + gradient): **0**.
- `backdrop-filter` property: **0** — the 34 uses flagged in the 2026-06-29 audit are gone, replaced by native macOS window vibrancy via Tauri `setEffects()` (`main.tsx:2189`). This directly corroborates Assessment A's independent finding of the same mechanism — a strong agreement between the two assessments.
- Side-stripe colored borders (`border-left`/`border-right` >1px): **0**. Clean.
- Inline `style={{}}` with raw hex/rgb bypassing CSS variables: **0**. Clean.
- Mixed-language JSX (Vietnamese literals beside English in the same block): **0** — all Vietnamese text is either the deliberate `en`/`vi` i18n dictionary or the language-picker's native-name labels. This also corroborates Assessment A's finding of a real `t()` system, and both assessments independently surfaced the same nuance: a code comment above the dictionary (`main.tsx:697-704`) admits coverage is only "the highest-visibility chrome," so switching to Vietnamese produces a reachable mixed-language *state* even though no single block mixes literals today.
- Em dashes in real user-facing copy: **9 confirmed** (`main.tsx:2894, 2896, 4573, 6722, 9032, 9664, 12205, 13319, 13437`), plus 5 more inside LLM prompt templates (not user-visible). Assessment A independently cited several of the exact same lines (`9032`, `12205`, `13319/13437`) without seeing Assessment B's grep — strong cross-corroboration that this is real and has grown since the 2026-06-29 count of 7.

**Browser evidence:** A live Vite dev-server render (`kira-desktop`, port 5173) came up clean on the first attempt — full onboarding overlay rendered, dark theme, teal-cyan buttons, **zero console errors**. The Tauri `invoke()` crash-on-plain-browser failure mode documented in the prior audit did not reproduce this run. Server was started, screenshotted, and cleanly stopped.

## Overall Impression

Real, measurable improvement since 2026-06-29 (28 → 30): both P1s from the last critique (mixed-language labels, unstyled Codex login) are genuinely fixed, not papered over — the fixes reuse the existing component vocabulary rather than bolting on new patterns. The new ceiling on the score is **consistency drift in the newest surfaces**: the Codex/CLI status dots and the Kira-node AI-entry-point control both introduce colors outside the documented system, meaning the parts of the app that were touched most recently are exactly where the One Accent Rule is now being violated. The biggest opportunity is a five-minute fix (swap two hardcoded greens for the accent token) sitting next to a genuine open product question (is the AI-node's warm/pink/indigo sweep a sanctioned exception that DESIGN.md should document, or drift to pull back in).

## What's Working

1. **Multi-tab architecture is real engineering, not a checkbox.** `createCanvasHistoryStore()` (`main.tsx:677`) genuinely isolates undo per file; the node-transfer-between-tabs flow was redesigned mid-implementation (pointerup-based instead of spring-loaded hover) specifically to avoid breaking `PointerCapture` mid-gesture — the kind of correction that only shows up when someone tested on a real preview, not just read the plan.
2. **Non-destructive crop is architected correctly.** Fractional `cropRect` coordinates, CSS-transform rendering shared across canvas/library/slides, pixel bake deferred to export only. No half-destructive trap.
3. **The Advanced settings tab redesign directly answers the prior audit's own question.** Instead of debating whether the tab should exist, it made the sparse content self-explanatory with `<details>` disclosures and one-line "what this is" copy — a better answer than removal.

## Priority Issues

- **[P1] A second "success" green violates the One Accent Rule.** `styles.css:8285-8286` and `8362-8363` hardcode `var(--success, #8fcf9f)` for the Codex signed-in dot and the `cli-status[data-status="connected"]` dot. `--success` is never defined anywhere as a real CSS variable, so this resolves to a bare `#8fcf9f` green — a second color meaning "connected/good" next to `--accent-cyan` (`#84cdbc`). **Why it matters:** DESIGN.md §3 is explicit — teal-cyan is "the only color allowed to mean active or good" — and this is in the newest code (Codex/CLI panels), meaning the newest surfaces are drifting instead of converging toward the system. **Fix:** replace both `var(--success, #8fcf9f)` with `var(--accent-cyan)`. **Command:** `polish`.

- **[P2] The language toggle is a thin veneer over ~90 translated strings in an 18k-line file.** Both assessments independently found the same root cause: `t()` coverage is concentrated in `library`/`kira`/`tool` namespaces; Settings, Inspector, canvas chrome, and most dialogs stay hardcoded English regardless of the toggle. **Why it matters:** a user who deliberately switches to "Tiếng Việt" (`main.tsx:6982`) gets a majority-English app with scattered Vietnamese — the same complaint as the 2026-06-29 audit, but now reachable via an intentional setting, which reads as more broken (the app promised full translation) than the old accidental leakage did. **Fix:** either scope the toggle's label to what's actually translated, or extend `t()` coverage before presenting it as a general setting. **Command:** `clarify`.

- **[P2] The Kira AI-node control has its own three-color sweep (`--kira-warm`/`--kira-mid`/`--kira-cool`, `styles.css:64-71`) outside both the accent and status vocabularies.** **Why it matters:** DESIGN.md doesn't carve out an "AI feature branding" exception, so on selection this reads as an unaccountable second brand color — possibly an intentional "this is where AI lives" signature (a legitimate pattern in other tools), but currently undocumented. **Fix:** either formalize it in DESIGN.md as the one sanctioned AI-feature exception, or fold it back into the accent/amber vocabulary. **Command:** `shape` (design decision needed before a code fix).

- **[P3] Em dashes have grown, not shrunk, since the last audit.** 9 confirmed instances in real user-facing copy (status messages, hints, aria-labels) at `main.tsx:2894, 2896, 4573, 6722, 9032, 9664, 12205, 13319, 13437`, up from 7 previously. **Why it matters:** minor per-instance, but the trend line is wrong for a codebase that's supposed to be converging. **Fix:** sweep the listed lines, em dash → comma/period. **Command:** `clarify`.

- **[P3] `layoutDensityScale()` still drives positioning math for 6 of 7 organize modes** (`flow`/`cluster`/`timeline`/`palette`/`importance`; only `grid` bypasses it via `applyShelfPackedLayout`). This matches RESEARCH_MOODBOARD_UX.md's own scoping (semantic zoom replaced density-based *rendering* shrink, not *layout positioning* math) — not a bug, but worth flagging so a future contributor doesn't mistake the surviving function for unfinished cleanup. **Command:** none needed; documentation note only.

## Tooling Note (not a design finding)

Assessment B could not run the bundled anti-pattern detector: `detect.mjs` errors with `Error: bundled detector not found` because `detect-antipatterns.mjs` is missing from the impeccable skill's install (checked both candidate paths, plus a recursive search under `.claude/` — zero hits). Every finding above came from manual grep instead. Worth fixing the skill install separately so future `critique`/`audit` runs get the deterministic pass, not just the LLM read.

## Persona Red Flags

**Jordan (First-Timer):** Left rail is still icon-only (unchanged). The Advanced tab is now easier to trust, but a first-timer who switches the language toggle to Vietnamese mid-onboarding lands in a *worse* state than before — a UI that now visibly promises translation but mostly isn't, reading as more broken than consistent English would.

**Alex (Power User):** Multi-tab, per-tab undo, and drag-node-between-tabs are exactly the accelerator layer this persona wants. But Codex "Waiting for browser…" still blocks on the OAuth round-trip with only a mouse-driven Cancel (`main.tsx:7221`) — no keyboard-first path to the device-code alternative without clicking into a `<details>` disclosure.

**ViệtX (Art Director, Vietnamese, F&B/branding — project persona):** The specific complaint from the last audit (`Tên`/`Des`/`Tác giả` mid-panel) is resolved. But the new i18n toggle sets an expectation of a fully-Vietnamese app that isn't there yet — for a design-literate Vietnamese user, discovering that "Tiếng Việt" only covers a fraction of the UI may read as more disappointing than the app simply staying English-only would have.

## Minor Observations

- `.provider-list-row` (`styles.css:5781`) and `.file-tab` (`styles.css:351`) are visually distinct families for conceptually similar "pick one of several items" rows — different contexts, not a violation, but worth a coherence pass if more list surfaces are added.
- The Advanced tab's `<details>` idiom isn't reused elsewhere yet (e.g. some Inspector panels could benefit) — an opportunity, not a defect.
- 3D remains a top-level `ActiveView` and the arc-menu/context-menu merge proposed in RESEARCH_MOODBOARD_UX.md §3/§4 (Đợt 4) is still not done — both match the research doc's own "chưa làm" labeling, so this is expected backlog, not drift.

## Questions to Consider

- Now that real i18n infrastructure exists, is the plan to fully translate the app, or was the toggle shipped ahead of coverage — and if the latter, should it be hidden until coverage is closer to complete?
- Is the Kira-control's three-color glint a deliberate "this is where AI lives" signature worth codifying in DESIGN.md, or accidental drift that should be pulled back into the One Accent Rule?
- Given 3D-view and the arc/context-menu merge are both explicitly "not done" in the project's own roadmap/research docs, is there a target date, or has "discovery-only 3D" quietly become permanent scope rather than deferred scope?
