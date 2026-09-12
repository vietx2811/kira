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
  text-muted: "#8f8c80"
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
    fontSize: "0.6875rem"
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

## 2. Design Principles & UX Guidelines

### 2.1 Progressive Disclosure & Direct Manipulation

- Every element in the app should be adjustable directly and visually (Direct Manipulation). Detailed settings for a property only appear when the user clicks directly on that element, as a contextual popover/panel — never dumped out in full the moment a parent panel/node opens (violates the Aesthetic & Minimalist Design Nielsen heuristic).
- Apply Progressive Disclosure: show a summary/preview plus a minimal set of shared controls by default. Full detail only opens on direct interaction with that specific target.
- Reference pattern: Figma's property panel — collapsed by default; clicking a field (e.g. a color swatch) opens a popover with full detail (hex, opacity, gradient...), instead of showing the whole list plus every setting at once.
- Concrete example (color palette case study): instead of showing a thumbnail plus the full color list plus settings all at once, show a summary (palette name, swatch count) — clicking an individual color opens a popover to edit that color.

### 2.2 Discoverability & Affordance (balanced against Progressive Disclosure)

Because Kira is an exploration/brainstorming app, users typically don't know in advance every feature or property available on a node — so the UI must hide by default but always signal how to discover more, per Don Norman's Affordance/Signifier principle and Nielsen's heuristic #6 (Recognition over Recall):

