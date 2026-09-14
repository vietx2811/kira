---
target: right panel mockup round 2
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
target_identity: "file:/Volumes/VXData/Users/VietX/App Code/vixio/.claude/worktrees/panel-critique-2/docs/design/right-panel/index.html"
target_fingerprint: "sha256:92caec7771c06e91fde4b5e641f28bf486655981c0cf4c564cca051b3512f13c"
target_path: /Volumes/VXData/Users/VietX/App Code/vixio/.claude/worktrees/panel-critique-2/docs/design/right-panel/index.html
timestamp: 2026-09-14T09-21-22Z
slug: index-html
---
Method: dual-agent (A: design review sub-agent · B: detector and browser overlay sub-agent). Aesthetic lens: design-taste-frontend skill, dials 3/3/6, DESIGN.md takes priority.

Target: docs/design/right-panel (KIRA right panel mockup, Operate mode), round 2 on the revised version. Base 9f3d898. Round 1 scored 25/40.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | A skill paused at a checkpoint had no dock state and is not in the count |
| 2 | Match System / Real World | 3 | Dev words leak: Chi tiết run, Dừng skill, Sửa query, Curate ảnh |
| 3 | User Control and Freedom | 3 | Good exits; no frame shows the result after Nhận |
| 4 | Consistency and Standards | 3 | "Bỏ" means both reject a proposal and remove an applied node |
| 5 | Error Prevention | 3 | Removing an AI node the user has since edited has no guard |
| 6 | Recognition Rather Than Recall | 3 | Shortcut only in a tooltip |
| 7 | Flexibility and Efficiency | 2 | No keys for accept, reject, next item; no thread search |
| 8 | Aesthetic and Minimalist Design | 3 | Every change item renders expanded |
| 9 | Error Recovery | 3 | Missing: target node deleted while its edit waits, CLI signed out |
| 10 | Help and Documentation | 2 | No first-open or empty state for the panel |
| **Total** | | **28/40** | **Good** |

## Design Specificity Verdict

LLM: Changes, stale strips, provenance chip, review marker, licence captions and drag-to-node are specific to KIRA; the Chat tab is generic assistant UI, acceptable as the least novel part.

Deterministic scan: CLI exit 0, 4 advisory design-system-color on the doc wrapper. Browser overlay on 8 frame loads plus extra frames: tiny-text on single-line 11px text (project floor), text-occlusion and clipped-overflow on canvas nodes under the floating panel (by design), gpt-thin-border-wide-shadow on the selected node (app pattern), flat-type-hierarchy from the locked 11/13/15 scale. Real issue found beyond the detector: 3-line diff at 11px. Detector contrast pass did not cover panel text; a computed-colour check found no panel failures.

design-taste-frontend lens: no emoji, no dashes, no auto animation (motion 3). Mockup had drifted from the app after merged colour fixes: amber token still the old cool blue, danger-button hover still a tint bump.

## Priority Issues

- [P1] A skill paused at a checkpoint is invisible when the panel is closed. Fix: dock state "Skill chờ bạn" that persists, opens Changes at the checkpoint.
- [P2] All change items render expanded; the delete item falls below the fold. Fix: one-row items, expand the focused one.
- [P2] "Bỏ" covers reject and remove; removing an edited AI node has no guard. Fix: distinct verbs, confirm when the created node was edited.
- [P2] Count wording and scenario numbers disagree (dock "chờ duyệt" vs "cần xử lý"; run detail vs changeset). Fix: one wording, consistent sample data.
- [P2] Curate preselection inconsistent; commit does not say what it skips. Fix: one default rule, reasons on unselected, scope in the button label.

## Persona Red Flags

- Alex: no keyboard review path; drag makes one merged node instead of one per branch.
- Riley: edited AI node removable without warning; no state for a deleted target or signed-out CLI.
- Sam: thread switcher aria-label replaces its visible name; provenance chip 20px target; dock label promises a composer the Changes tab lacks.

## Questions for the user

- Should a waiting skill count in the toggle, or live under a renamed tab? (touches layout decision 5)
- In the Changes tab the panel has no composer, but the dock button promises one (layout decision 4 edge case).
- Open Changes directly when opened from the dock status line, but not from the tab-bar toggle?
- At 1440 with the Library open, should opening Kira from a review action collapse the Library too? (layout decision 3 edge case)
- Should dragging an answer make one node per list item?

## Fixed in the committed version

The P1 (new persistent dock state), mockup token drift (amber, danger hover border), diff text at 13px. Contrast re-measured on 22 frames: 0 below 4.5:1, lowest 4.8:1.
