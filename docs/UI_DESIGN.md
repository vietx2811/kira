# UI Design System

---

## Visual direction

**"Dark Research Tool"** — dense, information-rich, minimal chrome.

Inspired by: **Linear**, **Arc Browser**, **Raycast**, **Perplexity**

- Everything is keyboard-accessible
- Animations are purposeful, not decorative
- Color carries taxonomy meaning — each axis has its own hue
- The content (images) is always the hero

---

## Color palette

Built on **OKLCH** (perceptually uniform, matches Tailwind v4).

```css
:root {
  /* Backgrounds */
  --bg-base:      oklch(8% 0 0);           /* app background */
  --bg-surface:   oklch(12% 0 0);          /* panels, sidebars */
  --bg-elevated:  oklch(16% 0.005 265);    /* cards, dropdowns */
  --bg-overlay:   oklch(20% 0.005 265);    /* hover states */

  /* Borders */
  --border-subtle:  oklch(18% 0.005 265);
  --border-default: oklch(24% 0.008 265);
  --border-strong:  oklch(35% 0.01 265);

  /* Text */
  --text-primary:   oklch(92% 0 0);
  --text-secondary: oklch(65% 0 0);
  --text-muted:     oklch(42% 0 0);
  --text-disabled:  oklch(28% 0 0);

  /* Accent */
  --accent:         oklch(68% 0.18 265);   /* blue-violet */
  --accent-hover:   oklch(72% 0.18 265);
  --accent-muted:   oklch(30% 0.08 265);

  /* Status */
  --success:  oklch(68% 0.18 150);
  --warning:  oklch(78% 0.18 80);
  --error:    oklch(62% 0.22 25);
}
```

### Taxonomy axis colors

Each axis gets a distinct hue, auto-generated from OKLCH color wheel:

```typescript
const AXIS_HUES = {
  mood:    265,   // blue-violet
  style:   150,   // green
  color:   30,    // orange
  subject: 330,   // pink-red
  project: 200,   // cyan
}

// Custom axes auto-assigned from remaining hues: 60, 90, 180, 240, 300...
function getAxisColor(hue: number): string {
  return `oklch(68% 0.18 ${hue})`
}
```

---

## Typography

```css
--font-sans: 'Geist', 'Inter', system-ui;
--font-mono: 'Geist Mono', 'JetBrains Mono', monospace;

/* Scale */
--text-xs:   11px / 1.4;
--text-sm:   13px / 1.5;
--text-base: 14px / 1.6;
--text-lg:   16px / 1.5;
--text-xl:   20px / 1.4;
--text-2xl:  24px / 1.3;
```

---

## Layout

### Main window

```
┌────────────────────────────────────────────────────────┐
│  ← Title bar (drag region)                     ⊟ ⊠ ⊡  │
├───────┬────────────────────────────────────────────────┤
│       │  ┌─── Toolbar ──────────────────────────────┐  │
│ Side  │  │  [Grid] [Graph] [Galaxy] [Axis]   [T] ⌘K │  │
│ bar   │  └──────────────────────────────────────────┘  │
│       │                                                  │
│ Axes  │              View Area                          │
│  &    │         (Grid / Graph / Galaxy / Axis)          │
│ Tags  │                                                  │
│       │                                                  │
│ Stats │                                                  │
└───────┴────────────────────────────────────────────────┘
```

- Sidebar: 220px, collapsible
- Toolbar: 44px height
- View area: fills remaining space

### Drop zone window

```
┌─────────────┐
│             │
│  ╔═══════╗  │
│  ║  ↓↓↓  ║  │   200×200px
│  ║ DROP  ║  │   always-on-top
│  ╚═══════╝  │   transparent bg
│             │   glow on drag-hover
└─────────────┘
```

---

## Components

### ImageCard (Grid view)

```
┌──────────────────────┐
│                      │
│      [image]         │  ← 16:9 or original ratio
│                      │
├──────────────────────┤
│ ● ● ●                │  ← dominant color swatches
│ minimalist · calm    │  ← taxonomy badges (truncated)
│ 2 more tags...       │
└──────────────────────┘

Hover state:
- border highlights with accent color
- [T] taxonomy button appears top-right
- source URL shows at bottom
```

