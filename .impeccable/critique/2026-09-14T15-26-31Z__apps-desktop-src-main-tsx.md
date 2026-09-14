---
target: KIRA desktop shell, 8 surfaces (art direction audit)
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 4
target_identity: "file:/Volumes/VXData/Users/VietX/App Code/vixio/.claude/worktrees/agent-aafe3478d99f3712e/apps/desktop/src/main.tsx"
target_fingerprint: "sha256:c453793ffc4a75b0d04a06eac164c2356f76aa02e08acb636a4d4e1e751a70ba"
target_path: /Volumes/VXData/Users/VietX/App Code/vixio/.claude/worktrees/agent-aafe3478d99f3712e/apps/desktop/src/main.tsx
timestamp: 2026-09-14T15-26-31Z
slug: apps-desktop-src-main-tsx
---
⚠️ DEGRADED: single-context (critique ran inside a delegated Art Director agent thread; spawning two further sub-agents was not requested by the user). Assessment A was recorded before detector output was read. Aesthetic lens: design-taste-frontend, dials 3/3/6, DESIGN.md takes priority.

Target: KIRA desktop app, whole shell (canvas, library, node details, Kira dock, settings AI Providers, slides, outline, onboarding), Operate mode. Commit 83455db, browser runtime (vite dev server, headless Chrome 1440x900), no Tauri runtime. Full report with screenshots: docs/research/2026-09-14-art-direction.md.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Good: Ready, key missing, 9/9, unsaved dot, dock says model not connected |
| 2 | Match System / Real World | 3 | Leaks: "Downstream branch", "~177 tokens", "1 refs" |
| 3 | User Control and Freedom | 3 | Esc and close everywhere checked; undo exists |
| 4 | Consistency and Standards | 2 | Hover inverts to solid accent on quiet/icon buttons but tints on primary; 5 button weights; UA grey buttons in node details action bar |
| 5 | Error Prevention | 2 | Delete profile sits in the Save key row at equal height |
| 6 | Recognition Rather Than Recall | 2 | Icon-only rail and tool rail, shortcuts only in tooltips |
| 7 | Flexibility and Efficiency | 3 | Shortcuts, arrange, dev-grade power features |
| 8 | Aesthetic and Minimalist Design | 2 | Translucent reading surfaces without blur ghost canvas content; 4 floating clusters on the bottom edge |
| 9 | Error Recovery | 2 | Few recovery paths beyond the dock's settings link |
| 10 | Help and Documentation | 2 | Onboarding and tooltips only |
| **Total** | | **24/40** | **Acceptable** |

## Design Specificity Verdict

LLM: the canvas is authored (image nodes with palette strips, typed relations, calm dotted ground, onboarding hero). The chrome is category-interchangeable dark SaaS: teal-tinted pills, grey chips, native selects, and three different hover dialects.

Deterministic scan: CLI `impeccable detect --json apps/desktop/src` returned 75 findings: 3 warnings (bounce-easing styles.css:136 `--ease-spring`, undeclared font Bradley Hand styles.css:3307, broken-image main.tsx:12367 which is a false positive on a code comment) and 72 advisories (46 color, 14 radius, 12 font-size outside DESIGN.md). Browser scan on 5 states: 11px body text (sanctioned by the type scale, false positive), the spring curve, `transition: width` on the dock, one border plus 36px shadow, one text-under-overlay hit under the open dock. The detector caught the spring curve which the review missed; it did not catch the see-through panels, the focus ring contrast, the toolbar collisions or the UA-grey buttons.

## Priority Issues

- [P1] Reading surfaces are translucent without a material: library drawer `--glass-drawer` alpha 0.74 dark / 0.78 light, node details popover alpha 0.94, 0 backdrop-filter. Canvas nodes read through the library list. Fix: opaque reading surfaces; glass only on floating controls. Command: layout, polish.
- [P1] Focus ring (3px accent at 38% alpha) measures 2.37:1 dark and 1.76:1 light against surface-1. Fix: 2px solid accent outline, offset 2px (measured 10.05 dark, 5.48 light). Command: audit, harden.
- [P1] Control dialects: `.icon-button:hover, .quiet-button:hover` invert to solid `--accent-strong` with `--bg-base` text; button font weights 400/500/550/620/700; 17 distinct button heights across 6 states; `.node-details-actionbar button` has no background reset (UA ButtonFace rgb(107 107 107) in Chrome). Fix: one control system with 7 states. Command: polish, extract.
- [P1] At 1440x900 the Outline toolbar overlaps the view switcher (12x15px) and the project settings button (22x21px); the Slides toolbar sits under the same button. Command: layout.
- [P2] Settings hierarchy inverted: h3 "More providers" 15px/680 outranks the selected provider name 11px/700; one action row mixes 13/500, 13/400 and 11/400; checkbox chips read as buttons. Command: typeset, layout.

## Persona Red Flags

Alex (power user): shortcuts appear only in tooltips; the bottom edge holds 4 separate floating clusters to scan.
Sam (keyboard, low vision): focus ring under 3:1 in both modes; icon-only rail.
Project persona, art director judging color: reference images sit on teal-tinted surfaces (dark #080e0e, light #d7dede); a tinted surround shifts perceived image color, and the see-through drawer overlays other references on the one being judged.

## Minor Observations

- Light mode surfaces sit in a narrow band (#dfe5e5 canvas, #d7dede surface-1, #cad3d5 surface-2); the Kira orb nearly disappears.
- Dock open shows two nested accent outlines (container plus focused input).
- 29 visible elements plus 23 SVG paths carry the accent with one node selected.
- Two icon libraries meet on the bottom edge: phosphor tool rail, lucide zoom controls.
- DESIGN.md front matter no longer matches rendered tokens (bg-base #0d0e0d vs #020303; accent-strong #9edccd vs #7fc8b7).

## Questions to Consider

- What if every floating control shared one material and every reading surface were opaque?
- Does the view switcher need accent at all when the view itself changes?
- What would the settings panel look like with one type size per role?
