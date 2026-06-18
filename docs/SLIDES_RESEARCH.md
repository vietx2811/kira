# KIRA Slides — Research & Design Spec

> Goal: Auto-layout slides that are customizable, easy to export, and connect to Google Slides, Canva, PPT, PDF, and HTML.

## Implementation Status (2026-06-18)

**Phase 1 — Export story: ✅ DONE**
- PPTX export via `pptxgenjs` (dynamic import) — `slidesToPptx()`, layout-aware image/palette/diagram placement, speaker notes, 16:9. Browser downloads `.pptx`; Tauri writes via new Rust command `export_slideshow_pptx` (base64 → binary in `exports/`).
- PDF export — opens print-optimized HTML in a new window and triggers the print dialog ("Save as PDF"); falls back to HTML download if popups are blocked.
- HTML export enhanced — `@page` print CSS, scroll-snap, progress bar, and full keyboard navigation (←/→/↑/↓/Space/PageUp-Dn/Home/End/F fullscreen/P print) via `slideDeckNavScript()`.
- Export dropdown menu in `SlideshowView`: PowerPoint · PDF · HTML · Google Slides · Canva. Google Slides/Canva open the destination and export the `.pptx` for import/upload.

**Phase 2 — Customization: ✅ DONE**
- `SlidesConfig` data model (`template`, `order`, per-slide `customizations`) persisted in the project snapshot (`normalizeSlidesConfig`, threaded through `toProjectSnapshot`/`applyProjectSnapshot`/`isProjectSnapshot`).
- `SlideCustomizer` panel (gear toggle): per-slide layout override, hide/show, reorder (move earlier/later), reset order, live "N/M shown" count.
- Deck template selector + deck-wide layout mode selector in the controls bar.
- `applySlidesConfig()` applies overrides/hide/reorder; exports honor the same config.

**Phase 3 — Deep OAuth/SDK integrations: deferred (out of scope)**
- Google Slides API (OAuth/PKCE) and Canva Apps SDK remain future work — they need external developer accounts. The PPTX-import path covers both today with zero infrastructure.

---

---

## 1. What Currently Exists

### Slide generation
- `buildSlideLayouts()` — auto-assembles slides from ideas + linked references
- Slide types: `cover`, `concept`, `moodboard`
- Auto layouts per slide: `focus`, `grid`, `stack`, `palette`, `diagram`, `moodboard`
- Layout resolution: `resolveSlideAutoLayout()` picks layout based on idea status, reference count, relation mix, palette availability
- Deck templates: `Minimal`, `Editorial`, `Moodboard Grid`, `Timeline` (auto-detected)
- Speaker notes: generated per slide as `speakerNote` field

### Slideshow UI
- Rail: numbered text list (no visual thumbnails)
- Layout mode selector: global override (auto / focus / grid / stack / palette / diagram)
- Keyboard navigation: ← →, Space (play/pause), Escape (exit fullscreen)
- Presenter mode: Tauri `setFullscreen(true)`

### Export
| Format | Status |
|--------|--------|
| HTML (standalone file) | ✅ Works — save to disk via Tauri, or download in browser |
| Markdown | ✅ Works — Outline view only |
| PPTX | ❌ Not implemented |
| PDF | ❌ Not implemented |
| Google Slides | ❌ Not implemented |
| Canva | ❌ Not implemented |

### What's missing for UX quality
- No per-slide customization (reorder, hide, override layout, edit text)
- Rail shows only text — no thumbnail preview
- No slide deck title editing
- No template selector (currently auto-detected only)
- Export menu is a single button — no format choice

---

## 2. Export Path Research

### 2A. HTML (already works — polish needed)

Current implementation in `slideLayoutsToHtml()` is functional but basic.

**Improvements needed:**
- Add `@media print` CSS for PDF printing fallback
- Add slide-by-slide keyboard navigation via JS in the exported HTML
- Embed images as base64 (currently they reference thumbnail data URIs which may be lost)
- Use project accent color in the exported theme (hardcoded `#0d0f0e` today)

**Effort**: Small (1–2 days)

