---
target: desktop app UI (all flows)
total_score: 28
p0_count: 0
p1_count: 2
timestamp: 2026-06-29T18-15-27Z
slug: apps-desktop-src-main-tsx
---
# KIRA desktop UI — critique (all flows)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Codex "Waiting for browser…" is text-only (no spinner); long synchronous Codex generation has no progress |
| 2 | Match System / Real World | 2 | Mixed Vietnamese/English labels; "Des" abbreviation; empty "Tác giả" |
| 3 | User Control and Freedom | 3 | Cancel login, sign out, Edit/Discover toggle present; node canvas gives freedom |
| 4 | Consistency and Standards | 2 | Codex login controls break the provider-card vocabulary; mixed-language labels; onboarding light vs app dark |
| 5 | Error Prevention | 3 | API-key field disabled when empty; login method validated |
| 6 | Recognition Rather Than Recall | 3 | Icon-only left rail; inspector provides context |
| 7 | Flexibility and Efficiency | 3 | Canvas + 4 views + zoom + ⌘K; strong for power users |
| 8 | Aesthetic and Minimalist Design | 4 | Warm-dark glass, restrained color, distinctive node canvas, zero pure-black/white |
| 9 | Error Recovery | 3 | Logged-out Codex routes to Settings; but generation errors bury in node body |
| 10 | Help and Documentation | 2 | Style-notes teach, but Advanced tab empty, icon-only nav, no visible help |
| **Total** | | **28/40** | **Good — strong craft, held back by consistency & i18n** |

## Anti-Patterns Verdict

**Does this look AI-generated? No.** It passes the product slop test: a user fluent in Linear / Raycast / Figma would sit down and trust it. The warm-dark glass palette (cream #f1eee7 text on #0d0e0d, cyan/sage/amber/violet accents), the dotted-edge node canvas, and the generous inspector hierarchy are a committed, distinctive system — not template SaaS.

**Deterministic scan:** bundled detector unavailable (not installed). Manual ban-scan substituted: zero gradient-text, zero side-stripe accent borders, zero hardcoded `#fff`/`#000` (every neutral tinted) — clean on the absolute bans. Flags: 34 `backdrop-filter` uses (glass is core here, but verify each is purposeful, not reflexive), 7 em-dashes in copy (impeccable bans em dashes), mixed-language inspector labels in code (`Tên`/`Des`/`Tác giả` at main.tsx:8581-8595 beside English `KIND`/`STYLE NOTE`/`INSPECTOR`).

**Visual overlays:** not applicable — Tauri app; a plain-browser Vite render breaks `invoke` and misrenders flows, so real Tauri-rendered screenshots were used as evidence instead.

## Overall Impression

This is a genuinely well-crafted product UI — the aesthetic is the standout (a 4 on minimalist design is rare). The biggest opportunity isn't beauty, it's **finish**: a half-translated label set and a newly-added Codex login block that hasn't been dressed in the app's own component vocabulary are the two things that make an otherwise premium tool read as in-progress.

## What's Working

1. **Committed warm-dark glass system.** Tinted neutrals throughout (zero `#000`/`#fff`), a coherent token scale (`--space-*`, `--radius-*`, glass/accent families), and restrained accent use. The node canvas with dotted edges + junction dots is a distinctive, ownable affordance.
2. **Inspector hierarchy & information density.** Uppercase eyebrow labels, clear name/description/kind/style-note/color-scheme stack, evidence counts on nodes. Dense without feeling cramped — Linear-tier.
3. **Multi-view model (Canvas / 3D / Slides / Outline)** with a clean pill tab bar and a floating tool dock. Power-user flexibility without clutter.

## Priority Issues

- **[P1] Mixed-language UI labels.** Inspector fields render `Tên` / `Des` / `Tác giả` (Vietnamese) next to `KIND` / `STYLE NOTE` / `INSPECTOR` / `COLOR SCHEME` / `LIBRARY` (English) in the same panel. **Why it matters:** reads as unfinished localization; "Des" is a cryptic abbreviation. Worst offender of the whole UI. **Fix:** commit to one language per locale (proper i18n) or, at minimum, make a single panel internally consistent and expand `Des` → `Mô tả`/`Description`. **Command:** `clarify`.

- **[P1] Codex login block doesn't match the app's component vocabulary.** The new sign-in controls are bare unclassed `<button>`s with 4 layout-only CSS rules, while the surrounding panel has a rich `.provider-card` / `.provider-list-row` system with styled inputs and status states. No primary/secondary hierarchy among "Sign in with ChatGPT" / "Use a sign-in code" / API key; "Waiting for browser…" has no spinner. **Why it matters:** the most prominent new flow looks under-designed against a premium surface. **Fix:** promote "Sign in with ChatGPT" to a primary button, the others to secondary; reuse `.provider-card` input styling for the key field; add a spinner during the in-flight state. **Command:** `polish` (or `craft` for the whole panel).

- **[P2] Empty/sparse states with dead space.** The Advanced settings tab is three sparse cards ("Local — Desktop app required", "Secrets — 0 stored", "Usage — 0 API billed") floating in a large void; `Tác giả` renders empty. **Why it matters:** empty states should teach the interface, not leave a vacuum. **Fix:** give each card a one-line "what this is / next action," and tighten the Advanced layout so it doesn't read as broken. **Command:** `onboard`.

- **[P2] Onboarding is light-themed while the app is dark.** The first-run modal ("Start calm. Add power when you need it.") sits on a cream background; the workspace is dark. **Why it matters:** theme whiplash on the very first transition unless intentional. **Fix:** confirm intent; if not deliberate, align onboarding to the app theme or animate the transition. **Command:** `shape`.

- **[P3] Glass density + em dashes.** 34 `backdrop-filter` declarations — audit that each conveys depth purposefully rather than by reflex. 7 em-dashes in copy should become commas/colons/periods. **Command:** `clarify` / `polish`.

## Persona Red Flags

**Jordan (First-Timer):** Left rail is icon-only with no labels — pure recognition gamble. Mixed-language labels and the cryptic `Des` create hesitation. The empty Advanced tab reads as "is this broken?". Likely to stall before understanding the canvas model.

**Alex (Power User):** Node canvas, four views, and ⌘K are exactly right. But the Codex login is click-heavy with no keyboard path, long Codex generations show no progress, and a logged-out task does not auto-resume after sign-in (must re-trigger manually). Friction at exactly the moments a power user wants flow.

**ViệtX (Art Director, Vietnamese, F&B/branding — project persona):** The half-translated UI (`Tên`/`Des`/`Tác giả` among English labels) reads as an unfinished build; `Des` is not idiomatic Vietnamese. For a design-led tool aimed at a design-literate user, the localization seams undercut the otherwise premium feel.

## Minor Observations

- "Discover" vs "Edit" toggle on the canvas is unlabeled in purpose; a tooltip would help recognition.
- Provider list uses `data-status` styling (good) — extend that same status vocabulary to the Codex signed-in/out states instead of bespoke `.codex-login__*` classes.
- The `oauth_url` fallback link is now rendered (good), but the primary ChatGPT flow still lacks a visible "didn't open? click here" affordance until the event arrives.

## Questions to Consider

- What would the Codex login look like if it used the exact same card, button, and input components as the OpenAI/Anthropic providers — could it be visually indistinguishable from them?
- Is the app bilingual by design, or is Vietnamese leaking in from one contributor's panel? Picking one answer resolves the single most damaging consistency issue.
- Does the Advanced tab need to exist as its own tab yet, given it's nearly empty — or should it fold into Overview until it earns the space?
