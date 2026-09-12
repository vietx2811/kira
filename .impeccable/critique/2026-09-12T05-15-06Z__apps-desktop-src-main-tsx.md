---
target: apps/desktop
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 4
target_identity: "file:/Volumes/VXData/Users/VietX/App Code/vixio/apps/desktop/src/main.tsx"
target_fingerprint: "sha256:2ed83c945a5b7be391c47c5a108837c8d3c3a3efb33730ff4f4628529297e20d"
target_path: /Volumes/VXData/Users/VietX/App Code/vixio/apps/desktop/src/main.tsx
timestamp: 2026-09-12T05-15-06Z
slug: apps-desktop-src-main-tsx
---
# KIRA desktop UI — critique (apps/desktop, all flows)

## Design Specificity Verdict

**LLM assessment (Assessment A):** Mostly authored for KIRA, and specific in the places that matter most. The canvas node vocabulary, the "Ask Kira" per-node control with its own restrained glint animation and a full `prefers-reduced-motion` fallback, the AI-provider list-plus-detail workbench with a real routing matrix, and the deliberately non-wizard onboarding overlay all read as considered, product-specific decisions — not generic AI-app scaffolding. The onboarding overlay in particular is a genuine restraint win: one hero, one primary CTA, two optional secondary rows, no step counter — directly honoring PRODUCT.md's own anti-wizard principle rather than just stating it.

Where it slips into category-interchangeable: the Settings shell itself is boilerplate SaaS-settings structure, and that's exactly where the two clearest inconsistencies live — the Chrome capture install renders as a 4-step numbered wizard sitting directly above a single-row Safari install, and `--kira-warm/mid/cool` (plus a permanent `--kira-border` tint) break the One Accent Rule that DESIGN.md itself declares load-bearing.

**Deterministic scan (Assessment B):** The bundled detector ran successfully this time (fixed earlier this session via `impeccable update --force`) — `impeccable detect --json apps/desktop/src` exited 2 with 178 findings: 5 failures + 173 advisory. Manually verifying every failure against source, 1 of 5 is a false positive: `broken-image` at `main.tsx:12087` matched the literal string `<img>` inside a code comment describing the crop technique in prose, not an actual empty-src tag. The other 4 are genuine: two spring/bounce easing curves (`styles.css:119`, `styles.css:462`), one layout-property transition animating `width` instead of `transform` (`styles.css:2552`), and one undocumented handwriting font on the sticky-note node type (`styles.css:3456`). The 173 advisory findings are dominated by 108 font-size and 51 color literals outside DESIGN.md's tokens — most of the font-size volume is one repeated value (`0.72rem`/`0.74rem`, ~70+ occurrences), which reads as a missing type-ramp step rather than 70 independent mistakes.

**Browser evidence:** Live overlay injection on the running dev server (port 5173) surfaced runtime-only findings the static scan can't see: undersized functional text (9.5–10.9px, below an 11px floor) recurring dozens of times, a clipped-overflow-container on the library drawer, and low-contrast text (3.8:1, need 4.5:1) — all confirmed live across the canvas/library view, the AI Providers panel, and onboarding. Zero JS console errors at any point. This independently corroborates Assessment A's own contrast finding (`--text-muted` on `--surface-2` ≈ 3.7:1) found by completely different means (LLM token math vs. rendered-pixel measurement) — strong cross-corroboration that this is a real, systemic issue, not a one-off.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Good status chips/spinners; no undo affordance after destructive actions |
| 2 | Match System / Real World | 3 | Plain language throughout; OAuth restriction copy is unusually well-written |
| 3 | User Control and Freedom | 2 | No `confirm()` anywhere in the file — provider/node deletion is instant and irreversible |
| 4 | Consistency and Standards | 2 | i18n covers nav/library chrome only; Settings body copy, tab labels stay English by the code's own admission |
| 5 | Error Prevention | 2 | Same delete-with-no-confirm gap; provider/secret deletion isn't on the undo stack |
| 6 | Recognition Rather Than Recall | 3 | List-plus-detail pattern avoids hidden state; routing preview shows resolved state, not inferred |
| 7 | Flexibility and Efficiency | 3 | Keyboard handling on custom controls; no visible shortcut list for power users |
| 8 | Aesthetic and Minimalist Design | 3 | Calm, hairline-not-shadow chrome; dented by the Kira-border color leak and Chrome/Safari asymmetry |
| 9 | Error Recovery | 2 | Codex login errors are well-surfaced; "key missing"/"unavailable" give no next-step link |
| 10 | Help and Documentation | 2 | No in-app help/shortcuts reference; onboarding's "Open Welcome.kira" is the only guided path |
| **Total** | | **25/40** | **Acceptable — the floor isn't visual polish, it's reversibility around destructive actions and translation completeness.** |

