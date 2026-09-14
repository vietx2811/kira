---
target: right panel mockup
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/Volumes/VXData/Users/VietX/App Code/vixio/.claude/worktrees/right-panel-mockup/docs/design/right-panel/index.html"
target_fingerprint: "sha256:c3fce2275631f20abbad132111f3f1d5d511fe6299d9317fd4544869783d1cad"
target_path: /Volumes/VXData/Users/VietX/App Code/vixio/.claude/worktrees/right-panel-mockup/docs/design/right-panel/index.html
timestamp: 2026-09-14T01-51-29Z
slug: index-html
---
Method: dual-agent (A: design review sub-agent · B: detector and browser overlay sub-agent)

Target: docs/design/right-panel (KIRA right panel mockup, Operate mode), first version before fixes. Base cf1a496.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Run lines, steps, dock states, 0 results are clear; counts disagree (toggle 3, bulk "Nhận 2 mục"); running state has no stop |
| 2 | Match System / Real World | 2 | Jargon mix: thread, Chi tiết run, Skill, Curate, provider; "Chạm node" is a calque |
| 3 | User Control and Freedom | 3 | Per item accept/reject, stale lock, skip step; bulk accept silently includes a delete |
| 4 | Consistency and Standards | 2 | Five verbs for reject; primary is solid teal instead of DESIGN.md tint; skill lives in the Changes tab |
| 5 | Error Prevention | 3 | Stale lock, unknown licence unselected, version before delete; bulk sweeps the delete |
| 6 | Recognition Rather Than Recall | 2 | Icon-only answer tools (pen reads as edit), bare "+", author on hover only, no way to reveal a change on canvas |
| 7 | Flexibility and Efficiency | 2 | Shortcut only in a title; no accept/reject keys; no per-type bulk |
| 8 | Aesthetic and Minimalist Design | 3 | Calm hairlines; Changes shows about 12 actions and 10 teal elements |
| 9 | Error Recovery | 3 | Zero results names source and query; run error offers retry only |
| 10 | Help and Documentation | 2 | No first-open explanation of thread, run, skill |
| **Total** | | **25/40** | **Acceptable** |

## Design Specificity Verdict

LLM assessment: Changes, checkpoints, provenance badges and dock status are authored for KIRA (swatch diff markers, licence captions, honest zero results, stale lock). The Chat tab is the generic AI sidebar.

Deterministic scan: CLI exit 0, 4 advisory design-system-color findings, all on the documentation wrapper (light token values absent from DESIGN.md frontmatter, doc background). Browser overlay on 8 frame loads: tiny-text (11px, follows the project type scale; multi-line prose flagged fairly), flat-type-hierarchy (locked 11/13/15 scale), gpt-thin-border-wide-shadow on selected node (mirrors app node shadow tokens). text-occlusion, low-contrast and clipped-overflow findings are canvas nodes under the floating panel or drag ghost, by design. dark-glow on body is the detector's own overlay.

## Priority Issues

- [P1] Panel hides the nodes under review; change items cannot reveal them. Fix: "Xem trên canvas" per item, highlight the review target, draw narrow frame panned.
- [P1] Bulk accept "Nhận 2 mục" includes a node delete. Fix: bulk excludes deletes and stale items; deletes under "Cần duyệt riêng".
- [P1] Status colours collapse into one teal (preset amber is a cool blue). Fix: only done uses accent, neutral links, DESIGN.md tinted primary, attention via icon and weight.
- [P2] Counts and Changes structure do not reconcile; running skill replaces the list. Fix: one count definition, list every changeset, skill as a top card with a way back.
- [P2] Chat relies on icons, hover and calqued terms. Fix: text "Tạo node", "Thread mới", filter "Liên quan node đang chọn", author visible.

## Persona Red Flags

- Alex (power user): no keys for next/accept/reject; shortcut hidden in title; no per-type bulk.
- Sam (accessibility): filter clear nested inside chip button; span checkboxes without tabindex; hover tooltip with a link covering its badge; author hover-only.
- Riley (stress tester): counts disagree; collapsed image groups with unknown selection; stale shown only for palette.

## Minor Observations

- Thread row pending note wraps; empty-state sample inside live list.
- Composer send looks active while empty.
- Three border levels around diff; legend repeated per item.
- Dock crop missing gradient defs rendered empty orbs.

## Questions to Consider

- Should the panel open on Thay đổi whenever the count is above 0?
- Should pending text or palette changes render as a ghost on the node itself, with the panel as index only?
- Do art directors need threads at all, or per-node history?

## Fixed in the committed version

All three P1 and both P2 issues above, the minor observations, and multi-line prose raised from 11px to 13px. Contrast re-measured on all 22 frames: 0 text below 4.5:1, lowest 4.8:1.
