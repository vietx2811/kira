import type { KiraBridgeMessage, KiraBridgeResponse, KiraCaptureContext, KiraCapturePayload, PendingCapture } from './types'

const pendingCaptureKey = 'pendingCapture'
const captureEndpoint = 'http://127.0.0.1:47653/capture'
const contextEndpoint = 'http://127.0.0.1:47653/context'
const dragWindowPath = 'drag-window.html'

let dragWindowId: number | null = null
let dragWindowOpening = false

// research 2026-11-09 §5#3: captures that fail because the app is closed
// used to overwrite a single storage slot, so only the LAST one survived —
// everything before it was gone. A bounded queue plus an alarm-driven retry
// means none of them are lost, and they still get sent once the app is back.
// Nothing here lives in a module variable: a service worker (Safari
// especially, per research §6A) can be killed and respawned between any two
// of these steps, so every function re-reads chrome.storage.local fresh.
const pendingQueueKey = 'pendingCaptureQueue'
const maxQueuedCaptures = 50
const retryAlarmName = 'kira-retry-pending-captures'

type QueuedCapture = { id: string; capture: PendingCapture; queuedAt: string }

async function readQueue(): Promise<QueuedCapture[]> {
  const stored = await chrome.storage.local.get<{ [pendingQueueKey]: QueuedCapture[] }>([pendingQueueKey])
  return stored[pendingQueueKey] ?? []
}

async function updateBadge(count: number) {
  await chrome.action?.setBadgeText?.({ text: count > 0 ? String(count) : '' })
}

async function scheduleRetry() {
  chrome.alarms.create(retryAlarmName, { delayInMinutes: 1, periodInMinutes: 2 })
}

async function enqueuePendingCapture(capture: PendingCapture) {
  const queue = await readQueue()
  const entry: QueuedCapture = { id: crypto.randomUUID(), capture, queuedAt: new Date().toISOString() }
  // Oldest dropped first once full — what you captured most recently is more
  // likely still what you're after.
  const next = [...queue, entry].slice(-maxQueuedCaptures)
  await chrome.storage.local.set({ [pendingQueueKey]: next })
  await updateBadge(next.length)
  await scheduleRetry()
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === retryAlarmName) void flushPendingQueue()
})

async function flushPendingQueue() {
  const queue = await readQueue()
  if (queue.length === 0) {
    await chrome.alarms.clear(retryAlarmName)
    await updateBadge(0)
    return
  }

  // A single reachability probe first, so a still-closed app doesn't cost a
  // POST per queued item every time this alarm fires.
  const reachable = await fetchCaptureContext()
  if (reachable === null) return

  let stoppedAt = queue.length
  for (let index = 0; index < queue.length; index += 1) {
    const result = await postCaptureResult(queue[index].capture)
    if (result === 'unreachable') {
      // The app went away again mid-flush — stop, keep this one and
      // everything after it, and let the next alarm tick pick up from here.
      stoppedAt = index
      break
    }
    // 'sent' and 'rejected' both drop the entry: a rejected payload is
    // permanently invalid (e.g. a data: URL slipped through some other
    // path), so retrying it forever would never help.
  }

  const remaining = queue.slice(stoppedAt)
  await chrome.storage.local.set({ [pendingQueueKey]: remaining })
  await updateBadge(remaining.length)
  if (remaining.length === 0) await chrome.alarms.clear(retryAlarmName)
}

// The service worker's top-level code runs every time it's (re)activated —
// by an event, a message, or the browser restarting — which is exactly when
// a queue left over from before needs its badge and alarm restored.
void (async () => {
  const queue = await readQueue()
  if (queue.length > 0) {
    await updateBadge(queue.length)
    await scheduleRetry()
  }
})()

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

// research 2026-11-09 §5#2: an embedded (data:/blob:) image right-clicked
// via Chrome's own "Capture Image to KIRA" item used to get sent anyway —
// isCaptureUrl's http(s)-only rule (content.ts) never runs for this path,
// since info.srcUrl comes straight from the browser, not through it.
function isHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const tabTitle = tab?.title?.trim() || 'Untitled'
  const tabUrl = tab?.url || info.pageUrl || ''

  if (info.menuItemId === 'kira-copy-image' && info.srcUrl && !isHttpUrl(info.srcUrl)) {
    // No DOM here to toast with directly — relay to the tab's content
    // script, which is where the user actually right-clicked.
    if (tab?.id !== undefined) {
      void chrome.tabs.sendMessage(tab.id, {
        type: 'kira-show-toast',
        message: "Can't capture this image yet, it's embedded in the page.",
      })
    }
    return
  }

  if (info.menuItemId === 'kira-copy-image' && info.srcUrl) {
    void sendOrStageCapture({
      kiraCapture: 1,
      kind: 'image',
      url: info.srcUrl,
      title: tabTitle,
      source: tabUrl || info.srcUrl,
      pageUrl: tabUrl,
      previewUrl: info.srcUrl,
      capturedAt: new Date().toISOString(),
    })
    return
  }

  void buildPageCapture(tab).then((capture) => {
    if (capture) void sendOrStageCapture(capture)
  })
})