## Overall Impression

Real product character exists in the surfaces that matter most (canvas, onboarding, AI-provider workbench), which is why the specificity verdict leans positive despite a 25/40 heuristic score — those two measures are answering different questions. The score is dragged down by precision-level gaps that don't show up in a screenshot: no confirmation before destructive actions, contrast and text-size violations invisible until measured, and an accessibility gap (unlabeled canvas nodes) that would fail a screen-reader user at the very first interaction. The single biggest opportunity is that these are all mechanical, scoped fixes — not design-direction problems — sitting inside an app whose macro-level composition is already considered and calm.

## What's Working

1. **The onboarding overlay is a genuine restraint win.** One hero card, one primary action, two optional links, no step counter, no progress bar — directly honoring the product's own stated anti-wizard principle rather than just declaring it in DESIGN.md.
2. **The AI Providers screen is a real list-plus-detail pattern, not a card grid.** Status paired with words (never color-only), one hairline-bordered registry, a single active detail article — the clearest evidence DESIGN.md's rules were actually applied during implementation, not just written down.
3. **Motion craft on the Kira control is unusually complete.** The glint animation's own code comment explains the intent ("a glint rather than a pulsing app icon"), and it's backed by a full `prefers-reduced-motion` block disabling every Kira/animation class — a level of accessibility-of-motion care that's easy to skip and wasn't here.

## Priority Issues

- **[P0] Canvas nodes carry no accessible name.** Every node card (idea/image/palette/diagram) renders as `<div role="button" tabIndex={0}>` with no `aria-label`/`aria-labelledby` (`main.tsx:10661`, `10822`, `10884`), confirmed live via the accessibility tree — while their nested corner controls (add/kira/link) do have proper labels. Why it matters: the canvas is the core surface of the entire product; a screen-reader user gets an unnamed "button" for every single idea on the board. Fix: add `aria-label` derived from `node.title`, mirroring the pattern already used correctly on `.node-add-control`. Command: `harden`.

- **[P1] Destructive actions have zero confirmation or undo.** `deleteAiProvider` (`main.tsx:3921`) and node/profile delete buttons fire immediately — no `confirm()` exists anywhere in the 18k-line file, and provider/secret deletion isn't on the canvas undo stack. Why it matters: a Keychain-stored API key and its whole profile vanish on one click next to Test/Models, with no recovery path — the app's highest-severity Error Prevention gap. Fix: require a press-again confirm or a 2-second undo toast before deleting a provider profile; surface "Undo" on node deletion since it's currently silent. Command: `harden`.

