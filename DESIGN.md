---
name: KIRA Desktop
description: A calm, local-first visual research workspace for macOS.
colors:
  # Default Cyan preset, dark mode, as buildProjectAppearanceStyle() renders it on
  # .app-shell. Source: specimen S:23-33 (copied from the running app at 4150b97;
  # main.tsx has no commits between 4150b97 and a00af07). Alpha tokens marked
  # "formula" are computed from buildProjectAppearanceStyle(), not sampled.
  bg-base: "#020303"
  bg-canvas: "#040808"
  surface-1: "#080e0e"
  surface-2: "#0f1619"
  surface-3: "#192124"
  surface-drawer: "#060c0c"
  surface-inset: "#0d1315"
  border-soft: "rgb(255 255 255 / 0.06)"
  border-strong: "rgb(255 255 255 / 0.13)"
  separator-hairline: "rgb(255 255 255 / 0.052)"
  glass-hover: "rgb(255 255 255 / 0.055)"
  text-main: "#f4f1ea"
  text-soft: "#b5b4af"
  text-muted: "#8e8e8a"
  accent-cyan: "#7fc8b7"
  accent-strong: "#7fc8b7"
  accent-weak: "rgb(127 200 183 / 0.28)" # formula
  accent-faint: "rgb(127 200 183 / 0.12)" # formula
  accent-sage: "rgb(127 200 183 / 0.76)" # formula; styles.css :root #9cae83 is overridden
  accent-violet: "#b7a4df" # static :root token, not themed
  accent-amber: "#dfae67"
  danger: "#d98779"
  # Same preset, light mode. Source: specimen S:37-47.
  bg-base-light: "#eff3f3"
  bg-canvas-light: "#dfe5e5"
  surface-1-light: "#d7dede"
  surface-2-light: "#cad3d5"
  surface-3-light: "#bdc6c9"
  surface-drawer-light: "#dae1e1"
  surface-inset-light: "#d5dcde"
  border-soft-light: "rgb(35 33 29 / 0.1)"
  border-strong-light: "rgb(35 33 29 / 0.18)"
  separator-hairline-light: "rgb(35 33 29 / 0.1)"
  glass-hover-light: "rgb(34 31 26 / 0.055)"
  text-main-light: "#23211d"
  text-soft-light: "#3e3d39"
  text-muted-light: "#575855"
  accent-cyan-light: "#0c6052"
  accent-strong-light: "#004f42"
  accent-weak-light: "rgb(0 79 66 / 0.22)" # formula
  accent-faint-light: "rgb(0 79 66 / 0.1)" # formula
  accent-sage-light: "rgb(12 96 82 / 0.76)" # formula
  accent-amber-light: "#7a4e00"
  danger-light: "#8a4035"
  # Ink & Paper controls, dark. Source: S:115-121, tooltip S:232, rail S:251, S:263.
  control-primary: "#f4f1ea"
  control-primary-hover: "#fffdf7"
  control-primary-pressed: "#dcd8cf"
  control-on-primary: "#0f1517"
  control-sheet: "#1c2426"
  control-sheet-hover: "#222b2d"
  control-sheet-pressed: "#141b1d"
  control-sheet-edge: "rgb(255 255 255 / 0.075)"
  control-patch: "rgb(255 255 255 / 0.065)"
  control-patch-pressed: "rgb(255 255 255 / 0.035)"
  control-disabled-edge: "rgb(255 255 255 / 0.14)"
  control-danger-text: "#e59587"
  control-danger-edge: "rgb(217 135 121 / 0.38)"
  control-lift-near: "rgb(0 0 0 / 0.5)"
  control-lift-far: "rgb(0 0 0 / 0.55)"
  control-lift-far-hover: "rgb(0 0 0 / 0.62)"
  control-paper-edge: "rgb(35 33 29 / 0.25)"
  rail-plate: "rgb(29 37 39 / 0.95)"
  rail-chip: "#f4f1ea"
  tooltip-bg: "#f4f1ea"
  tooltip-text: "#0f1517"
  tooltip-kbd: "#4a4c48"
  # Ink & Paper controls, light. Source: S:122-128, S:233, S:252, S:264.
  control-primary-light: "#23211d"
  control-primary-hover-light: "#35322c"
  control-primary-pressed-light: "#12110f"
  control-on-primary-light: "#f7f5f0"
  control-sheet-light: "#fbfaf7"
  control-sheet-hover-light: "#ffffff"
  control-sheet-pressed-light: "#eceae4"
  control-sheet-edge-light: "rgb(35 33 29 / 0.13)"
  control-patch-light: "rgb(35 33 29 / 0.065)"
  control-patch-pressed-light: "rgb(35 33 29 / 0.1)"
  control-disabled-edge-light: "rgb(35 33 29 / 0.2)"
  control-danger-text-light: "#8a4035"
  control-danger-edge-light: "rgb(138 64 53 / 0.4)"
  control-lift-near-light: "rgb(35 33 29 / 0.1)"
  control-lift-far-light: "rgb(35 33 29 / 0.24)"
  control-lift-far-hover-light: "rgb(35 33 29 / 0.3)"
  control-paper-edge-light: "rgb(255 255 255 / 0.12)"
  rail-plate-light: "rgb(251 250 247 / 0.96)"
  rail-chip-light: "#23211d"
  tooltip-bg-light: "#23211d"
  tooltip-text-light: "#f7f5f0"
  tooltip-kbd-light: "#c9c6bf"
  # Node-kind icon colors: rail create-node icons only (S:207-211). Same in both modes.
  icon-sky: "#8cc5ea"
  icon-sun: "#ffcf5c"
  icon-leaf: "#6aab77"
  icon-rose: "#e5728a"
  icon-amber: "#eea43a"
  icon-teal: "#4fb49c"
  icon-fold: "#d6a92f"
  icon-outline: "#0b0f10"
  icon-outline-light: "#23211d"
  kira-warm: "#f0c07f"
  kira-mid: "#d79fc0"
  kira-cool: "#a5a6ea"
