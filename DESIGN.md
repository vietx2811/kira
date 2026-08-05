---
name: KIRA Desktop
description: A calm, local-first visual research workspace for macOS.
colors:
  bg-base: "#0d0e0d"
  bg-canvas: "#101211"
  surface-1: "#151716"
  surface-2: "#1b1e1c"
  surface-3: "#222620"
  surface-drawer: "#151716"
  surface-inset: "#0f1110"
  border-soft: "rgb(255 255 255 / 0.06)"
  border-strong: "rgb(255 255 255 / 0.13)"
  text-main: "#f1eee7"
  text-soft: "#b3afa5"
  text-muted: "#77766d"
  accent-cyan: "#84cdbc"
  accent-strong: "#9edccd"
  accent-weak: "rgb(132 205 188 / 0.28)"
  accent-faint: "rgb(158 220 205 / 0.12)"
  accent-amber: "#dfae67"
  accent-sage: "#9cae83"
  accent-violet: "#b7a4df"
  danger: "#d98779"
typography:
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "14px"
    lineHeight: 1.45
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "0.98rem"
    fontWeight: 680
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "0.68rem"
    fontWeight: 800
    letterSpacing: "normal"
  mono:
    fontFamily: "SFMono-Regular, Consolas, monospace"
    fontSize: "0.78rem"
rounded:
  1: "4px"
  2: "6px"
  3: "8px"
  pill: "999px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  5: "20px"
  6: "24px"
components:
  button-quiet:
    backgroundColor: "rgb(255 255 255 / 0.035)"
    textColor: "{colors.text-soft}"
    rounded: "{rounded.2}"
    padding: "0 12px"
  button-primary:
    backgroundColor: "{colors.accent-faint}"
    textColor: "{colors.accent-strong}"
    rounded: "{rounded.2}"
    padding: "0 12px"
  list-row:
    backgroundColor: "transparent"
    rounded: "0"
    padding: "10px 12px"
---

# Design System: KIRA Desktop

## 1. Overview

**Creative North Star: "The Quiet Instrument Panel"**

KIRA is a local-first macOS workspace for turning visual references into connected ideas. The interface reads like a well-made instrument panel, not a marketing surface: near-black warm neutrals, a single restrained teal-cyan accent, hairline dividers instead of boxes, and status conveyed through color and text rather than illustration. Density is moderate; nothing shouts. The system explicitly rejects rambling multi-step SaaS onboarding wizards (progress bars, big illustrations, "Step 2 of 5") and generic repeated card grids where every entry is an identical icon-plus-heading tile — both read as templated dashboard filler in a tool built to disappear into the user's flow.

Utility surfaces (settings, capture, provider connections) follow one shared idiom: a bordered list with hairline row dividers, status-first left column, one clear primary action per row. Cards are reserved for onboarding moments that genuinely need more breathing room (the first-run overlay); everywhere else, rows win.

**Key Characteristics:**
- Near-black warm-neutral surfaces, one accent color (teal-cyan), used sparingly
- Hairline dividers over boxed cards for lists of similar items
- Status (installed / not detected / needs action) always stated in words, never color-only
- One primary action per row; secondary actions are quiet icon affordances, not a second full-width button
- Flat, layered by tone rather than shadow

## 2. Colors

Warm near-black neutrals carry the whole surface; a single teal-cyan accent marks state and interactivity.

### Primary
- **Muted Teal-Cyan** (`#84cdbc` / `--accent-cyan`): the one accent. Used for active/selected states, connected/installed status text, and focus rings. Never used decoratively.
- **Bright Teal-Cyan** (`#9edccd` / `--accent-strong`): accent text on top of the faint accent fill (e.g. active tab, connected label).

### Neutral
- **Base Black** (`#0d0e0d` / `--bg-base`): the outermost window background.
- **Canvas Black** (`#101211` / `--bg-canvas`): the working canvas beneath nodes.
- **Panel Surface** (`#151716` / `--surface-1` / `--surface-drawer`): drawers, inspectors, settings panels, list containers.
- **Raised Surface** (`#1b1e1c` / `--surface-2`): one step up for hover/raised chrome.
- **Inset Field** (`#0f1110` / `--surface-inset`): form inputs, recessed wells.
- **Main Text** (`#f1eee7` / `--text-main`): titles, primary labels.
- **Soft Text** (`#b3afa5` / `--text-soft`): body copy, secondary labels, quiet-button text.
- **Muted Text** (`#77766d` / `--text-muted`): captions, detail lines, uppercase micro-labels.
- **Hairline Border** (`rgb(255 255 255 / 0.06)` / `--border-soft`): the only border weight for dividing rows and outlining panels.

### Status accents (borrowed from Neutral+Primary, not new colors)
- **Amber** (`#dfae67` / `--accent-amber`): "needs attention" status text only (e.g. missing key, action required). Never a background fill.
- **Danger** (`#d98779` / `--danger`): destructive/error states only.

### Named Rules
**The One Accent Rule.** Teal-cyan is the only color allowed to mean "active" or "good." Everything else that needs to signal state borrows amber (attention) or danger (error) as text color only — never as a new background or a second brand color.

## 3. Typography

**Body Font:** Inter (with ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif fallback)
**Mono Font:** SFMono-Regular, Consolas, monospace (code paths, install paths)