- **Hover affordance / contextual toolbar:** hovering a node reveals a small floating toolbar nearby (icons for recolor, add note, link, image...). The icon is the signifier — it announces "this is possible" without taking up space when not interacting.
- **"+" or "..." (overflow) as a "there's more" signal:** clicking it expands a full searchable palette (Notion's "/" command style) — teaching the user the full set of available properties while not permanently occupying canvas real estate.
- **Command palette (Cmd+K) / search-as-discovery:** a global search that lists every feature/property in the app, filtering as the user types — a way to surface all possibilities without spending default UI space, appearing only when the user actively invokes it.
- **Coach marks / spotlight onboarding on first use:** a short 3–4 step tour when the user creates their first node/mindmap, shown once, not repeated for returning users.
- **Empty/default state as implicit example:** the default node (or an example node on new-file creation) ships with a few properties already set, so the user sees the possibilities instead of having to read documentation.
- **Template/preset gallery:** a few ready-made mindmaps demonstrating use cases (brainstorm, research collection, planning...) surface possibility at the use-case level, without cluttering the UI panel.

### 2.3 Neo-Skeuomorphism / Skeuomorphic Minimalism (tactile visual language)

Selectively layer skeuomorphic material onto the existing flat/minimal foundation, so the app feels inspiring and warm rather than cold like pure flat design — an emerging design trend (2025–2026), **not** Neumorphism (soft-UI, monochrome pressed-button style — avoid, it has serious accessibility/contrast problems).

- **Principle:** keep the flat/minimal foundation for overall structure, but selectively reintroduce physical cues (depth, material, motion) to increase affordance and emotional warmth — without reverting to 2000s-style skeuomorphism (heavy texture, glossy shine, visual overload).
- **Techniques:** soft shadow + subtle gradient suggesting depth; subtle texture (fabric, paper, brushed metal) used sparingly on backgrounds/containers; a light 3D-lift effect for important nodes/buttons; smooth micro-interactions with feedback on hover/drag/drop.
- **Reference:** Apple's "Liquid Glass" (iOS 26 / visionOS) — a flat/minimal base combined with a translucent glass layer and light refraction, giving a material feel without visual clutter.
- **Applied to Kira:** nodes get subtle elevation/shadow to distinguish importance levels; dragging or connecting a node adds micro-motion plus a dynamic shadow (the feeling of "holding" a physical node); color swatches in popovers get subtle gradient/depth instead of flat color fills.
- **Important:** this principle sits at a different layer than 2.1/2.2 — 2.1/2.2 decide *when* information appears, 2.3 decides *how* an element looks and responds once it appears. Texture and shadow must never be used to obscure or conflict with the Progressive Disclosure principle in 2.1.

### 2.4 Neo-Skeuomorphism specifics for the Toolrail & Node Types

Drawing on Muse's (Ink & Switch) philosophy — a "canvas for ideas" app in the same category as Kira: the physical interface (a real desk) is messy, informal, free, and personal, while the digital interface tends to be tidy, arranged, structured, and sterile. Kira should actively narrow this gap with selective tactile cues, **without** trading away Minimal Chrome (avoid stuffing in extra toolbars/buttons — only content and genuinely necessary tools, per the Progressive Disclosure spirit in 2.1).

**Toolrail:**
- Toolrail icons use a light 3D style with color/gradient (instead of pure monochrome flat line icons) — the "expressive icon" trend common in creative apps (Linear, Arc, Raycast...), for a friendlier, more inspiring feel than flat icons.
- Still honors Minimal Chrome: the Toolrail shows only primary icons, no default text labels (use tooltips on hover — per the Discoverability principle in 2.2), avoiding turning the Toolrail into a heavy block competing with the canvas for attention.

**Node types (skeuomorphic treatment differentiated by content type):**
- **Regular idea/text nodes:** keep a flat/minimal card (per 2.1), no skeuomorphic treatment — avoid cluttering the most common node type on the canvas.
- **Note nodes:** evoke a real sticky note — soft drop shadow, optional slight rotation (like a hand-placed note), optional marker/handwriting-style font for content. Reference: Milanote, Apple Notes, Google Keep — apps that have successfully used the "real paper note" metaphor.
- **Image nodes:** a polaroid/corkboard-style frame — a thick-ish white border around the image, a shadow suggesting "pinned to a board," optional small caption below.
- **Pinpoint feature:** use a real pushpin metaphor — a colored 3D pin icon; when a user pins an important node/location, the pin appears with a small shadow for physical presence (the pin metaphor from Pinterest / a real corkboard). The pin only shows on pinned nodes — never by default on every node (per Progressive Disclosure).

**Shared constraint:** every tactile flourish in 2.4 must serve the content, never become decoration that obscures information — if a skeuomorphic detail doesn't help the user understand content or interact faster, drop it, per Muse's "Minimal Chrome" spirit.

## 3. Colors

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
- **Muted Text** (`#8f8c80` / `--text-muted`): captions, detail lines, uppercase micro-labels. Tuned to clear WCAG AA (4.5:1) against `--surface-2`, the darkest surface it's regularly paired with.
- **Hairline Border** (`rgb(255 255 255 / 0.06)` / `--border-soft`): the only border weight for dividing rows and outlining panels.

### Status accents (borrowed from Neutral+Primary, not new colors)
- **Amber** (`#dfae67` / `--accent-amber`): "needs attention" status text only (e.g. missing key, action required). Never a background fill.
- **Danger** (`#d98779` / `--danger`): destructive/error states only.

### Named Rules
**The One Accent Rule.** Teal-cyan is the only color allowed to mean "active" or "good." Everything else that needs to signal state borrows amber (attention) or danger (error) as text color only — never as a new background or a second brand color.

## 4. Typography

**Body Font:** Inter (with ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif fallback)
**Mono Font:** SFMono-Regular, Consolas, monospace (code paths, install paths)

**Character:** A single, restrained UI sans at 14px base. Weight carries hierarchy far more than size does; most panel text sits within a 0.6875rem–0.98rem range. `--text-micro` (0.6875rem / 11px) is the floor for functional text — nothing that conveys meaning renders smaller, per WCAG's minimum-legible-size guidance.

### Hierarchy
- **Title** (680 weight, 0.98rem): panel/section headings (`<h3>` in settings panels).
- **Body** (400 weight, 14px base / 0.78rem in panels): descriptive copy, max ~58ch line length.
- **Row label** (400 weight, 0.78rem): the primary text in a list row (e.g. "Chrome / Chromium").
- **Row detail** (400 weight, `--text-micro` / 0.6875rem, `--text-muted`): the secondary status/detail line under a row label.
- **Micro-label** (800 weight, 0.6875–0.74rem, uppercase where used): field labels, chip captions.
- **Sticky-note content** (`"Bradley Hand", "Segoe Print", "Noteworthy", cursive`, 0.92rem): the one sanctioned exception to the Inter-only rule, used solely on `.idea-node--sticker` content per the sticky-note metaphor in §2.4. System handwriting fonts only, no web font fetch.

### Named Rules
**The Weight-Not-Size Rule.** Hierarchy between a row's title and its status/detail line is carried by color (`--text-main` vs `--text-muted`) and a smaller size, never by inventing a new font weight beyond 400/680/800.

## 5. Elevation

Flat by default. KIRA conveys depth through tonal layering (base → surface-1 → surface-2) and hairline borders, not drop shadows. Shadows appear only on floating chrome that sits above the canvas (toolbars, panels with backdrop blur) to separate it from content scrolling underneath. This flat foundation still carries selective tactile depth on canvas nodes and important controls per the Neo-Skeuomorphism principle (2.3) — flat structure and tactile accents are complementary, not contradictory.

### Shadow Vocabulary
- **Panel shadow** (`box-shadow: 0 20px 70px rgb(0 0 0 / 0.28)`): floating toolbars and glass panels above canvas content.
- **Node rest / hover** (`0 6px 20px rgb(0 0 0 / 0.22)` / `0 12px 34px rgb(0 0 0 / 0.3)`): canvas nodes only.

### Named Rules
**The Flat-List Rule.** Settings and utility lists (providers, extensions, tags) never use shadows. Depth comes from the `--surface-drawer` background plus a single `--border-soft` outline around the whole list; individual rows are separated by a 1px top border, not by floating as separate shadowed cards.

## 6. Components

### Buttons
- **Shape:** 6px radius (`--radius-2`), 32px height for standard controls.
- **Quiet** (default utility action): `background: rgb(255 255 255 / 0.035)`, `color: var(--text-soft)`, no border. Used for the vast majority of secondary actions.
- **Primary:** `background: var(--glass-active)` (accent-tinted), `border: 1px solid color-mix(in srgb, var(--accent-cyan), transparent 62%)`, `color: var(--accent-strong)`. Reserved for the one committing action per view (e.g. "Start workspace").
- **Icon-only:** 32×32px, transparent background, `color: var(--text-soft)`; `.is-active` state gets the same accent-weak fill as primary's tint.
- **Hover / Focus:** background/color/transform transition over 160ms ease; no bounce.

### List Rows (the canonical pattern for Providers, Extensions, and similar status lists)
- **Container:** single `border: 1px solid var(--border-soft)`, `border-radius: var(--radius-2)`, `background: var(--surface-drawer)`, `overflow: hidden` — one continuous list, not N separate cards.
- **Row:** `grid-template-columns: minmax(0,1fr) auto`, `padding: 10px 12px`, `border-top: 1px solid var(--border-soft)` (omitted on the first row).
- **Row content (left):** stacked `strong` (title, `--text-main`, 0.78rem) + `small`/`em` (status detail, `--text-muted` or `--text-faint`, `--text-micro` / 0.6875rem).
- **Row action (right):** exactly one primary action per row (button or chevron affordance). A second, lower-priority action (e.g. "open settings") is an icon-only quiet button, not a second full-width text button.
- **Status color:** driven by a `data-status` attribute on the row (`connected`/`installed` → `--accent-cyan` text; `key_missing`/`needs-attention` → `--accent-amber` text). Status is always paired with a text word, never color alone.

### Cards (onboarding only)
- **Corner Style:** 10px radius.
- **Background:** `color-mix(in srgb, var(--surface-1), transparent 18%)`.
- **Border:** `1px solid var(--border-soft)`.
- **Use:** first-run onboarding overlay only, where a single committing action needs visual weight. Not for steady-state settings lists.

### Chips
- **Style:** `background: var(--glass-hover)`, pill radius (999px), `color: var(--text-soft)`, 0.72rem. Used for compact inline status ("Providers 2/4").

## 7. Do's and Don'ts

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