typography:
  body:
    fontFamily: "-apple-system, blinkmacsystemfont, ui-sans-serif, system-ui, 'Segoe UI', sans-serif"
    fontSize: "14px"
    lineHeight: 1.45
  title:
    fontFamily: "-apple-system, blinkmacsystemfont, ui-sans-serif, system-ui, 'Segoe UI', sans-serif"
    fontSize: "15px"
    fontWeight: 680
  label:
    fontFamily: "-apple-system, blinkmacsystemfont, ui-sans-serif, system-ui, 'Segoe UI', sans-serif"
    fontSize: "11px"
    fontWeight: 800
    letterSpacing: "normal"
  control-label:
    fontFamily: "-apple-system, blinkmacsystemfont, ui-sans-serif, system-ui, 'Segoe UI', sans-serif"
    fontSize: "13px"
    fontWeight: 560
    letterSpacing: "-0.003em"
  control-label-compact:
    fontFamily: "-apple-system, blinkmacsystemfont, ui-sans-serif, system-ui, 'Segoe UI', sans-serif"
    fontSize: "11px"
    fontWeight: 560
    letterSpacing: "-0.003em"
  mono:
    fontFamily: "SFMono-Regular, Consolas, monospace"
    fontSize: "11px"
rounded:
  1: "4px"
  2: "6px"
  3: "8px"
  4: "12px"
  5: "20px"
  shell-card: "16px"
  pill: "999px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  5: "20px"
  6: "24px"
components:
  button-primary:
    backgroundColor: "{colors.control-primary}"
    textColor: "{colors.control-on-primary}"
    typography: "{typography.control-label}"
    rounded: "{rounded.3}"
    padding: "0 12px"
    height: "32px"
  button-primary-hover:
    backgroundColor: "{colors.control-primary-hover}"
  button-primary-active:
    backgroundColor: "{colors.control-primary-pressed}"
  button-secondary:
    backgroundColor: "{colors.control-sheet}"
    textColor: "{colors.text-main}"
    typography: "{typography.control-label}"
    rounded: "{rounded.3}"
    padding: "0 12px"
    height: "32px"
  button-secondary-hover:
    backgroundColor: "{colors.control-sheet-hover}"
  button-secondary-active:
    backgroundColor: "{colors.control-sheet-pressed}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.text-soft}"
    typography: "{typography.control-label}"
    rounded: "{rounded.3}"
    padding: "0 12px"
    height: "32px"
  button-quiet-hover:
    backgroundColor: "{colors.control-patch}"
    textColor: "{colors.text-main}"
  button-quiet-active:
    backgroundColor: "{colors.control-patch-pressed}"
    textColor: "{colors.text-main}"
  button-danger:
    backgroundColor: "{colors.control-sheet}"
    textColor: "{colors.control-danger-text}"
    typography: "{typography.control-label}"
    rounded: "{rounded.3}"
    padding: "0 12px"
    height: "32px"
  button-compact:
    typography: "{typography.control-label-compact}"
    rounded: "{rounded.2}"
    padding: "0 9px"
    height: "26px"
  button-icon:
    size: "32px"
  rail-tool:
    backgroundColor: "transparent"
    rounded: "{rounded.4}"
    size: "44px"
  rail-tool-selected:
    backgroundColor: "{colors.rail-chip}"
  tooltip:
    backgroundColor: "{colors.tooltip-bg}"
    textColor: "{colors.tooltip-text}"
    typography: "{typography.control-label-compact}"
    padding: "0 9px"
    height: "26px"
  list-row:
    backgroundColor: "transparent"
    rounded: "0"
    padding: "10px 12px"
---

# Design System: KIRA Desktop

## 1. Overview

**Creative North Star: "The Quiet Instrument Panel"**

KIRA is a local-first macOS workspace for turning visual references into connected ideas. The interface reads like a well-made instrument panel, not a marketing surface: near-black surfaces with warm text, hairline dividers instead of boxes, and status conveyed through words and color rather than illustration. Density is moderate; nothing shouts. The system explicitly rejects rambling multi-step SaaS onboarding wizards (progress bars, big illustrations, "Step 2 of 5") and generic repeated card grids where every entry is an identical icon-plus-heading tile: both read as templated dashboard filler in a tool built to disappear into the user's flow.

Controls follow the **Ink & Paper** personality: the one committing action is a block of ink, secondary actions are sheets of paper lifted off the surface, and the teal accent is handed back to the work itself (what is selected on the canvas, where focus is, what state something is in). *(đổi 2026-09-15: user chốt Ink & Paper, báo cáo `docs/research/2026-09-14-art-direction-controls-v2.md` §F; vòng 1 tint teal mọi trạng thái nên primary và "đang bật" không phân biệt được.)*

Utility surfaces (settings, capture, provider connections) follow one shared idiom: a bordered list with hairline row dividers, status-first left column, one main action per row. Cards are reserved for onboarding moments that genuinely need more breathing room (the first-run overlay); everywhere else, rows win.