**Character:** A single, restrained UI sans at 14px base. Weight carries hierarchy far more than size does; most panel text sits within a 0.66rem–0.98rem range.

### Hierarchy
- **Title** (680 weight, 0.98rem): panel/section headings (`<h3>` in settings panels).
- **Body** (400 weight, 14px base / 0.78rem in panels): descriptive copy, max ~58ch line length.
- **Row label** (400 weight, 0.78rem): the primary text in a list row (e.g. "Chrome / Chromium").
- **Row detail** (400 weight, 0.66–0.68rem, `--text-muted`): the secondary status/detail line under a row label.
- **Micro-label** (800 weight, 0.64–0.72rem, uppercase where used): field labels, chip captions.

### Named Rules
**The Weight-Not-Size Rule.** Hierarchy between a row's title and its status/detail line is carried by color (`--text-main` vs `--text-muted`) and a smaller size, never by inventing a new font weight beyond 400/680/800.

## 4. Elevation

Flat by default. KIRA conveys depth through tonal layering (base → surface-1 → surface-2) and hairline borders, not drop shadows. Shadows appear only on floating chrome that sits above the canvas (toolbars, panels with backdrop blur) to separate it from content scrolling underneath.

### Shadow Vocabulary
- **Panel shadow** (`box-shadow: 0 20px 70px rgb(0 0 0 / 0.28)`): floating toolbars and glass panels above canvas content.
- **Node rest / hover** (`0 6px 20px rgb(0 0 0 / 0.22)` / `0 12px 34px rgb(0 0 0 / 0.3)`): canvas nodes only.

### Named Rules
**The Flat-List Rule.** Settings and utility lists (providers, extensions, tags) never use shadows. Depth comes from the `--surface-drawer` background plus a single `--border-soft` outline around the whole list; individual rows are separated by a 1px top border, not by floating as separate shadowed cards.

## 5. Components

### Buttons
- **Shape:** 6px radius (`--radius-2`), 32px height for standard controls.
- **Quiet** (default utility action): `background: rgb(255 255 255 / 0.035)`, `color: var(--text-soft)`, no border. Used for the vast majority of secondary actions.
- **Primary:** `background: var(--glass-active)` (accent-tinted), `border: 1px solid color-mix(in srgb, var(--accent-cyan), transparent 62%)`, `color: var(--accent-strong)`. Reserved for the one committing action per view (e.g. "Start workspace").
- **Icon-only:** 32×32px, transparent background, `color: var(--text-soft)`; `.is-active` state gets the same accent-weak fill as primary's tint.
- **Hover / Focus:** background/color/transform transition over 160ms ease; no bounce.

### List Rows (the canonical pattern for Providers, Extensions, and similar status lists)
- **Container:** single `border: 1px solid var(--border-soft)`, `border-radius: var(--radius-2)`, `background: var(--surface-drawer)`, `overflow: hidden` — one continuous list, not N separate cards.
- **Row:** `grid-template-columns: minmax(0,1fr) auto`, `padding: 10px 12px`, `border-top: 1px solid var(--border-soft)` (omitted on the first row).
- **Row content (left):** stacked `strong` (title, `--text-main`, 0.78rem) + `small`/`em` (status detail, `--text-muted` or `--text-faint`, 0.64–0.66rem).
- **Row action (right):** exactly one primary action per row (button or chevron affordance). A second, lower-priority action (e.g. "open settings") is an icon-only quiet button, not a second full-width text button.
- **Status color:** driven by a `data-status` attribute on the row (`connected`/`installed` → `--accent-cyan` text; `key_missing`/`needs-attention` → `--accent-amber` text). Status is always paired with a text word, never color alone.

### Cards (onboarding only)
- **Corner Style:** 10px radius.
- **Background:** `color-mix(in srgb, var(--surface-1), transparent 18%)`.
- **Border:** `1px solid var(--border-soft)`.
- **Use:** first-run onboarding overlay only, where a single committing action needs visual weight. Not for steady-state settings lists.

### Chips
- **Style:** `background: var(--glass-hover)`, pill radius (999px), `color: var(--text-soft)`, 0.72rem. Used for compact inline status ("Providers 2/4").

## 6. Do's and Don'ts

### Do:
- **Do** render lists of similar connectable things (browser extensions, AI providers) as one hairline-divided list (`border-soft` container + `border-top` rows), matching the existing Providers list pattern.
- **Do** lead every row with status in words (`installed`, `not detected in Chrome`), colored with the One Accent Rule (`--accent-cyan` for good, `--accent-amber` for attention).
- **Do** give each row exactly one primary action button; demote any secondary action to a small icon button.
- **Do** keep the "Refresh / detect installed extensions" action as a single quiet icon button in the list header, not a grid item that looks like a third extension target.

### Don't:
- **Don't** render extensions/providers/similar targets as a 2-column grid of identical boxed cards with icon + heading + two stacked buttons — reads as templated AI-dashboard filler, per PRODUCT.md's anti-references.
- **Don't** build a multi-step wizard (progress bar, "Step 2 of 5", large illustrations) for what is a two-item utility list.
- **Don't** use gradient text, glassmorphism as decoration, or a hero-metric tile anywhere in this panel.
- **Don't** signal status by color alone; always pair with a text word.
- **Don't** give two buttons in the same row equal visual weight (e.g. two `quiet-button`s side by side) when one is clearly primary and the other secondary.