- **[P1] Text contrast fails WCAG AA in multiple, independently-confirmed spots.** Assessment A found `--text-muted` (#77766d) on `--surface-2` (#1b1e1c) at ≈3.7:1; Assessment B independently measured `#80817d` on `#242929` at 3.8:1 live in the browser — both need 4.5:1 for body-size text. Why it matters: two unrelated methods (static token math vs. rendered-pixel measurement) converged on the same defect class, which is a stronger signal than either alone. Fix: audit `--text-muted` usage on status/metadata rows and either darken the surface or lighten the text token. Command: `harden`.

- **[P1] Dozens of functional-text instances render under the 11px legibility floor.** Confirmed live across sidebar labels, tags, settings rows, and onboarding copy (9.5–10.9px). Why it matters: this isn't a one-off — it's a repeated pattern across multiple surfaces, meaning the type ramp's small end is systematically too small for functional (non-decorative) text. Fix: raise the floor on functional-text classes to 11px minimum; audit `0.68rem`/`0.66rem` usages against DESIGN.md's own micro-label spec. Command: `typeset`.

- **[P1] The language toggle exposes a majority-untranslated Settings shell.** Switching to Tiếng Việt translates the sidebar but leaves the Settings tab labels ("General/Capture/AI Providers/Advanced"), all General/Capture body copy, and the Chrome install instructions in English — confirmed live with a screenshot, and admitted directly in the code's own comment above `UI_STRINGS`. Why it matters: a half-translated surface reached specifically via an intentional "Language" setting reads as more broken than the app staying English-only would. Fix: either scope the toggle's visible claim to what's actually translated (nav + library), or finish Settings-shell coverage before exposing it generally. Command: `clarify`.

- **[P2] The Capture panel treats its two extension targets inconsistently.** Chrome gets a 4-step numbered `<ol>` wizard (`main.tsx:7040-7062`); Safari, one row below, gets a single "Enable in Safari" button (`main.tsx:7066-7080`). Why it matters: this is a literal reproduction of the exact pattern DESIGN.md tells the team to avoid ("don't build a multi-step wizard for a 2-item utility list") — inside the app that documents the rule. Fix: collapse the Chrome steps behind a `<details>` disclosure to match Safari's flat-row rhythm. Command: `distill`.

## Persona Red Flags

**Sam (Accessibility-Dependent):** Blocked at the most basic level — cannot navigate the canvas meaningfully via screen reader since every node announces as an unnamed "button" (P0 above). Compounded by the confirmed contrast failures and the dozens of sub-11px text instances Assessment B measured live — three independent accessibility defects stacking on the same core surface.

**Jordan (First-Timer):** The AI Providers tab is the second thing a first-timer sees (via onboarding's "Connect AI" link), and it opens to three "unavailable" + two "key missing" rows all at once, confirmed live via screenshot — a wall of unresolved status before the user has done anything, cutting against the "calm, quietly capable" personality the onboarding overlay just earned.

**Riley (Stress Tester):** Finds that "Delete profile" has no confirmation and immediately strips a Keychain secret (P1) — a single misclick destroys credential state with no recovery. Also finds the Chrome/Safari capture-row asymmetry as evidence the pattern wasn't stress-tested against the app's own written design rules.

## Minor Observations

- Two genuine motion/performance slips sit next to otherwise excellent motion craft: `--ease-spring` (`styles.css:119`) and the splash-symbol keyframe (`styles.css:462`) are real overshoot/bounce curves, and `.library-download-fill` (`styles.css:2552`) animates `width` instead of `transform` — worth a pass given how deliberate the Kira-glint's own motion restraint is by comparison.
- `.idea-node--sticker` uses "Bradley Hand" (`styles.css:3456`), undocumented in DESIGN.md's typography tokens — likely the intentional "handwriting-style font" DESIGN.md §2.4 already sanctions for note nodes, but it should be added to the type system doc rather than living as a silent exception.
- `aside.inbox.panel.library-drawer-panel` clips a positioned child (confirmed live) — a layout bug independent of the design-system findings above.
- The One Accent Rule leaks on the Kira control: `--kira-border` (permanent pink/lilac hairline, `styles.css:71`) survives into the `.is-selected` state (`styles.css:3774-3783`) because that rule overrides only `background`/`color`, not `border-color` — a second hue visible at rest, not just during the intentional hover-glint moment.
- The 173 advisory findings are mostly one repeated value: `0.72rem`/`0.74rem` accounts for the bulk of the 108 font-size flags, reading as a missing type-ramp step rather than 108 separate defects — worth adding to DESIGN.md's typography scale directly.
- Onboarding's emoji icons (🧠📎✨🌱) sit oddly against the otherwise disciplined Lucide icon-font system used everywhere else.
- `provider-task-matrix`'s "Canvas Generation" group has 5 checkboxes in one unlabeled grid — one over the ≤4-per-group cognitive-load guideline.

## Questions to Consider

- If the One Accent Rule is load-bearing enough to be written down, should the Kira control's signature moment express personality through motion/timing alone (which it already does beautifully) rather than also reaching for extra hues that then leak into the resting state?
- Is a binary "replay the whole first-run wizard" the right recovery model, or would per-section re-entry (just replay the capture explainer, just replay AI setup) respect the user's existing project state better?
- Given i18n coverage is admittedly partial by the code's own comment, would scoping the Language toggle to only fully-translated surfaces read as more "quietly capable" than exposing an obviously half-finished toggle now?