**Key Characteristics:**
- Near-black surfaces (tinted faintly by the project's accent preset) with warm off-white text; light mode is a pale, equally quiet counterpart (§3)
- Teal-cyan means exactly three things: canvas selection, keyboard focus, state. Controls never wear it *(đổi 2026-09-15, xem §3)*
- Primary and secondary are separated by lightness and material, not by tint: ink block versus paper sheet *(đổi 2026-09-15)*
- Hairline dividers over boxed cards for lists of similar items
- Status (installed / not detected / needs action) always stated in words, never color-only
- One primary per view; each row's main action is a secondary sheet, further actions are quiet *(đổi 2026-09-15: một primary mỗi view là luật bắt buộc, lý do ở §7)*
- Structure is flat and layered by tone; only filled controls, floating chrome and canvas nodes carry shadow *(đổi 2026-09-15: bóng giấy trên nút có nền)*

## 2. Design Principles & UX Guidelines

### 2.1 Progressive Disclosure & Direct Manipulation

- Every element in the app should be adjustable directly and visually (Direct Manipulation). Detailed settings for a property only appear when the user clicks directly on that element, as a contextual popover/panel, never dumped out in full the moment a parent panel/node opens (violates the Aesthetic & Minimalist Design Nielsen heuristic).
- Apply Progressive Disclosure: show a summary/preview plus a minimal set of shared controls by default. Full detail only opens on direct interaction with that specific target.
- Reference pattern: Figma's property panel, collapsed by default; clicking a field (e.g. a color swatch) opens a popover with full detail (hex, opacity, gradient...), instead of showing the whole list plus every setting at once.
- Concrete example (color palette case study): instead of showing a thumbnail plus the full color list plus settings all at once, show a summary (palette name, swatch count); clicking an individual color opens a popover to edit that color.

### 2.2 Discoverability & Affordance (balanced against Progressive Disclosure)

Because Kira is an exploration/brainstorming app, users typically don't know in advance every feature or property available on a node, so the UI must hide by default but always signal how to discover more, per Don Norman's Affordance/Signifier principle and Nielsen's heuristic #6 (Recognition over Recall):

- **Hover affordance / contextual toolbar:** hovering a node reveals a small floating toolbar nearby (icons for recolor, add note, link, image...). The icon is the signifier: it announces "this is possible" without taking up space when not interacting.
- **"+" or "..." (overflow) as a "there's more" signal:** clicking it expands a full searchable palette (Notion's "/" command style), teaching the user the full set of available properties while not permanently occupying canvas real estate.
- **Command palette (Cmd+K) / search-as-discovery:** a global search that lists every feature/property in the app, filtering as the user types, a way to surface all possibilities without spending default UI space, appearing only when the user actively invokes it.
- **Coach marks / spotlight onboarding on first use:** a short 3 to 4 step tour when the user creates their first node/mindmap, shown once, not repeated for returning users.
- **Empty/default state as implicit example:** the default node (or an example node on new-file creation) ships with a few properties already set, so the user sees the possibilities instead of having to read documentation.
- **Template/preset gallery:** a few ready-made mindmaps demonstrating use cases (brainstorm, research collection, planning...) surface possibility at the use-case level, without cluttering the UI panel.

### 2.3 Neo-Skeuomorphism / Skeuomorphic Minimalism (tactile visual language)

Selectively layer skeuomorphic material onto the existing flat/minimal foundation, so the app feels inspiring and warm rather than cold like pure flat design: an emerging design trend (2025 to 2026), **not** Neumorphism (soft-UI, monochrome pressed-button style; avoid, it has serious accessibility/contrast problems).

- **Principle:** keep the flat/minimal foundation for overall structure, but selectively reintroduce physical cues (depth, material, motion) to increase affordance and emotional warmth, without reverting to 2000s-style skeuomorphism (heavy texture, glossy shine, visual overload).
- **Techniques:** soft shadow + subtle gradient suggesting depth; subtle texture (fabric, paper, brushed metal) used sparingly on backgrounds/containers; a light 3D-lift effect for important nodes/buttons; smooth micro-interactions with feedback on hover/drag/drop.
- **Reference:** Apple's "Liquid Glass" (iOS 26 / visionOS), a flat/minimal base combined with a translucent glass layer and light refraction, giving a material feel without visual clutter.
- **Applied to Kira:** controls are ink and paper (§7); nodes get subtle elevation/shadow to distinguish importance levels; dragging or connecting a node adds micro-motion plus a dynamic shadow (the feeling of "holding" a physical node); color swatches in popovers get subtle gradient/depth instead of flat color fills.
- **Important:** this principle sits at a different layer than 2.1/2.2: 2.1/2.2 decide *when* information appears, 2.3 decides *how* an element looks and responds once it appears. Texture and shadow must never be used to obscure or conflict with the Progressive Disclosure principle in 2.1.

### 2.4 Neo-Skeuomorphism specifics for the Toolrail & Node Types

Drawing on Muse's (Ink & Switch) philosophy, a "canvas for ideas" app in the same category as Kira: the physical interface (a real desk) is messy, informal, free, and personal, while the digital interface tends to be tidy, arranged, structured, and sterile. Kira should actively narrow this gap with selective tactile cues, **without** trading away Minimal Chrome (avoid stuffing in extra toolbars/buttons; only content and genuinely necessary tools, per the Progressive Disclosure spirit in 2.1).

**Toolrail:**
- Toolrail icons are drawn in-house as small colored stickers with body, color per node kind and an ink cut-line (§7 Tool rail). They are the one place in the chrome where color is expressive rather than semantic. *(đổi 2026-09-15: chốt vẽ riêng 12 icon SVG thay phosphor ở rail và lucide ở zoom, R2 §D.)*
- **Two icon families, on purpose:** rail tools are *instruments* (colored, with body, they lift when hovered); glyphs inside the UI (buttons with labels, panels, menus, Settings) are *type* and stay Lucide line icons, never colored, never shaded. *(đổi 2026-09-15: user chốt hai họ icon có chủ đích.)*
- **Monochrome option:** a user setting renders the rail icons single-tone for people who judge color all day. Same geometry, only CSS variables change (§7). *(đổi 2026-09-15: rủi ro "icon màu cạnh ảnh reference", R2 §F.)*
- Still honors Minimal Chrome: the Toolrail shows only primary icons, no default text labels (tooltips on hover with name and shortcut, per the Discoverability principle in 2.2), avoiding turning the Toolrail into a heavy block competing with the canvas for attention.

**Node types (skeuomorphic treatment differentiated by content type):**
- **Regular idea/text nodes:** keep a flat/minimal card (per 2.1), no skeuomorphic treatment; avoid cluttering the most common node type on the canvas.
- **Note nodes:** evoke a real sticky note: soft drop shadow, optional slight rotation (like a hand-placed note), optional marker/handwriting-style font for content. Reference: Milanote, Apple Notes, Google Keep, apps that have successfully used the "real paper note" metaphor.
- **Image nodes:** a polaroid/corkboard-style frame: a thick-ish white border around the image, a shadow suggesting "pinned to a board," optional small caption below.
- **Pinpoint feature:** use a real pushpin metaphor: a colored 3D pin icon; when a user pins an important node/location, the pin appears with a small shadow for physical presence (the pin metaphor from Pinterest / a real corkboard). The pin only shows on pinned nodes, never by default on every node (per Progressive Disclosure).

**Shared constraint:** every tactile flourish in 2.4 must serve the content, never become decoration that obscures information. If a skeuomorphic detail doesn't help the user understand content or interact faster, drop it, per Muse's "Minimal Chrome" spirit.

## 3. Colors

Near-black surfaces carry the whole interface; the teal-cyan accent marks what is selected on the canvas, where focus is, and what state something is in.

All hex values below are the default **Cyan** preset. Surfaces, text and accent are generated per project by `buildProjectAppearanceStyle()` (`main.tsx`) from the preset and the color mode, and set inline on `.app-shell`; other presets shift the surface tint and accent. Never hardcode these hex values in component CSS: use the tokens. *(đổi 2026-09-15: giá trị cũ `#0d0e0d`, `#9edccd`… không còn khớp màu app render, R1 P3-10; thêm palette light.)*

### Primary
- **Muted Teal-Cyan** (`--accent-cyan`, dark `#7fc8b7`, light `#0c6052`): the one semantic accent. Used for (1) selection on the canvas: the selected node's outline and its active edges; (2) keyboard focus: the 2px focus outline; (3) state: connected/installed status text, a checked checkbox or switch. Never on a button fill, never for a selected tab or tool. *(đổi 2026-09-15: teal thôi làm primary và selected của UI, R2 §E.)*
- **Strong Teal-Cyan** (`--accent-strong`, dark `#7fc8b7`, light `#004f42`): accent text where the plain accent would lack contrast (light mode status labels).

### Neutral

| Token | Dark | Light | Role |
|---|---|---|---|
| `--bg-base` | `#020303` | `#eff3f3` | Outermost window background |
| `--bg-canvas` | `#040808` | `#dfe5e5` | Working canvas beneath nodes |
| `--surface-1` | `#080e0e` | `#d7dede` | Panels, inspectors, settings, list containers |
| `--surface-drawer` | `#060c0c` | `#dae1e1` | Drawers |
| `--surface-2` | `#0f1619` | `#cad3d5` | One step up: raised chrome, cards in panels |
| `--surface-3` | `#192124` | `#bdc6c9` | Highest raised step |
| `--surface-inset` | `#0d1315` | `#d5dcde` | Form inputs, recessed wells |
| `--text-main` | `#f4f1ea` | `#23211d` | Titles, primary labels, the ink of selected controls |
| `--text-soft` | `#b5b4af` | `#3e3d39` | Body copy, secondary labels, quiet-button text |
| `--text-muted` | `#8e8e8a` | `#575855` | Captions, detail lines, disabled labels |
| `--border-soft` | `rgb(255 255 255 / 0.06)` | `rgb(35 33 29 / 0.1)` | Dividing rows, outlining panels |
| `--border-strong` | `rgb(255 255 255 / 0.13)` | `rgb(35 33 29 / 0.18)` | Input outlines, dialog edges |
| `--separator-hairline` | `rgb(255 255 255 / 0.052)` | `rgb(35 33 29 / 0.1)` | Rail and toolbar group separators |

`projectColorTokens()` floors `--text-soft` at 7:1 and `--text-muted` at 4.6:1 against every reading surface, so these pairs stay AA in any preset.

### Status accents
- **Amber** (`--accent-amber`, dark `#dfae67`, light `#7a4e00`): "needs attention" status text and count badges (e.g. missing key, "Cần bạn 3"). Fixed hue, not derived from the preset accent.
- **Danger** (`--danger`, dark `#d98779`, light `#8a4035`): destructive/error states only. On a paper sheet the danger button uses the lifted `control-danger-text` (`#e59587` dark) for contrast.

### Named Rules
**The One Accent Rule.** Teal-cyan is the only color allowed to mean "selected on the canvas," "focused" or "good." Everything else that needs to signal state borrows amber (attention) or danger (error) as text color only, never as a new background or a second brand color. Controls express their own selected state in ink (§7), not in teal. *(đổi 2026-09-15: thu hẹp nghĩa của teal; vòng 1 đếm 29 phần tử mang teal khi chọn một node, teal mất nghĩa "đang chọn", R1 P2-7.)*

**The Node-Kind Color Rule.** A second, sanctioned color group exists **only inside the rail's create-node icons**: sky `#8cc5ea`, sun `#ffcf5c`, leaf `#6aab77`, rose `#e5728a`, amber `#eea43a`, teal `#4fb49c`, fold `#d6a92f` (S:207), plus the idea, note and palette body gradients (S:209-211). These colors identify *what kind of node a tool makes*; they never mean state, never appear on buttons, panels, text or nodes, and disappear entirely under the monochrome option. The icon teal `#4fb49c` is a sticker color, not `--accent-cyan`. *(đổi 2026-09-15: icon rail có màu thật theo loại node, R2 §B.2, §E.)*

**The Ink Primary Rule.** The committing action is the lightness inverse of the surface: a paper-white block in dark mode, an ink-black block in light mode. It is the only control that inverts. *(đổi 2026-09-15: primary tách khỏi secondary bằng độ sáng; vòng 1 chữ primary 6,20:1 thấp hơn secondary 15,26:1, R2 §A.)*

**The Kira Signature Exception.** The one sanctioned exception to the One Accent Rule outside the rail stickers: the AI entry point uses a dedicated warm/mid/cool sweep (`--kira-warm #f0c07f`, `--kira-mid #d79fc0`, `--kira-cool #a5a6ea`). It appears on the selected node's Kira control (`.node-kira-control`, as a hover glint) and as the fill of the Kira icon on the canvas chrome (S:499). This is a signature, not a status color: it never means "active," "good," "attention," or "error." No other component may borrow this palette. *(đổi 2026-09-15: thêm icon Kira trên chrome canvas vào phạm vi ngoại lệ.)*

## 4. Typography

**Body Font:** the system UI font, `--font-sans: -apple-system, blinkmacsystemfont, ui-sans-serif, system-ui, "Segoe UI", sans-serif` (SF Pro on macOS). No web font is loaded. *(đổi 2026-09-15: DESIGN.md ghi Inter nhưng Inter chưa bao giờ được nạp, mọi bản build đã rơi về SF Pro; styles.css đã đặt tên font hệ thống.)*
**Mono Font:** SFMono-Regular, Consolas, monospace (code paths, install paths)

**Character:** A single, restrained system sans at a 14px root. Weight carries hierarchy far more than size does. *(đổi 2026-09-15: bỏ các cỡ rem cũ, code không còn cỡ rem nào.)* Every `font-size` is a token from the type scale in `CLAUDE.md` (`--text-mini` 10px, `--text-small` 11px, `--text-body` 13px, `--text-title` 15px, `--text-large` 20px). `--text-small` (11px) is the floor for functional text: nothing that conveys meaning or is needed to operate renders smaller. *(đổi 2026-09-15: DESIGN.md gọi `--text-micro`, token này không tồn tại trong code.)*

### Hierarchy
- **Title** (680 weight, `--text-title` 15px): panel/section headings (`<h3>` in settings panels).
- **Body** (400 weight, 14px root; panel copy uses `--text-body` or `--text-small`): descriptive copy, max ~58ch line length.
- **Control label** (560 weight, `--text-body` 13px Regular, `--text-small` 11px Compact, letter-spacing -0.003em): every button, segmented option, tab and tooltip label (S:52, S:55, S:114, S:230). *(đổi 2026-09-15: thêm weight 560 cho nhãn control; vòng 1 đo 5 weight khác nhau trên nút, R1 P1-3.)*
- **Row label** (400 weight, `--text-small` 11px, `--text-main`): the primary text in a list row (e.g. "Chrome / Chromium").
- **Row detail** (400 weight, `--text-small` 11px, `--text-muted`): the secondary status/detail line under a row label.
- **Micro-label** (800 weight, `--text-small` 11px, uppercase where used): field labels, chip captions.
- **Sticky-note content** (`"Bradley Hand", "Segoe Print", "Noteworthy", cursive`, `--text-body`): the one sanctioned exception to the system-font rule, used solely on `.idea-node--sticker` content per the sticky-note metaphor in §2.4. System handwriting fonts only, no web font fetch.

### Named Rules
**The Weight-Not-Size Rule.** Hierarchy between a row's title and its status/detail line is carried by color (`--text-main` vs `--text-muted`) and a smaller size, never by inventing a new font weight beyond 400/560/680/800. 560 is reserved for control labels. *(đổi 2026-09-15: thêm 560.)*

## 5. Layout & Grouping

*(mục mới 2026-09-15: user đặt mục tiêu "cấp độ Figma", cấm pattern ô frame, dùng khoảng cách và line. Trước đó DESIGN.md không có luật riêng cho grouping, nên mỗi màn tự bịa cách nhóm; §7 Components chỉ nói về từng control, không nói cách xếp chúng cạnh nhau.)*

KIRA đã đúng luật này ở một chỗ và sai ở nhiều chỗ khác trong cùng một app, nên trước hết đây là luật **thống nhất lại**, không phải luật mới hoàn toàn.

### Named Rules

**The Space-and-Line-First Rule.** Nhóm nội dung liên quan bằng khoảng cách (`--space-*`) và, khi cần một ranh giới nhìn thấy được, bằng `1px` hairline (`--border-soft` hoặc `--separator-hairline`). Đây là công cụ **mặc định**. Card (nền riêng + viền + bo góc) là ngoại lệ phải tự biện minh, không phải điểm khởi đầu.

**The Object Card Rule.** Card chỉ bọc quanh một **vật thể thật**, thứ người dùng kéo, thả, hoặc bấm chọn như một đơn vị: node trên canvas, ảnh trong Thư viện, một mục ChangeSet đang mở trong panel phải (`docs/design/right-panel/`), một hàng provider đang là mục tiêu thao tác. Card **không** bọc quanh một nhóm cấu hình, một section trong dialog, hay một cụm checkbox: những thứ đó dùng section header cộng hairline (§7 Components, mục List Rows, đã có luật con tương đương cho danh sách; luật này mở rộng ra toàn app).

**The No-Nested-Card Rule (bắt buộc).** Một card không bao giờ chứa một card khác. Vi phạm thật đang có trong code (`apps/desktop/src/styles.css`, đọc tại `a00af07`): `.provider-card` và `.settings-panel` dùng chung một rule vẽ khung (viền, bo góc, nền `--surface-drawer`, dòng 5534), nên **mọi** section trong Settings, kể cả "Language" và "Local" ở tab General vốn không cần ranh giới, đều tự động thành một card xếp chồng. Bên trong tab AI Providers, `.settings-control-strip` (dòng 5232) và `.provider-task-toggle` (dòng 5701) vẽ thêm khung riêng của chính chúng, cho ra card trong card trong card: `.settings-shell` (khung dialog) > section AI Providers > `.provider-card--detail` > các cụm chip có viền bên trong. Đây là hiện trạng cần sửa, không phải mẫu để noi theo.
- **Đối chứng làm đúng, cùng file:** `.node-details-section` (`styles.css:3763`) chỉ có `display: grid; gap: 8px`, không viền riêng; các nhóm TAGS, PALETTE, SOURCE, HISTORY trong popover chi tiết node (`docs/research/art-direction/current/04-node-details-dark.jpg`) đứng cạnh nhau bằng khoảng cách và nhãn hoa, không bằng khung.

**The One Density Rule.** Mỗi màn hình có một mật độ thông tin đã định trước khi thêm nội dung, không phải "thêm cho tới khi hết chỗ". Đặc tả bố cục từng surface (`docs/design/layout-spec.md`) phải nói rõ số mục tối đa hiển thị mặc định và cái gì chuyển vào "Nâng cao" hoặc một disclosure. Tab AI Providers hiện vi phạm rõ nhất: routing strip, danh sách provider, form chi tiết, hai nhóm checkbox (Tagging, Canvas generation), Routing preview, Secrets, Usage và Onboarding cùng hiện trên một màn không cuộn dừng (R1 P2-5, `crop-e-settings-hierarchy.jpg`).

**The Plain-Language Rule.** Copy hướng tới người không đọc code: không lộ id nội bộ, tên model thô không kèm giải thích, số liệu kỹ thuật (token, ms, byte) không kèm đơn vị người hiểu được, hay JSON. Vi phạm thật: dock Kira hiện `~{tokenEstimate} tokens` (`main.tsx:10324`) không giải thích gì thêm; đổi thành một chỉ báo còn dư chỗ hay không (chữ, không phải số kỹ thuật trần). Ngoại lệ: một giá trị mà chính người dùng phải copy hay đối chiếu ra ngoài app (đường dẫn cài extension, mã lỗi để báo bug) được giữ nguyên dạng kỹ thuật nhưng phải có nhãn nói rõ đó là gì.

### Ví dụ đúng và sai

| | Sai (hiện trạng) | Đúng |
|---|---|---|
| Nhóm section trong dialog | Mỗi section một card xếp chồng (`.settings-panel`, Settings mọi tab) | Section header (`##`-weight) cộng `1px` hairline phía trên, không nền riêng, giống `.node-details-section` |
| Panel thuộc tính, tham chiếu Figma UI3 | không áp dụng | "The design panel in UI3 has been reorganized to group controls more logically" theo tác vụ, không theo loại control; property label có thể bật/tắt để gọn hơn cho người quen việc ("Turn on labels to quickly understand what each control does, or turn them off"), theo Figma Blog, *Behind our Redesign: UI3*, 26/6/2024, Ryhan Hassan, Joel Miller, KC Oh. Panel dùng khoảng nổi và toolbar mảnh ở đáy canvas thay vì đóng khung, đúng tinh thần luật này |
| Checkbox trong nhóm | Mỗi checkbox một chip có viền (`.provider-task-toggle`), đọc như nút | Checkbox chuẩn cộng nhãn, xếp hàng bằng grid, không viền riêng từng ô |
| Số liệu kỹ thuật | `~420 tokens` trần trong dock composer | "Còn dư chỗ" / "Gần đầy" bằng chữ, số kỹ thuật chỉ hiện khi bấm xem chi tiết |
| Card thật (giữ nguyên) | không áp dụng | Node trên canvas, ảnh trong Thư viện, mục ChangeSet đang mở: đây là vật thể, card đúng chỗ |

## 6. Elevation

Structure is flat. KIRA conveys the depth of *surfaces* through tonal layering (base, surface-1, surface-2) and hairline borders, not drop shadows. Shadow is reserved for three things: controls that have a fill (a paper sheet or an ink block sits *on* the surface), floating chrome above the canvas, and canvas nodes. *(đổi 2026-09-15: thêm bóng giấy cho nút có nền, R2 §E; cấu trúc và danh sách vẫn phẳng.)*

### Shadow Vocabulary
- **Paper lift, rest** (secondary and danger): `0 1px 0 var(--lift1), 0 3px 8px -2px var(--lift2)` (S:132). A 1px contact edge plus a short blurred cast offset downward: always offset, never a halo.
- **Paper lift, hover:** `0 2px 0 var(--lift1), 0 8px 14px -4px var(--lift2-h)` with `translateY(-1px)` (S:133).
- **Ink lift, rest** (primary): `inset 0 -1px 0 var(--paper-edge), 0 1px 0 var(--lift1), 0 4px 10px -3px var(--lift2)` (S:129). The inset bottom edge reads as the thickness of the sheet.
- **Ink lift, hover:** `inset 0 -1px 0 var(--paper-edge), 0 2px 0 var(--lift1), 0 9px 16px -5px var(--lift2-h)` with `translateY(-1px)` (S:130).
- **Pressed** (any filled control): `box-shadow: none` with `translateY(0.5px)`: the sheet is pressed flat onto the surface (S:131, S:134).
- **Floating chrome plate** (tool rail, view switcher, zoom, Kira button). Dark: `inset 0 1px 0 rgb(255 255 255 / 0.06), 0 2px 4px rgb(0 0 0 / 0.45), 0 14px 34px -8px rgb(0 0 0 / 0.65)`; light: `inset 0 0 0 1px rgb(35 33 29 / 0.06), 0 2px 4px rgb(35 33 29 / 0.1), 0 14px 30px -10px rgb(35 33 29 / 0.32)` (rail S:251-252; smaller plates use a `0 12px 28px -8px` far layer, S:371-372).
- **Panel shadow** (`--panel-shadow`, dark `0 20px 70px rgb(0 0 0 / 0.28)`, light `0 12px 32px rgb(35 33 29 / 0.1)`): large floating panels above canvas content.
- **Node rest / hover** (`--node-shadow-rest` / `--node-shadow-hover`, dark `0 6px 20px rgb(0 0 0 / 0.22)` / `0 12px 34px rgb(0 0 0 / 0.3)`): canvas nodes only.

`--lift1`, `--lift2`, `--lift2-h` and `--paper-edge` are the `control-lift-near`, `control-lift-far`, `control-lift-far-hover` and `control-paper-edge` values in the front matter (dark and light differ).

### Named Rules
**The Flat-List Rule.** Settings and utility lists (providers, extensions, tags) never use shadows. Depth comes from the `--surface-drawer` background plus a single `--border-soft` outline around the whole list; individual rows are separated by a 1px top border, not by floating as separate shadowed cards. The buttons *inside* a row still carry their own paper lift.

**The Material-On-Chrome Rule.** Translucency and `backdrop-filter` live only on floating chrome that sits over the canvas (rail, view switcher, zoom, Kira button). Panels, dialogs, popovers and every button stay opaque. No glass as decoration. *(giữ nguyên luật cũ, nêu thành luật riêng 2026-09-15.)*

## 7. Components

Values in this section come from the chosen specimen. `S:<n>` means line *n* of `docs/research/art-direction/v2/controls-v2.html`; `R2 §x` is `docs/research/2026-09-14-art-direction-controls-v2.md`; `R1` is `docs/research/2026-09-14-art-direction.md`. The implementation recipe (full state CSS, icon structure, how to measure) is the project skill `.claude/skills/kira-controls/`.

### Buttons

Four tiers, each a different *material*, not a different tint *(đổi 2026-09-15: bỏ primary tint `--glass-active` và quiet nền 3,5% trắng, R2 §E)*:

| Tier | Material | Rest | Hover | Pressed | Selected | Disabled |
|---|---|---|---|---|---|---|
| **Primary** | ink block | fill `control-primary` (dark `#f4f1ea`, light `#23211d`), text `control-on-primary` (`#0f1517` / `#f7f5f0`), ink lift | fill `-hover` (`#fffdf7` / `#35322c`), lift `-1px` | fill `-pressed` (`#dcd8cf` / `#12110f`), `+0.5px`, no shadow | n/a | transparent, `1px dashed` `control-disabled-edge`, text `--text-muted` |
| **Secondary** | paper sheet | fill `control-sheet` (`#1c2426` / `#fbfaf7`), `1px` border `control-sheet-edge`, text `--text-main`, paper lift | fill `-hover` (`#222b2d` / `#ffffff`), lift `-1px` | fill `-pressed` (`#141b1d` / `#eceae4`), no shadow | **ink outline**: sheet fill, `inset 0 0 0 1.5px var(--text-main)` | as primary |
| **Quiet** | text only | no fill, text `--text-soft` | **paper patch** `control-patch` (6.5% white / 6.5% ink), text `--text-main` | patch `-pressed` (3.5% white / 10% ink) | **ink underline**: `inset 0 -2px 0 var(--text-main)`, text `--text-main`, radius `8px 8px 2px 2px` | text `--text-muted`, no border |
| **Danger** | paper sheet | as secondary, text `control-danger-text` (`#e59587` / `#8a4035`), border `control-danger-edge` | as secondary | as secondary | n/a | as primary |

Sources: S:115-142. Contrast measured on rendered pixels, 34 cells per sheet: lowest text **5.92:1** dark and **5.25:1** light (primary disabled), lowest focus ring 8.24:1 / 3.59:1, 0 failures (R2 §C).

- **Sizes:** Regular `32px` high, `0 12px` padding, 6px gap, `8px` radius (`--radius-3`), 16px glyph at stroke 1.8. Compact `26px`, `0 9px`, 4px gap, `6px` radius (`--radius-2`), 13px glyph at stroke 2. Icon-only is square at the same heights (S:52-58). *(đổi 2026-09-15: radius Regular 6px thành 8px, R2 §E.)*
- **Focus:** `outline: 2px solid var(--accent-cyan); outline-offset: 2px` on `:focus-visible`, for every button and rail tool (S:59, S:229). Replaces the 3px 38% `--focus-ring`, which measured 2.37:1 dark and 1.76:1 light. *(đổi 2026-09-15: R1 P1-2.)*
- **Hover and press feel:** filled controls lift `1px` on hover and press `0.5px` flat; quiet controls never move. Color, fill and shadow transition over `120ms ease`; `transform` over `140ms cubic-bezier(0.16, 1, 0.3, 1)` (the `--ease-out-soft` curve, no overshoot). `prefers-reduced-motion: reduce` removes the transitions (S:53, S:61). No spring, no bounce on any control. *(đổi 2026-09-15: thêm nhấc 1px; bỏ 160ms.)*
- **One hover dialect:** hover never inverts a control into a solid accent or ink block. *(đổi 2026-09-15: R1 P1-3, `.icon-button:hover` đảo sang khối teal đặc.)*

**The One Primary Rule (mandatory).** A view has at most **one** primary button: the single committing action of the dialog, panel section or screen. In dark mode the primary is the brightest block on screen, so two of them compete and three are louder than the tinted round-1 system ever was. Everything else is secondary, quiet or danger. Lists never repeat a primary per row. *(đổi 2026-09-15: từ "nên" thành bắt buộc, rủi ro chính của Ink & Paper, R2 §F.)*

### Tool rail and floating chrome
- **Rail plate:** radius `16px`, padding `6px`, fill `rail-plate` (dark `rgb(29 37 39 / 0.95)`, light `rgb(251 250 247 / 0.96)`), `backdrop-filter: blur(24px) saturate(1.35)`, floating chrome plate shadow (S:225, S:251-252). *(đổi 2026-09-15: rail bo 16px.)*
- **Groups:** Select | create node (Image, Palette, Idea, Note, Frame) | connect (Diagram, Link), split by a `1px × 24px` `--separator-hairline` with `6px` margin (S:253, S:516-520). The Kira button and zoom are separate plates beside the rail (S:626-627).
- **Tool:** `44px` square, radius `12px` (`--radius-4`), icon `28px` (S:254-255). Zoom tools are `32px` with `20px` icons (S:365-366).
- **Tool states:** hover gives the tool a `--glass-hover` patch and **picks the sticker up**: icon `translateY(-3px) rotate(-4deg)` with a deeper drop shadow (S:257-259). Pressed: icon `translateY(1px) scale(0.94)` (S:260). The current tool sits on an **ink chip** (`rail-chip`: dark `#f4f1ea`, light `#23211d`) with `0 1px 0 rgb(0 0 0 / 0.35), 0 4px 10px -4px rgb(0 0 0 / 0.5)` (S:262-264). *(đổi 2026-09-15: tool đang dùng là chip mực, không phải ô tint teal.)*
- **Tooltip:** above the tool, `26px` high, `0 9px`, 11px / 560, fill `tooltip-bg` with `tooltip-text`, shortcut in `tooltip-kbd` at weight 500 (S:230-233). Name plus shortcut, always.
- **View switcher and zoom plates:** radius `12px`, padding `4px`, same plate material; view options are quiet Compact buttons and the current view takes the ink underline (S:357-366, S:619). Kira button plate: `52px` (S:375).

### Icons
- **Rail icons** (12, drawn in-house on a 24 grid): each SVG part carries a class so one geometry serves every theme and the monochrome option: `bd` body with a vertical gradient (`--b-hi` to `--b-lo`) and an ink cut-line, `k-*` colored details (`k-sky`, `k-sun`, `k-leaf`, `k-rose`, `k-amb`, `k-acc`, `k-fold`, `k-glass`), `ln`/`ln2` interior lines, `lxo`/`lxi` two-layer strokes for lines that sit directly on the plate (dark outer, light core), a radial specular highlight (S:187-198, S:207-216, S:490-511). Measured icon contrast (80th percentile of icon pixels against the tool background): lowest **6.56:1** dark, **4.48:1** light; on the worst background under the plate (a pure white or black image) **5.34:1** / **4.30:1** (R2 §C).
- **UI glyphs:** Lucide, line only, `currentColor`, no gradient, no fill color, no shadow.
- **Monochrome rail option:** same SVGs, the `k-*` and body variables are remapped to neutral tones; must still clear 3:1 on the worst background.

### List Rows (the canonical pattern for Providers, Extensions, and similar status lists)
- **Container:** single `border: 1px solid var(--border-soft)`, `border-radius: var(--radius-2)`, `background: var(--surface-drawer)`, `overflow: hidden`: one continuous list, not N separate cards.
- **Row:** `grid-template-columns: minmax(0,1fr) auto`, `padding: 10px 12px`, `border-top: 1px solid var(--border-soft)` (omitted on the first row).
- **Row content (left):** stacked `strong` (title, `--text-main`, `--text-small`) + `small`/`em` (status detail, `--text-muted`, `--text-small` 11px). *(đổi 2026-09-15: bỏ `--text-faint`, token này không tồn tại.)*
- **Row action (right):** exactly one main action per row, drawn as a **secondary** button (or a chevron affordance). A second, lower-priority action is an icon-only quiet button. The view's single primary, if any, lives outside the list. *(đổi 2026-09-15: "one primary action per row" chọi với One Primary Rule; hàng dùng secondary.)*
- **Status color:** driven by a `data-status` attribute on the row (`connected`/`installed` → `--accent-cyan` text; `key_missing`/`needs-attention` → `--accent-amber` text). Status is always paired with a text word, never color alone.

### Cards (onboarding only)
- **Corner Style:** 10px radius.
- **Background:** `color-mix(in srgb, var(--surface-1), transparent 18%)`.
- **Border:** `1px solid var(--border-soft)`.
- **Use:** first-run onboarding overlay only, where a single committing action needs visual weight. Not for steady-state settings lists.

### Chips
- **Style:** `background: var(--glass-hover)`, pill radius (999px), `color: var(--text-soft)`, `--text-small`. Used for compact inline status ("Providers 2/4").

## 8. Do's and Don'ts

### Do:
- **Do** render lists of similar connectable things (browser extensions, AI providers) as one hairline-divided list (`border-soft` container + `border-top` rows), matching the existing Providers list pattern.
- **Do** lead every row with status in words (`installed`, `not detected in Chrome`), colored with the One Accent Rule (`--accent-cyan` for good, `--accent-amber` for attention).
- **Do** give each row exactly one main action as a secondary button; demote any other action to a quiet icon button.
- **Do** keep exactly one primary button per view; if a second action feels equally important, one of them is actually secondary.
- **Do** show a control's selected state in ink: ink outline on a secondary, ink underline on a quiet button or tab, ink chip on a rail tool.
- **Do** keep the "Refresh / detect installed extensions" action as a single quiet icon button in the list header, not a grid item that looks like a third extension target.
- **Do** reset `background`, `border` and `font` on every `<button>` so no browser default (grey ButtonFace) ever renders (R1 P1-3).

### Don't:
- **Don't** render extensions/providers/similar targets as a 2-column grid of identical boxed cards with icon + heading + two stacked buttons: reads as templated AI-dashboard filler, per PRODUCT.md's anti-references.
- **Don't** build a multi-step wizard (progress bar, "Step 2 of 5", large illustrations) for what is a two-item utility list.
- **Don't** use gradient text, glassmorphism as decoration, or a hero-metric tile anywhere.
- **Don't** signal status by color alone; always pair with a text word.
- **Don't** give two buttons in the same row equal visual weight when one is clearly the main action.
- **Don't** fill or tint a button, tab or tool with teal to mean "primary" or "selected."
- **Don't** put color, gradient or shadow on a UI glyph; that treatment belongs to rail icons only.
- **Don't** mix icon families inside one plate (e.g. Lucide zoom icons beside rail stickers).
- **Don't** add spring or overshoot easing to a control; spring is for dragging on the canvas only.
