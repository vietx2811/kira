# Tech Stack Deep Research

> Historical research note. The current implementation source of truth is `PROJECT_PLAN.md`, `ARCHITECTURE.md`, and `DATABASE.md`. Some options below describe earlier grid/taxonomy/WebSocket concepts that were not carried into the current standalone KIRA desktop architecture.

> Research conducted: June 2026  
> Purpose: Evaluate and select technologies for Visual Research Board

---

## Summary of decisions

| Layer | Chosen | Rejected | Reason |
|-------|--------|----------|--------|
| Desktop shell | Tauri 2.0 | Electron | 10MB vs 180MB bundle, lower RAM, Rust backend |
| Graph viz | reagraph | Cosmograph | Cosmograph is CC-BY-NC (non-commercial only); reagraph MIT + image texture support |
| Extension framework | WXT | Plasmo | Plasmo in maintenance mode; WXT actively maintained |
| Canvas/board | Custom (reagraph) | tldraw | tldraw requires paid license to remove watermark |
| Color extraction | colorthief v3 | color-thief-ts | color-thief-ts unmaintained for 3+ years |
| UI components | shadcn/ui + Tailwind v4 | MUI, Chakra | Ownership model, Tailwind v4 CSS-first, OKLCH |
| Animation | Motion v12 | GSAP | Motion has React 19 layout animations; GSAP is overkill |
| Auto-tagging | transformers.js + CLIP | cloud API | Local inference, no data leaves device, MIT |

---

## 1. Tauri 2.0

**Status:** Stable (released October 2024)  
**License:** MIT / Apache 2.0  
**Verdict:** ✅ Excellent fit

### Key facts
- Production-ready; 2,870+ work hours invested in v2
- Supports macOS, Windows, Linux + iOS/Android (v2 new)
- WebView native per OS (no bundled Chromium)

### Plugins used in this project

| Plugin | Version | Purpose |
|--------|---------|---------|
| `tauri-plugin-sql` | v2.3.2+ | SQLite via sqlx — images, tags, taxonomy |
| `tauri-plugin-fs` | v2.0.0+ | Local file read/write with path traversal protection |
| `tauri-plugin-websocket` | v2.0.0+ | WS server for Chrome extension bridge |

### Multi-window & System Tray
- Multi-window fully stable in v2 — drop zone + main board as separate windows
- System tray API can be controlled from JavaScript (improved over v1)
- Always-on-top floating drop zone via tray icon

### Known issues
- None significant. Rust 1.77.2+ required for `tauri-plugin-websocket`.

---

## 2. reagraph

**Status:** Production-ready (latest 4.30.8, updated 4 months ago)  
**License:** MIT ✅  
**Verdict:** ✅ Good fit with performance ceiling noted

### Technology
- Three.js + WebGL rendering
- react-three-fiber React bindings
- d3-force-3d physics simulation

### Image nodes
- Custom node geometries via react-three-fiber
- Three.js Material system supports image textures natively
- Viable for thumbnail-as-node pattern

### Performance limits (critical)

| Node count | FPS | Experience |
|------------|-----|-----------|
| < 400 | 60fps | Smooth |
| 400–2,600 | 12–28fps | Sluggish but usable |
| > 2,600 | 1–3fps | Unusable |
| > 40,000 | Crash | — |

**Mitigation strategy:** Pagination in graph view — only render current filter set (typically 50–200 images at a time). Hard cap at 500 visible nodes.

### Why not Cosmograph?
Cosmograph is significantly faster (GPU-accelerated, handles millions of nodes) but:
- License: CC-BY-NC-4.0 — free only for non-commercial use
- Commercial license required for any monetized product
- Node appearance limited to colored dots — image textures not natively supported

---

## 3. WXT (Extension Framework)

**Status:** Actively maintained, community growing  
**License:** MIT ✅  
**Verdict:** ✅ Preferred over Plasmo

### Why WXT over Plasmo
- Plasmo shows signs of entering maintenance mode (2024–2025)
- Plasmo has outdated dependencies, slower update cadence
- WXT has stronger community adoption and faster releases (2025 data)

### WXT capabilities
- Chrome MV3 fully supported
- Auto-generates `manifest.json` from source structure
- HMR for fast development iteration
- Built-in messaging (`@wxt-dev/messaging`)
- Built-in storage
- React + TypeScript first-class