### TaxonomyBadge

```
[ mood · calm ]     ← filled, axis hue bg
[ style · minimal ] ← filled
```

Small pill, 11px, axis-colored background at 20% opacity, text at 80% opacity.

### TaxonomyPanel (cmdk)

```
┌────────────────────────────────┐
│ 🔍  Type to find or create...  │
├────────────────────────────────┤
│  MOOD                          │
│  ○ calm          3 images      │
│  ○ energetic     7 images      │
│  ● melancholic   ← selected    │
├────────────────────────────────┤
│  STYLE                         │
│  ○ minimalist   12 images      │
│  ○ brutalist     1 image       │
├────────────────────────────────┤
│  + Create "dreamy" in Mood     │  ← auto-suggest new tag
└────────────────────────────────┘
```

Opens as centered overlay with backdrop blur. Keyboard: ↑↓ navigate, Enter assign, Esc close.

### Graph Node (reagraph custom)

```
    ┌──────────┐
   /│          │\
  / │  [thumb] │ \   ← Three.js PlaneGeometry with image texture
 /  │          │  \
│   └──────────┘   │  ← glow ring = dominant color of image
 \  ○ ○ ○ ● ○  /   ← tag dot indicators per axis (colored)
  \            /
   \  ↓ size  /     ← node size = number of tags assigned
```

### Sidebar

```
┌─────────────────────┐
│  MOOD               │  ← axis header (collapsible)
│  · calm        3    │  ← tag row, click to filter
│  · energetic   7    │
│  · melancholic 1    │
│  + Add tag          │
├─────────────────────┤
│  STYLE              │
│  · minimalist  12   │
│  · brutalist    1   │
├─────────────────────┤
│  + New axis         │
└─────────────────────┘
```

Active filters highlighted. Click tag to toggle filter. Multiple filters = AND logic.

---

## Animations (Motion v12)

### View transitions: Grid ↔ Graph ↔ Galaxy

```typescript
// Each image card has a stable layoutId
<motion.div
  layoutId={`image-${image.id}`}
  layout
  transition={{ type: "spring", stiffness: 300, damping: 30 }}
>
  <ImageCard image={image} />
</motion.div>
```

Cards physically move to their new positions when switching views.

### Drop zone pulse

```typescript
<motion.div
  animate={isDragOver ? {
    scale: [1, 1.05, 1],
    boxShadow: [`0 0 0px var(--accent)`, `0 0 40px var(--accent)`, `0 0 20px var(--accent)`]
  } : {}}
  transition={{ repeat: Infinity, duration: 1.2 }}
/>
```

### Taxonomy badge appear

```typescript
<motion.span
  initial={{ opacity: 0, scale: 0.8 }}
  animate={{ opacity: 1, scale: 1 }}
  exit={{ opacity: 0, scale: 0.8 }}
  transition={{ type: "spring", stiffness: 400, damping: 25 }}
/>
```

---

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `T` | Open taxonomy panel for selected image |
| `⌘K` | Open command palette |
| `1` | Switch to Grid view |
| `2` | Switch to Graph view |
| `3` | Switch to Galaxy view |
| `4` | Switch to Axis view |
| `⌘,` | Open settings |
| `Delete` | Remove selected images |
| `⌘Z` | Undo last tag assignment |
| `Escape` | Close panel / deselect |
| `Space` | Preview full image |
| `↑↓←→` | Navigate grid |

---

## Responsive considerations

App is desktop-only (1024px minimum). No mobile layout needed.

Minimum window size: 900×600px.

The drop zone window is a separate always-on-top mini window — not part of the main layout.

---

## Icon system

Use **Lucide React** (MIT, consistent with shadcn/ui):

```typescript
import { Grid3x3, Network, Globe, Axis3d } from 'lucide-react'
// Grid, Graph, Galaxy, Axis view icons
```

Custom icons (SVG inline) only for: app logo, drop zone indicator, taxonomy axis icons.
