# KIRA Capture — Chrome Web Store / Edge Add-ons listing draft

Paste these into the CWS developer dashboard / Edge Add-ons dashboard when submitting
`release/kira-capture-chrome-v<version>.zip` (built via `pnpm --filter @kira/extension package`).
This file is documentation only — it isn't bundled into the extension or read by KIRA.

## Short description (≤132 characters, shown in search results)

Drag any image or link straight from the page into your KIRA moodboard — no upload, no save-then-import.

(131 characters)

## Full description

KIRA Capture is the browser companion to KIRA, a desktop moodboard and research canvas for
designers and researchers building visual references.

Instead of saving an image, switching to KIRA, and importing it, KIRA Capture lets you drag
material straight off any page into an open KIRA project:

- Drag an image from any tab directly onto a KIRA canvas node
- Right-click any image or link to send it to your current KIRA project
- Works entirely on your own machine — KIRA Capture only ever talks to the KIRA desktop app
  running locally on the same computer; nothing is sent anywhere else

KIRA Capture requires the KIRA desktop app (macOS) to be installed and running. It does not
work standalone.

## Single purpose statement (required by CWS review)

KIRA Capture's single purpose is to let the user send an image or link from the page they are
viewing to their locally running KIRA desktop app, so it can be dropped onto a moodboard canvas
without a manual save-then-import step.

## Permission justification (for the CWS/Edge "why do you need this" review fields)

- **`activeTab`** — used only when the user explicitly invokes capture (toolbar click or context
  menu), to read the specific image/link the user selected. Never runs in the background against
  tabs the user hasn't acted on.
- **`scripting`** — injects the drag-and-drop capture affordance into the current page only after
  the user invokes it via `activeTab`; not used to run scripts on arbitrary pages proactively.
- **`contextMenus`** — adds the right-click "Send to KIRA" menu item.
- **`clipboardWrite`** — lets a captured item's reference be copied to the clipboard as a fallback
  when the drag target isn't available.
- **`storage`** — stores the user's local KIRA connection state (e.g. which local port KIRA is
  listening on) between sessions; no data leaves the machine.
- **Host permission `http://127.0.0.1:47653/*`** — the only network endpoint this extension talks
  to: the KIRA desktop app's own local server on the same machine. No remote host is contacted.
- **Content script matches (`http://*/*`, `https://*/*`)** — required so the drag-into-KIRA
  affordance is available on whatever page the user is viewing when they capture something; the
  script is passive until the user initiates a capture and never transmits page content anywhere
  except to the local KIRA app the user is running.

Note for reviewers: broad content-script host matches combined with `scripting` typically draws
extra scrutiny — call out the "local-only, user-initiated" framing above explicitly in the CWS
submission notes if the automated review flags it.

## Assets checklist

| Asset | Status |
| --- | --- |
| Icons 16/32/48/128px | ✅ already in `apps/extension/public/icons/` |
| Store icon 128×128 | ✅ `icons/icon-128.png` |
| Screenshot(s), 1280×800 or 640×400 (at least 1, CWS requires) | ❌ needs a real KIRA + browser session — capture from the signed app, not generated here |
| Promo tile, 440×280 (optional but recommended) | ❌ same as above |
| Privacy policy URL (required once any host permission is requested) | ❌ needs a URL you control — even a short static page describing the "local-only" data flow above satisfies this |

## Submission (you do this part — not automated here)

1. Create a one-time Chrome Web Store developer account (small one-time registration fee) at
   the Chrome Web Store Developer Dashboard, and a free Microsoft Partner Center account for Edge.
2. Upload `kira-capture-chrome-v<version>.zip` to each.
3. Paste the copy above, add the screenshots once captured, add the privacy policy URL.
4. Submit for review. Chrome's review can take from a few hours to a few days depending on the
   permission scrutiny noted above.