### Extension → Tauri communication
Uses WebSocket on `ws://127.0.0.1:9001`:

```
Chrome (WXT content script)
  → detects image drag / right-click
  → WebSocket: { type: "image_import", imageUrl, sourceUrl, pageTitle }

Tauri Rust backend
  → downloads image via reqwest
  → creates 300px thumbnail via image crate
  → extracts dominant colors
  → stores in SQLite
  → WebSocket response: { type: "import_complete", imageId, colorSuggestions }

React frontend
  → receives Tauri event
  → opens taxonomy panel (cmdk)
```

**Security:** WebSocket bound to `127.0.0.1` only. Message schema validated on both sides.

---

## 4. shadcn/ui + Tailwind CSS v4

**Status:** Stable, fully compatible together  
**License:** MIT ✅  
**Verdict:** ✅ Excellent

### Tailwind v4 changes (vs v3)
- Config moved from `tailwind.config.js` → CSS-first (all in `.css` file)
- Color format: HSL → **OKLCH** (perceptually uniform, better for taxonomy color generation)
- `tailwindcss-animate` deprecated → use `tw-animate-css`
- Toast: deprecated → use `sonner`

### shadcn/ui v4 updates
- All components updated for Tailwind v4 + React 19
- Added `data-slot` attributes for cleaner style targeting
- Removed legacy `forwardRef` patterns
- New default style: "new-york" (preferred for this project)

---

## 5. Motion v12 (formerly Framer Motion)

**Status:** Stable, rebranded mid-2025  
**License:** MIT ✅  
**Verdict:** ✅ Excellent

### Package change
```
// Old
import { motion } from 'framer-motion'

// New (v12)
import { motion } from 'motion/react'
```

### React 19 compatibility
- Full support for concurrent rendering
- Removed legacy `forwardRef` wrappers

### Layout animations — key feature for this app
- `layout` prop animates position/size changes automatically
- New: `layout="x"` / `layout="y"` for axis-locked animations
- New: `layoutAnchor` for custom anchor points
- **Use case:** Images smoothly animate positions when switching Grid ↔ Graph ↔ Galaxy

---

## 6. colorthief v3

**Status:** Actively maintained  
**License:** MIT ✅  
**Verdict:** ✅ Preferred

### vs color-thief-ts
`color-thief-ts` has not been updated in 3+ years — avoid.

### Features (v3)
- Dominant color extraction
- Full palette extraction
- Semantic swatch classification
- Web Worker support (non-blocking)
- Progressive extraction (incremental updates)
- OKLCH quantization (matches Tailwind v4 color system)
- Works in browser and Node.js

### Cross-origin handling
- CORS headers required for remote images
- **Solution:** Tauri Rust backend downloads images via `reqwest` (server-side, bypasses CORS entirely)
- Color extraction runs on locally cached thumbnails — no CORS issues

---

## 7. transformers.js + CLIP

**Status:** v4 available, production-ready  
**License:** MIT ✅  
**Verdict:** ✅ Excellent for local AI inference

### CLIP for auto-tagging
1. Load `Xenova/clip-vit-base-patch16` model (~300MB, cached after first download)
2. Generate embedding for each uploaded image
3. Pre-compute embeddings for taxonomy label text ("minimalist", "warm", "energetic"...)
4. Cosine similarity → top-N tag suggestions

### Performance
| Backend | Speed per image |
|---------|----------------|
| WASM | 2–5 seconds |
| WebGPU | 200–500ms |

WebGPU is the default when available (Chrome 113+).

### Caching strategy
- Model files cached via Tauri `tauri-plugin-fs` to `~/.visual-research-board/models/`
- Progress indicator on first download
- App fully functional without CLIP (auto-tag is optional enhancement)

---

## 8. cmdk

**Status:** Stable  
**License:** MIT ✅  
**Verdict:** ✅ Excellent for taxonomy input

### Usage pattern
- Trigger: `T` key when an image is selected or just dropped
- Groups taxonomy axes: Mood / Style / Color / Subject / Project / Custom
- Type to filter, Enter to assign tag
- Supports nested submenus via scoping
- Headless — styled fully with Tailwind

