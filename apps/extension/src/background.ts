import type { KiraBridgeMessage, KiraBridgeResponse, KiraCaptureContext, KiraCapturePayload, PendingCapture } from './types'

const pendingCaptureKey = 'pendingCapture'
const captureEndpoint = 'http://127.0.0.1:47653/capture'
const contextEndpoint = 'http://127.0.0.1:47653/context'
const dragWindowPath = 'drag-window.html'

let dragWindowId: number | null = null
let dragWindowOpening = false

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'kira-copy-image',
    title: 'Capture Image to KIRA',
    contexts: ['image'],
  })
  chrome.contextMenus.create({
    id: 'kira-copy-page',
    title: 'Capture Page to KIRA',
    contexts: ['page'],
  })
})

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const tabTitle = tab?.title?.trim() || 'Untitled'
  const tabUrl = tab?.url || info.pageUrl || ''
  const capture: PendingCapture =
    info.menuItemId === 'kira-copy-image' && info.srcUrl
      ? {
          kiraCapture: 1,
          kind: 'image',
          url: info.srcUrl,
          title: tabTitle,
          source: tabUrl || info.srcUrl,
          pageUrl: tabUrl,
          previewUrl: info.srcUrl,
          capturedAt: new Date().toISOString(),
        }
      : {
          kiraCapture: 1,
          kind: 'page',
          url: tabUrl,
          title: tabTitle,
          source: tabUrl,
          capturedAt: new Date().toISOString(),
        }

  void sendOrStageCapture(capture)
})

// Sole owner of traffic to the desktop app: content scripts and extension pages
// ask through here so every request carries the extension's host permissions.
chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse: (response: KiraBridgeResponse) => void) => {
  if (!isBridgeMessage(message)) return

  if (message.type === 'kira-post-capture') {
    void postCapture(message.capture).then((ok) => sendResponse({ ok }))
    return true
  }

  if (message.type === 'kira-get-context') {
    void fetchCaptureContext().then((context) => sendResponse({ ok: context !== null, context }))
    return true
  }

  void openDragWindow(message.capture)
    .then(() => sendResponse({ ok: true }))
    .catch(() => sendResponse({ ok: false }))
  return true
})

async function fetchCaptureContext(): Promise<KiraCaptureContext | null> {
  try {
    const response = await fetch(contextEndpoint)
    if (!response.ok) return null
    return (await response.json()) as KiraCaptureContext
  } catch {
    return null
  }
}

chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === dragWindowId) dragWindowId = null
})

async function sendOrStageCapture(capture: PendingCapture) {
  if (await postCapture(capture)) return
  await chrome.storage.local.set({ [pendingCaptureKey]: capture })
  await chrome.action?.openPopup?.()
}

async function openDragWindow(capture: PendingCapture) {
  if (dragWindowOpening) return
  dragWindowOpening = true
  try {
    await chrome.storage.local.set({ [pendingCaptureKey]: capture })
    const windowOptions = {
      width: 520,
      height: 440,
      left: Math.max(40, Math.round((globalThis.screen?.availWidth ?? 1440) / 2 - 260)),
      top: Math.max(40, Math.round((globalThis.screen?.availHeight ?? 900) - 520)),
      focused: true,
    }

    if (dragWindowId !== null) {
      try {
        await chrome.windows.update(dragWindowId, windowOptions)
        return
      } catch {
        dragWindowId = null
      }
    }

    const created = await chrome.windows.create({
      url: chrome.runtime.getURL(dragWindowPath),
      type: 'popup',
      ...windowOptions,
    })
    dragWindowId = created.id ?? null
  } finally {
    dragWindowOpening = false
  }
}

function isBridgeMessage(message: unknown): message is KiraBridgeMessage {
  if (!message || typeof message !== 'object') return false
  const candidate = message as { type?: unknown; capture?: Partial<PendingCapture> }
  if (candidate.type === 'kira-get-context') return true
  if (candidate.type !== 'kira-post-capture' && candidate.type !== 'kira-open-drag-window') return false
  return candidate.capture?.kiraCapture === 1
    && (candidate.capture.kind === 'image' || candidate.capture.kind === 'page')
    && typeof candidate.capture.url === 'string'
}

async function postCapture(capture: KiraCapturePayload) {
  try {
    const response = await fetch(captureEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(capture),
    })
    return response.ok
  } catch {
    return false
  }
}