// research 2026-11-09 §5#5: fires from the OS/browser, not a page, so it only
// ever reaches background.ts — "save hovered image" has to be relayed to the
// tab's content script, which is the only place that knows what's hovered.
chrome.commands.onCommand.addListener((command, tab) => {
  if (command === 'save-page') {
    void buildPageCapture(tab).then((capture) => {
      if (capture) void sendOrStageCapture(capture)
    })
    return
  }
  if (command === 'save-hovered-image' && tab?.id !== undefined) {
    void chrome.tabs.sendMessage(tab.id, { type: 'kira-save-hovered-image' })
  }
})

type PageMetadata = { title: string; description: string; imageUrl: string; canonicalUrl: string }

// research 2026-11-09 §5#7: a page capture used to carry nothing past
// title/URL, so main.tsx rendered it as an image node whose thumbnail was
// the page's own URL — never a real image. Runs inside the tab (this file
// has no DOM of its own), same technique as popup.ts's discoverPageImages.
async function extractPageMetadata(tabId: number): Promise<PageMetadata> {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const byProperty = (property: string) =>
          document.querySelector(`meta[property="${property}"]`)?.getAttribute('content')?.trim() || ''
        const byName = (name: string) =>
          document.querySelector(`meta[name="${name}"]`)?.getAttribute('content')?.trim() || ''
        return {
          title: byProperty('og:title') || document.title || '',
          description: byProperty('og:description') || byName('description') || '',
          imageUrl: byProperty('og:image') || '',
          canonicalUrl: document.querySelector('link[rel="canonical"]')?.getAttribute('href')?.trim() || '',
        }
      },
    })
    return result?.result ?? { title: '', description: '', imageUrl: '', canonicalUrl: '' }
  } catch {
    return { title: '', description: '', imageUrl: '', canonicalUrl: '' }
  }
}

async function buildPageCapture(tab?: { id?: number; title?: string; url?: string }): Promise<PendingCapture | null> {
  const tabUrl = tab?.url || ''
  if (!tabUrl) return null
  const tabTitle = tab?.title?.trim() || 'Untitled'
  const meta = tab?.id !== undefined ? await extractPageMetadata(tab.id) : null
  const canonicalUrl = meta?.canonicalUrl && isHttpUrl(meta.canonicalUrl) ? meta.canonicalUrl : tabUrl
  const imageUrl = meta?.imageUrl && isHttpUrl(meta.imageUrl) ? meta.imageUrl : undefined

  return {
    kiraCapture: 1,
    kind: 'page',
    url: canonicalUrl,
    title: meta?.title || tabTitle,
    source: canonicalUrl,
    imageUrl,
    note: meta?.description || undefined,
    capturedAt: new Date().toISOString(),
  }
}

// Sole owner of traffic to the desktop app: content scripts and extension pages
// ask through here so every request carries the extension's host permissions.
chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse: (response: KiraBridgeResponse) => void) => {
  if (!isBridgeMessage(message)) return

  if (message.type === 'kira-post-capture') {
    const capture = message.capture
    void postCaptureResult(capture).then((result) => {
      if (result === 'unreachable') void enqueuePendingCapture(capture)
      sendResponse({ ok: result === 'sent' })
    })
    return true
  }

  if (message.type === 'kira-get-context') {
    void fetchCaptureContext().then((context) => sendResponse({ ok: context !== null, context }))
    return true
  }

  // background.ts only ever sends these two (to a tab's content script) —
  // they're in the union because the type is bidirectional, not because this
  // listener expects to receive them.
  if (message.type === 'kira-show-toast') return
  if (message.type === 'kira-save-hovered-image') return

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
  const result = await postCaptureResult(capture)
  if (result === 'sent') return
  if (result === 'unreachable') await enqueuePendingCapture(capture)
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

type PostCaptureResult = 'sent' | 'rejected' | 'unreachable'

// Distinguishes "the app is closed" (queue it, retry later) from "the app
// is open and refused this payload" (it always will — don't queue it).
async function postCaptureResult(capture: KiraCapturePayload): Promise<PostCaptureResult> {
  try {
    const response = await fetch(captureEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(capture),
    })
    return response.ok ? 'sent' : 'rejected'
  } catch {
    return 'unreachable'
  }
}