---

## 9. AI provider onboarding and extension packaging

**Status:** Implemented in the desktop app
**Verdict:** API-key-first onboarding is the correct product shape

### Subscription vs API billing

KIRA should not ask users to "connect" a ChatGPT or Claude subscription as if it grants API entitlement.

- OpenAI states that API usage is billed separately from ChatGPT Plus, Business, Enterprise, and Edu. The app should ask for an OpenAI Platform API key, not a ChatGPT plan login.
- Anthropic states that paid Claude subscriptions and Claude Console/API billing are separate products. The app should ask for an Anthropic Console API key.
- Local model routing remains useful as fallback when remote keys or billing are unavailable.

### Providers to support

The onboarding and Settings provider workbench should make OpenAI and Anthropic primary, then expose local and compatible providers:

- OpenAI Platform
- Anthropic Console
- Gemini API
- OpenRouter
- Ollama
- LM Studio
- Custom OpenAI-compatible endpoint
- Apple Foundation Models where available

### Browser capture install path

Chrome/Chromium can load the bundled `extension/dist` with Developer mode + Load unpacked. Safari Web Extensions require a containing macOS app, so KIRA bundles a built `KIRA Safari.app` alongside the Chrome dist in the Tauri app resources.

### Product decisions

- Onboarding shows API billing truth before key entry.
- Settings can reset onboarding and detect extension install status.
- The packaged app includes both the Chrome unpacked extension dist and the Safari container app.
- Welcome.kira is a deterministic template that explains the canvas, library, AI setup, browser capture, templates, and AI node generation.
- Zero-state templates are deterministic editable boards; prompt starter generates a lightweight structured board from user text.
- Arc-menu AI node generation supports summarize, break down, synthesize, find gaps, and generate variations with selected/upstream/downstream/full-board scope.

---

## Rejected technologies

### tldraw v2/v3
- Requires Business License to remove "Made with tldraw" watermark in production
- Designed for collaborative sketching, not taxonomy-driven graph organization
- Use reagraph custom nodes instead for the board/canvas experience

### Plasmo
- Signs of maintenance mode (2024–2025)
- Outdated dependencies
- WXT is a direct drop-in replacement with better maintenance

### Cosmograph
- CC-BY-NC-4.0 license — free only for non-commercial
- Commercial license adds cost
- Image-as-node not natively supported (colored dots only)

### Electron
- Bundle size ~180MB vs Tauri ~10MB
- Higher RAM usage
- Ships bundled Chromium instead of OS WebView

---

## Risk register

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| reagraph perf >500 nodes | Medium | High | Paginate graph — only render active filter set |
| CLIP 300MB first download | High | Medium | Background download, skip-able, cached permanently |
| WebKit CSS differences (macOS) | Low | Low | Test OKLCH colors early; use CSS fallbacks |
| WXT breaking changes | Low | Medium | Pin minor version, test before upgrade |
| CORS on image capture | High | Low | Rust reqwest bypasses CORS entirely |

---

## References

- [Tauri 2.0 Release](https://v2.tauri.app/blog/tauri-20/)
- [reagraph GitHub](https://github.com/reaviz/reagraph)
- [WXT Framework](https://wxt.dev/)
- [shadcn/ui Tailwind v4](https://ui.shadcn.com/docs/tailwind-v4)
- [Motion v12 Docs](https://motion.dev/docs/react)
- [transformers.js](https://github.com/huggingface/transformers.js)
- [colorthief](https://lokeshdhakar.com/projects/color-thief/)
- [cmdk](https://github.com/pacocoursey/cmdk)
- [Extension Framework Comparison 2025](https://www.devkit.best/blog/mdx/chrome-extension-framework-comparison-2025)
- [OpenAI API Pricing FAQ](https://openai.com/api/pricing/)
- [Anthropic support: paid Claude subscriptions and API billing](https://support.claude.com/en/articles/9876003-i-have-a-paid-claude-subscription-pro-max-team-or-enterprise-plans-why-do-i-have-to-pay-separately-to-use-the-claude-api-and-console)
- [Chrome Extensions: Load an unpacked extension](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world)
- [Apple Developer: Safari web extensions](https://developer.apple.com/documentation/safariservices/safari-web-extensions)
