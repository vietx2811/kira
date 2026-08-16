# Product

## Register

product

## Users

Individuals doing visual research and idea development — art directors, brand strategists, editorial/creative people — who collect references and turn them into connected ideas, outlines, and presentations. They work locally on macOS, often in long focused sessions, moving between a reference canvas, 3D view, slides, and outline. Browser capture (Chrome/Safari extension) is a secondary, occasional workflow: grab an image or page from the browser, send it into a KIRA node without breaking focus.

## Product Purpose

KIRA is a local-first macOS app for turning references into connected ideas, outlines, and presentations. Import visual material, arrange it on a flexible canvas, connect evidence to ideas, then move the same project into 3D, Slides, or Outline. Success looks like staying in flow: capture is fast and gets out of the way, the workspace never feels like it's fighting the user.

## Core Features

- **Canvas** — the primary workspace. Nodes come in five kinds: idea, image, palette (color set), diagram, and placeholder, plus frame nodes that group images under a shared extracted palette. Evidence connects to ideas through typed relations (supports, contrasts, example, mood, material, reference, related, derived-from, contains), not separate link nodes. Native drag/zoom/pan and full undo/redo.
- **Library** — a collapsible drawer (images / ideas / links) for browsing, searching, tagging, and filtering everything imported into a project, independent of where it sits on the canvas.
- **Node details** — clicking a node opens a full editing overlay for that node (title, body, tags, relations, source metadata, AI suggestions). There is no persistent Inspector sidebar; editing is always anchored to the node itself.
- **Import & capture** — native folder import, Eagle library import (one-time folder or Web API — live sync not yet built), macOS screen capture, and drag/drop/paste. Imported images get automatic tags (color family, brightness, aspect) plus optional Apple Vision OCR and on-device tag normalization via Apple Foundation Models.
- **3D view** — a discovery/browsing layer for exploring the same graph in 3D. Not an editing surface.
- **Slides** — build and present a deck from canvas ideas; export to HTML or PPTX (native file save). "Export to Google Slides/Canva" opens the target site and hands off the PPTX for manual import — not a direct API push.
- **Outline** — generate a structured outline draft from a cluster of linked ideas.
- **AI assistance** — per-node actions (summarize, break down, synthesize, find gaps, generate variations) surfaced through an in-canvas chat session. Providers: Apple Foundation Models (on-device), the locally installed Claude Code / Codex CLIs, and direct API keys for OpenAI, Anthropic, Gemini, Ollama, or any OpenAI-compatible endpoint.
- **Browser capture** — the fastest way material enters a project; see below.
- **Project & version history** — everything lives in one local `.kira` package (SQLite + images + thumbnails); save-as-new-version and branch history are built in.

## Browser Capture — the app's sharpest USP

Most "save to app" browser extensions are a bookmarklet: grab the visible image, drop it in an inbox, sort later. KIRA's Chrome/Safari extension is a direct, local bridge into a *running* project — it's the single biggest differentiator against generic reference-collection tools (Eagle, Pinterest boards, screenshot folders), because capture never breaks the user's browsing flow and never leaves the machine.

- **Local bridge, not cloud.** The desktop app runs its own HTTP listener on `127.0.0.1:47653` (`/capture`, `/context`); the extension talks straight to it. No account, no server round-trip, capture works fully offline. If the desktop app isn't running, the extension doesn't fail silently — it queues via `chrome.storage.local` and its popup so nothing is lost.
- **Resolves the real image, not the thumbnail.** The content script doesn't grab whatever `<img src>` the page happens to show — it walks `srcset`, `<picture>`, and CSS `background-image` to find the highest-quality source, plus a Pinterest-specific URL-upscaling trick to pull full-resolution pins instead of preview crops.
- **Three capture motions, zero context switch:**
  - Drag an image straight off the page onto KIRA's floating drop pad, which stays visible while browsing.
  - Alt + right-click for instant quick-capture without opening a menu.
  - Right-click → "Capture Image to KIRA" / "Capture Page to KIRA" from the native browser context menu.
- **Targets a specific canvas node, not just an inbox.** The drop pad shows the user's *live* canvas nodes fetched from the running project in real time, so a capture can be aimed straight at the idea it belongs to — `target-node` — instead of always landing in a generic pile to be triaged later.
- **Minimal payload, on purpose.** Sends image URL + page URL + title + optional target-node id — never a full-page screenshot or scraped DOM. Fast, light, and consistent with the calm/local-first, anti-ceremony stance in Design Principles below.

This is the workflow to protect and keep showcasing prominently in onboarding and marketing surfaces — it's the thing KIRA does that competitors structurally can't (no cloud round-trip, no context switch, no generic inbox).

## Brand Personality

Calm, precise, local-first, quietly capable. Not flashy, not "AI product" coded. Three words: calm, considered, unobtrusive.

## Anti-references

- Rambling multi-step SaaS onboarding wizards (progress bars, big illustrations, "Step 2 of 5") — wrong tempo for a calm, local-first tool.
- Generic repeated card grids (identical icon + heading + text per browser/target) — reads as templated dashboard filler, not a crafted tool.
- Gradient text, glassmorphism-as-decoration, hero-metric tiles — standard AI-slop tells, avoid everywhere.

## Design Principles

- Get out of the way: the Capture/extension panel is a utility, not a feature showcase — status and action should be legible at a glance, no ceremony.
- One primary action per row: don't make the user parse multiple buttons of equal visual weight.
- Status before action: install/enabled state is the first thing read, the action button is secondary.
- Respect the existing dark, warm-neutral system (teal/cyan accent, hairline separators, restrained color) — no new competing colors or containers.
- Progressive disclosure over exposition: detail opens only via direct interaction with the specific element (click a node/property), never dumped out in full the moment a parent panel opens.
- Discoverable, not decorative: hidden-by-default UI must always signal it exists (hover affordance, "+"/overflow, command palette, first-run coach marks) — a brainstorming tool can't assume users already know what's possible.
- Selective tactile warmth: light skeuomorphic cues (soft shadow, subtle texture, pin/sticky-note/polaroid metaphors) on the flat foundation make the canvas feel inviting rather than sterile — never at the expense of clarity or accessibility.

See [DESIGN.md §2](DESIGN.md) for the full pattern library behind these three.

## Accessibility & Inclusion

Standard desktop app expectations: sufficient contrast against the existing dark surfaces, focus-visible states on interactive controls, no color-only status signaling (pair status color with text/icon).