---

### 2B. PPT / PPTX

**Recommended library**: [`pptxgenjs`](https://github.com/gitbrent/PptxGenJS) (MIT, ~16K stars, pure JS, runs client-side in Tauri)

```
pnpm add pptxgenjs
```

**How it works:**
```ts
import pptxgen from 'pptxgenjs'

const prs = new pptxgen()
prs.layout = 'LAYOUT_WIDE' // 16:9

for (const slide of slides) {
  const s = prs.addSlide()
  s.background = { color: '0D0F0E' }
  s.addText(slide.title, { x: 0.5, y: 1.2, w: 8, h: 1, fontSize: 32, bold: true, color: 'F1EEE7' })
  s.addText(slide.summary, { x: 0.5, y: 2.5, w: 8, h: 2.5, fontSize: 16, color: 'C9C8BD' })
  
  // Embed thumbnail images as base64
  for (const [i, ref] of slide.references.entries()) {
    if (ref.thumb) {
      s.addImage({ data: ref.thumb, x: 9, y: 0.5 + i * 2.5, w: 2.8, h: 2 })
    }
  }
  
  // Speaker notes
  s.addNotes(slide.speakerNote)
}

prs.writeFile({ fileName: 'KIRA-Slides.pptx' })
```

**Layout mapping** (SlideLayout → PPTX positioning):
| KIRA layout | PPTX approach |
|-------------|---------------|
| `focus` | Single hero image right, title+text left |
| `grid` | 2×2 image grid right half, text left |
| `stack` | Images stacked vertically right column |
| `palette` | Color swatch strip below title |
| `diagram` | Placeholder box with diagram title |
| `cover` | Full-bleed hero image behind title |
| `moodboard` | 3×4 image grid, minimal text |

**Google Slides import**: PPTX files import natively into Google Slides via `File → Import slides` or drag-drop onto `slides.google.com`.

**Canva import**: Canva natively imports PPTX via `Upload` → `.pptx`. All text, images, layout structure preserved.

**Effort**: Medium (3–4 days)

---

### 2C. PDF

**Option 1 (recommended — zero dependencies)**: Print CSS in HTML export

Add to `slideLayoutsToHtml()`:
```css
@page { size: 16in 9in; margin: 0; }
@media print {
  .slideshow-rail { display: none; }
  .slide { page-break-after: always; width: 100vw; height: 100vh; }
}
```
User: **File → Print → Save as PDF** (Cmd+P on Mac, Ctrl+P on Windows). Works in both browser and Tauri.

**Option 2 (native via Tauri)**: `WebviewWindow.print()` or `WebviewWindow.printToPDF()` 

Tauri v2 exposes `getCurrentWindow().print()` which triggers the native print dialog. With `@media print` CSS, this becomes a direct PDF export button:

```ts
async function exportSlideshowPdf() {
  // Open the HTML in a hidden webview, then print to PDF
  const html = slideLayoutsToHtml(slides, metadata)
  const win = new WebviewWindow('pdf-export', { url: ..., visible: false })
  await win.print() // triggers native save-PDF dialog
}
```

Alternatively: open the exported HTML file in the system browser, user Cmd+P → Save as PDF. Simple and works everywhere.

**Effort**: Small (1 day) for print CSS approach

---

### 2D. Google Slides

**Approach 1 (simplest, no OAuth needed)**: PPTX → Google Slides import

Generate the PPTX (see 2B), then open a browser link:
```
https://slides.google.com/upload
```
User drag-drops the .pptx file. Google Slides converts it automatically. Near-identical fidelity for text, images, and basic layouts.

**Approach 2 (deep integration, requires OAuth)**: Google Slides API

1. Register a Google Cloud project + OAuth 2.0 client (requires Google Cloud Console)
2. User signs in with Google → KIRA gets `drive` + `slides` OAuth tokens
3. Use `gapi` or fetch to call `presentations.create()` + `presentations.batchUpdate()`
4. Each slide becomes a series of `insertText`, `insertImage`, `createShape` requests

**Requirements for Approach 2:**
- Google OAuth client ID (registered app)
- Backend to store tokens securely — OR use PKCE flow (no backend needed)
- Scope: `https://www.googleapis.com/auth/presentations`

**Recommendation**: Implement Approach 1 first (zero infrastructure, works today). Add Approach 2 as a future "Connect to Google" feature once auth infrastructure is in place.

**Effort**: Approach 1 = trivial (link + copy instructions). Approach 2 = Large (1–2 weeks, needs Google Cloud setup).

---

### 2E. Canva

**How Canva import works:**
- Canva Pro/Teams supports PPTX import
- `canva.com` → `Create a design` → `Upload a file` → `.pptx`
- Or: `File → Upload` → select PPTX → "Convert to Canva" → all slides imported with text and images

**Future: Canva Apps SDK** (requires Canva Developer account):
- Build a Canva App that lets users push slides from KIRA directly into a Canva design
- API: `canva.createDesign()`, `canva.addElement()` for each slide
- Requires approval via [developer.canva.com](https://developer.canva.com)

**Recommendation**: Near-term, export PPTX with a "How to import to Canva" tooltip. Long-term: apply for Canva App Developer access.

**Effort**: Trivial for PPTX path. Large for Canva Apps SDK.

---

## 3. Auto Layout Analysis

### Current quality
`resolveSlideAutoLayout()` at line ~11597 already makes intelligent decisions:
- Heavy reference sets → `grid` or `moodboard`
- Diagram nodes → `diagram`
- Palette nodes → `palette`
- Strong idea + single hero → `focus`
- Cover slide for first slide

### What to improve

**A. Per-slide layout override**
Currently the only customization is global `layoutMode` (forces ALL concept slides to same layout). Need per-slide override stored in a `SlideCustomization` map.

```ts
type SlideCustomization = {
  layoutOverride?: SlideLayout['layout']
  hidden?: boolean
  orderIndex?: number
  titleOverride?: string
  summaryOverride?: string
}
type SlideCustomizationMap = Record<string, SlideCustomization> // keyed by slide.id
```

**B. Slide reordering**
Currently sorted by `strengthRank` then `localeCompare`. Need drag-to-reorder in the rail with customization persisted to project state.

**C. Slide hiding**
Allow hiding slides from the deck (e.g., keep the idea but don't present it).

**D. Deck template selector**
Currently `buildSlideDeckMeta()` auto-detects one of 4 templates. Let user choose, and have each template influence the HTML/PPTX styling:
| Template | Description |
|----------|-------------|
| `Minimal` | Dark bg, large text, minimal images |
| `Editorial` | Big typography, single hero image per slide |
| `Moodboard Grid` | Image-forward, tight grid layouts |
| `Timeline` | Sequential/numbered emphasis |

---

## 4. Slide Thumbnails in Rail

Currently the rail shows: `[01] Slide title` — no visual preview.

**Option A**: CSS mini-preview using slide data
- Render a tiny 160×90px `<div>` with inline styles reflecting the slide's accent color, layout type, and number of references
- No actual thumbnail rendering, just a visual abstraction
- Effort: Small

**Option B**: Hidden canvas rendering
- Use an offscreen `<canvas>` or CSS `scale(0.12)` transform on a full-size slide element
- Shows real content at thumbnail scale
- Performance risk with many slides
- Effort: Medium

**Recommended**: Option A for now — colorful accent-tinted thumbnails with layout icon.

---

## 5. Implementation Priorities

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| P0 | PPTX export via pptxgenjs | 3–4 days | High — enables Google Slides + Canva via import |
| P0 | PDF via print CSS | 1 day | High — completes the export story |
| P1 | Per-slide layout override | 2 days | Medium — customizability |
| P1 | Slide reorder + hide | 2 days | Medium — customizability |
| P1 | Export menu (dropdown) | 0.5 day | UX polish |
| P2 | Slide thumbnails in rail | 1 day | UX |
| P2 | Deck template selector | 1 day | Customizability |
| P2 | HTML export: print CSS + keyboard nav | 1 day | Polish |
| P3 | Google Slides API (OAuth) | 1–2 weeks | Full integration |
| P3 | Canva Apps SDK | 1–2 weeks | Full integration |

---

## 6. Recommended Implementation Order

### Phase 1 — Complete the export story (1 week)
1. Add `pptxgenjs` → implement `slidesToPptx()` function
2. Add print CSS to HTML export + keyboard nav in exported HTML
3. Add export dropdown to `SlideshowView` controls:
   - HTML → save file
   - PPT → download `.pptx`
   - PDF → open HTML + print instructions
   - Google Slides → download PPT + open `slides.google.com/upload`
   - Canva → download PPT + open `canva.com`

### Phase 2 — Customization (1 week)
1. Add `SlideCustomizationMap` to `ProjectAppearance` or a new `slidesConfig` field in snapshot
2. Per-slide layout override picker (dropdown in rail or inspector when slide selected)
3. Slide reorder (drag in rail)
4. Slide hide/show toggle
5. Deck template picker in slideshow controls

### Phase 3 — Deep integrations (future)
1. Google Slides OAuth flow (PKCE, no backend needed)
2. Canva App Developer application + SDK integration

---

## 7. Data Models Needed

```ts
// Add to ProjectSnapshot
type SlidesConfig = {
  customizations: Record<string, SlideCustomization>  // slide.id → overrides
  orderOverride: string[]                              // slide.id order, empty = auto
  template: SlideDeckTemplate | 'auto'                 // 'auto' = detected
  hiddenSlideIds: Set<string>
}

type SlideCustomization = {
  layoutOverride?: SlideLayout['layout']
  titleOverride?: string
  summaryOverride?: string
  accentOverride?: string
}
```

---

## 8. PPTX Implementation Sketch

```ts
import pptxgen from 'pptxgenjs'

function slidesToPptx(slides: SlideLayout[], deckMeta: SlideDeckMeta, title: string) {
  const prs = new pptxgen()
  prs.layout = 'LAYOUT_WIDE'  // 13.33" × 7.5"
  prs.title = title

  for (const slide of slides) {
    const s = prs.addSlide()
    const bg = deckMeta.theme.background.replace('#', '')
    s.background = { color: bg }
    
    // Kicker / label
    s.addText(slide.kicker, {
      x: 0.4, y: 0.3, w: 8, h: 0.4,
      fontSize: 11, color: slide.accent.replace('#', ''), bold: false,
    })
    
    // Title
    s.addText(slide.title, {
      x: 0.4, y: 0.75, w: slide.references.length > 0 ? 5.5 : 12.5, h: 1.4,
      fontSize: 36, color: 'F1EEE7', bold: true,
    })
    
    // Summary
    s.addText(slide.summary, {
      x: 0.4, y: 2.3, w: slide.references.length > 0 ? 5.5 : 12.5, h: 3.5,
      fontSize: 16, color: 'C9C8BD', lineSpacingMultiple: 1.4,
    })
    
    // Images (right column)
    const thumbSlots = slide.layout === 'grid'
      ? [{ x: 6.2, y: 0.3, w: 6.7, h: 3.5 }, { x: 6.2, y: 3.95, w: 6.7, h: 3.25 }]
      : [{ x: 6.2, y: 0.3, w: 6.7, h: 6.9 }]
    
    for (const [i, ref] of slide.references.slice(0, 2).entries()) {
      const slot = thumbSlots[i] ?? thumbSlots[0]
      if (ref.thumb) {
        s.addImage({ data: ref.thumb, ...slot, sizing: { type: 'cover', w: slot.w, h: slot.h } })
      }
    }
    
    // Speaker notes
    if (slide.speakerNote) s.addNotes(slide.speakerNote)
  }
  
  return prs
}

// Usage:
async function exportPptx() {
  const prs = slidesToPptx(slides, deckMeta, projectMetadata.title)
  await prs.writeFile({ fileName: `${projectMetadata.title || 'KIRA-Slides'}.pptx` })
}
```

---

*Research completed: 2026-06-18*  
*Author: KIRA design system*
