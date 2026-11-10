type KiraCaptureNodeKind = 'idea' | 'image' | 'palette' | 'diagram' | 'placeholder'

type KiraCapturePayload = {
  kiraCapture: 1
  kind: 'image' | 'page'
  url: string
  title: string
  source: string
  pageUrl?: string
  imageUrl?: string
  tags?: string[]
  note?: string
  targetNode?: {
    kind: KiraCaptureNodeKind
    id: string
  }
  createIdeaTitle?: string
  captureIntent?: 'undecided' | 'target-node' | 'create-or-select'
  capturedAt: string
}

type PendingCapture = KiraCapturePayload & {
  previewUrl?: string
}

type KiraCaptureContext = {
  app: 'kira'
  fileTitle: string
  filePath?: string
  nodes: Array<{
    kind: KiraCaptureNodeKind
    id: string
    title: string
    subtitle?: string
    snippet?: string
    thumb?: string
  }>
  updatedAt: string
}

// docs/research/2026-11-09-pinterest-similar-flow.md §A. Mirrors
// KiraConnectionPayload in types.ts.
type KiraConnectionPayload = {
  service: 'pinterest'
  loggedIn: boolean
}

// Mirrors the shared shapes in types.ts; this file is bundled standalone.
type KiraBridgeMessage =
  | { type: 'kira-post-capture'; capture: KiraCapturePayload }
  | { type: 'kira-post-connection'; connection: KiraConnectionPayload }
  | { type: 'kira-get-context' }
  | { type: 'kira-open-drag-window'; capture: PendingCapture }
  | { type: 'kira-show-toast'; message: string }
  | { type: 'kira-save-hovered-image' }

type KiraBridgeResponse =
  | { ok: true; context?: KiraCaptureContext | null }
  | { ok: false; context?: undefined }

const pendingCaptureKey = 'pendingCapture'
const dropPadId = 'kira-capture-drop-pad'
const toastId = 'kira-capture-toast'
// research 2026-11-09 §5#2: isCaptureUrl and parseCaptureUrl (main.tsx)
// disagreed on data: URLs, so a capture built from one looked fine here,
// silently failed app-side, and the extension still said "Saved". Sending
// bytes instead is a later, deliberate decision; for now we just skip and
// say so.
const embeddedImageMessage = "Can't capture this image yet, it's embedded in the page."

let draggingCapture: KiraCapturePayload | null = null
let currentContext: KiraCaptureContext | null = null
let pendingComboCapture: KiraCapturePayload | null = null
let hideDropPadTimer = 0
let lastPointerCapture: KiraCapturePayload | null = null
let lastPointerPosition: { x: number; y: number } | null = null
let pointerDragWindowOpened = false
let contextRefreshPromise: Promise<void> | null = null
let lastContextRefreshAt = 0
let dragStartPosition: { x: number; y: number } | null = null
let lastDragPosition: { x: number; y: number } | null = null
let dragMoveCount = 0
let revealDropPadTimer = 0
let pointerDropCompleting = false

// research 2026-11-09 §5#4: the floating "Save" button that appears over a
// hovered image. One shared host element, repositioned over whatever image
// is currently eligible, rather than one per image — cheap, and avoids
// littering every page's DOM. hoverTargetImage also backs the
// save-hovered-image keyboard command (§5#5): it's "whatever the button
// would act on right now", command or click alike.
const hoverSaveId = 'kira-hover-save'
const hoverSaveMinSize = 64
let hoverButtonHost: HTMLElement | null = null
let hoverButtonEl: HTMLButtonElement | null = null
let hoverTargetImage: HTMLImageElement | null = null
let hideHoverButtonTimer = 0

// Native `dragenter/dragover/drop` never fire for the pointer-fallback drag
// (see handlePointerMoveProbe) since no real HTML5 drag session exists, so
// every drop-target element registered via wireDropTarget is tracked here to
// let pointerup/mouseup resolve + complete the drop manually.
type CaptureDropHandler = (dataTransfer: DataTransfer | null) => void
// WeakMap so renderCaptureContext()'s innerHTML = '' rebuild of node cards
// (see below) lets detached cards and their closures get garbage collected
// instead of being kept alive by this registry forever.
const pointerDropHandlers = new WeakMap<HTMLElement, CaptureDropHandler>()

document.addEventListener('pointerdown', rememberPointerCapture, true)
document.addEventListener('mousedown', rememberPointerCapture, true)
document.addEventListener('pointermove', handlePointerMoveProbe, true)
document.addEventListener('pointerup', clearPointerCapture, true)
document.addEventListener('mouseup', clearPointerCapture, true)
document.addEventListener('pointerup', handlePointerDropRelease, true)
document.addEventListener('mouseup', handlePointerDropRelease, true)
document.addEventListener('dragstart', handleDragStart, true)
document.addEventListener('dragenter', handleDocumentDragProbe, true)
document.addEventListener('dragover', handleDocumentDragProbe, true)
document.addEventListener('dragleave', handleDocumentDragLeave, true)
document.addEventListener('dragend', hideDropPadSoon, true)
document.addEventListener('drop', hideDropPadSoon, true)
document.addEventListener('contextmenu', handleAltContextMenu, true)
document.addEventListener('mouseover', handleHoverSaveProbe, true)
document.addEventListener('mouseout', handleHoverSaveLeave, true)
// position:fixed tracks the viewport, not the page — a stale rect after
// scrolling would point the button at the wrong spot, so just hide it.
document.addEventListener('scroll', hideHoverButtonSoon, true)

// background.ts has no DOM of its own — this is how it shows the user
// something when it can't (e.g. the native context-menu item rejecting an
// embedded image before ever calling postCapture), and how the
// save-hovered-image keyboard command (fired from the OS, so it only ever
// reaches background.ts) reaches the content script that knows what's
// hovered.
chrome.runtime.onMessage.addListener((message: unknown) => {
  if (!message || typeof message !== 'object') return
  const candidate = message as Partial<KiraBridgeMessage>
  if (candidate.type === 'kira-show-toast' && typeof candidate.message === 'string') {
    showToast(candidate.message)
    return
  }
  if (candidate.type === 'kira-save-hovered-image') {
    saveHoveredImage()
  }
})

function saveHoveredImage() {
  if (!hoverTargetImage) {
    showToast('Hover an image first')
    return
  }
  const capture = captureFromImage(hoverTargetImage)
  if (capture) {
    void sendCapture(capture)
  } else if (isEmbeddedOnlyUrl(bestImageUrlFromImage(hoverTargetImage))) {
    showToast(embeddedImageMessage)
  }
}

function handleDragStart(event: DragEvent) {
  const capture = captureFromDragEvent(event) ?? lastPointerCapture
  if (!capture) return

  draggingCapture = capture
  dragStartPosition = { x: event.clientX, y: event.clientY }
  lastDragPosition = dragStartPosition
  dragMoveCount = 0
  event.dataTransfer?.setData('application/x-kira-capture', JSON.stringify(capture))
  event.dataTransfer?.setData('text/uri-list', capture.url)
  event.dataTransfer?.setData('text/plain', capture.url)
  scheduleDropPadReveal()
}

function rememberPointerCapture(event: MouseEvent | PointerEvent) {
  lastPointerPosition = { x: event.clientX, y: event.clientY }
  lastPointerCapture = captureFromPoint(event.clientX, event.clientY) ?? captureFromEventTarget(event.target)
  pointerDragWindowOpened = false
  pointerDropCompleting = false
  dragMoveCount = 0
}

function handlePointerMoveProbe(event: PointerEvent) {
  if (pointerDragWindowOpened || !lastPointerCapture || !lastPointerPosition) return
  if ((event.buttons & 1) !== 1) return

  dragMoveCount += 1
  const distance = Math.hypot(event.clientX - lastPointerPosition.x, event.clientY - lastPointerPosition.y)
  if (dragMoveCount <= 10 || distance <= 30) return

  draggingCapture = lastPointerCapture
  pointerDragWindowOpened = true
  showDropPad({ x: event.clientX, y: event.clientY })
}

function clearPointerCapture() {
  window.clearTimeout(revealDropPadTimer)
  window.setTimeout(() => {
    lastPointerCapture = null
    lastPointerPosition = null
    pointerDragWindowOpened = false
    dragStartPosition = null
    lastDragPosition = null
    dragMoveCount = 0
  }, 240)
}

function handleDocumentDragProbe(event: DragEvent) {
  if (!draggingCapture && !hasLikelyCaptureDrag(event.dataTransfer)) return
  if (!draggingCapture) {
    showDropPad({ x: event.clientX, y: event.clientY })
    return
  }
  updateNativeDragProgress(event)
}

function handleDocumentDragLeave(event: DragEvent) {
  if (event.relatedTarget) return
  hideDropPadSoon()
}

function handleAltContextMenu(event: MouseEvent) {
  if (!event.altKey) return
  const image = imageFromEventTarget(event.target)
  if (!image) return

  const capture = captureFromImage(image)
  if (!capture) {
    if (isEmbeddedOnlyUrl(bestImageUrlFromImage(image))) showToast(embeddedImageMessage)
    return
  }

  event.preventDefault()
  event.stopPropagation()
  void sendCapture(capture)
}

function imageFromDragEvent(event: DragEvent) {
  for (const target of event.composedPath()) {
    const image = imageFromEventTarget(target)
    if (image) return image
  }
  return imageFromEventTarget(event.target)
}

function captureFromDragEvent(event: DragEvent) {
  const image = imageFromDragEvent(event)
  return image ? captureFromImage(image) : captureFromPoint(event.clientX, event.clientY)
}

function captureFromEventTarget(target: EventTarget | null) {
  const image = imageFromEventTarget(target)
  if (image) return captureFromImage(image)
  return target instanceof Element ? captureFromElementBackground(target) : null
}

function captureFromPoint(clientX: number, clientY: number) {
  const elements = document.elementsFromPoint(clientX, clientY)
  for (const element of elements) {
    const imageCapture = captureFromEventTarget(element)
    if (imageCapture) return imageCapture

    const nestedImage = element.querySelector?.('img')
    if (nestedImage) {
      const nestedCapture = captureFromImage(nestedImage)
      if (nestedCapture) return nestedCapture
    }
  }

  return null
}

function imageFromEventTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return null
  if (target instanceof HTMLImageElement) return target
  const closestImage = target.closest('img')
  if (closestImage) return closestImage

  if (target instanceof HTMLAnchorElement || target.getAttribute('role') === 'link') {
    return target.querySelector('img')
  }

  return null
}

function captureFromElementBackground(element: Element) {
  for (const candidate of [element, ...Array.from(element.closest('a, [role="link"], [data-test-id], [data-testid]')?.querySelectorAll('*') ?? [])]) {
    if (!(candidate instanceof Element)) continue
    const backgroundUrl = firstCssImageUrl(getComputedStyle(candidate).backgroundImage)
    if (!backgroundUrl || !isCaptureUrl(backgroundUrl)) continue
    const absoluteUrl = new URL(backgroundUrl, location.href).toString()
    return {
      kiraCapture: 1,
      kind: 'image',
      url: absoluteUrl,
      title: candidate.getAttribute('aria-label')?.trim()
        || candidate.getAttribute('alt')?.trim()
        || document.title?.trim()
        || titleFromUrl(absoluteUrl),
      source: location.href,
      pageUrl: location.href,
      capturedAt: new Date().toISOString(),
    } satisfies KiraCapturePayload
  }

  return null
}

function firstCssImageUrl(backgroundImage: string) {
  if (backgroundImage.includes('image-set(')) {
    const imageSet = backgroundImage.match(/image-set\((.+)\)/)?.[1]
    if (imageSet) {
      const urls = imageSet
        .split(',')
        .map((part) => part.trim().match(/url\((['"]?)(.*?)\1\)/)?.[2] || part.trim().split(/\s+/)[0])
        .filter(Boolean)
      return urls.at(-1) || null
    }
  }
  const match = backgroundImage.match(/url\((['"]?)(.*?)\1\)/)
  return match?.[2] || null
}

function captureFromImage(image: HTMLImageElement): KiraCapturePayload | null {
  const url = bestImageUrlFromImage(image)
  if (!isCaptureUrl(url)) return null

  return {
    kiraCapture: 1,
    kind: 'image',
    url,
    title: image.alt?.trim() || image.title?.trim() || document.title?.trim() || titleFromUrl(url),
    source: location.href,
    pageUrl: location.href,
    capturedAt: new Date().toISOString(),
  }
}

function bestImageUrlFromImage(image: HTMLImageElement) {
  const picture = image.closest('picture')
  const pictureSource = picture ? bestUrlFromSourceElements(Array.from(picture.querySelectorAll('source'))) : null
  const srcsetSource = bestUrlFromSrcset(image.getAttribute('srcset') || '')
  return normalizeCaptureUrl(pictureSource || srcsetSource || image.currentSrc || image.src || image.getAttribute('src') || '')
}

function bestUrlFromSourceElements(sources: HTMLSourceElement[]) {
  const candidates = sources
    .map((source) => bestUrlFromSrcset(source.getAttribute('srcset') || ''))
    .filter(Boolean) as string[]
  return candidates[0] || null
}

function bestUrlFromSrcset(srcset: string) {
  const candidates = parseSrcset(srcset)
  if (candidates.length === 0) return null
  candidates.sort((a, b) => (b.width || b.density || 0) - (a.width || a.density || 0))
  return candidates[0]?.url || null
}

function parseSrcset(srcset: string) {
  return srcset
    .split(/\s*([^,]\S*[^,](?:\s+[^,]+)?)\s*(?:,|$)/)
    .filter(Boolean)
    .map((candidate) => {
      const parts = candidate.trim().split(/\s+/)
      const result: { url: string; width?: number; density?: number } = { url: parts[0] }
      for (const descriptor of parts.slice(1)) {
        const value = Number.parseFloat(descriptor.slice(0, -1))
        if (descriptor.endsWith('w') && Number.isFinite(value)) result.width = value
        if (descriptor.endsWith('x') && Number.isFinite(value)) result.density = value
      }
      return result
    })
    .filter((candidate) => candidate.url)
}

function normalizeCaptureUrl(url: string) {
  if (!url) return url
  try {
    return new URL(url, location.href).toString()
  } catch {
    return url
  }
}

function isCaptureUrl(value: string) {
  try {
    const url = new URL(value, location.href)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

// data: (and blob:) aren't http(s), so isCaptureUrl already rejects them —
// this tells that apart from "no image at all" so callers can say why.
function isEmbeddedOnlyUrl(value: string) {
  try {
    const url = new URL(value, location.href)
    return url.protocol === 'data:' || url.protocol === 'blob:'
  } catch {
    return false
  }
}

// research 2026-11-09 §5#4: "Save" button that floats over a hovered image.
// Skips the deliberately-sized hit-test below rather than every <img> —
// a page's tiny icons and spacers would otherwise get a button too.
function isHoverSaveEligible(image: HTMLImageElement) {
  const rect = image.getBoundingClientRect()
  return rect.width >= hoverSaveMinSize && rect.height >= hoverSaveMinSize
}

function handleHoverSaveProbe(event: MouseEvent) {
  const image = imageFromEventTarget(event.target)
  if (!image || !isHoverSaveEligible(image)) return
  window.clearTimeout(hideHoverButtonTimer)
  if (image !== hoverTargetImage) showHoverButtonFor(image)
}

function handleHoverSaveLeave(event: MouseEvent) {
  const related = event.relatedTarget
  // Moving from the image onto the button itself (or vice versa) isn't a
  // real "leave" — without this the button would vanish right as the
  // pointer reaches it.
  if (related instanceof Node && (related === hoverButtonEl || hoverButtonEl?.contains(related))) return
  const leavingImage = imageFromEventTarget(event.target)
  if (leavingImage && leavingImage === hoverTargetImage) hideHoverButtonSoon()
}

function hideHoverButtonSoon() {
  window.clearTimeout(hideHoverButtonTimer)
  hideHoverButtonTimer = window.setTimeout(hideHoverButtonNow, 180)
}

function hideHoverButtonNow() {
  hoverTargetImage = null
  if (hoverButtonHost) hoverButtonHost.style.opacity = '0'
}

function showHoverButtonFor(image: HTMLImageElement) {
  hoverTargetImage = image
  const { button, host } = ensureHoverButton()
  const rect = image.getBoundingClientRect()
  host.style.opacity = '1'
  // Top-right corner, inset slightly, like Pinterest/Cosmos's own hover
  // button (research 2026-11-09 §2 "7 mẫu hình", #2) — small and in a
  // corner, so it never blocks dragging the rest of the image.
  button.style.top = `${Math.max(4, rect.top + 6)}px`
  button.style.left = `${Math.max(4, rect.right - 34)}px`
}

function ensureHoverButton(): { host: HTMLElement; button: HTMLButtonElement } {
  if (hoverButtonHost && hoverButtonEl) return { host: hoverButtonHost, button: hoverButtonEl }

  const host = document.createElement('div')
  host.id = hoverSaveId
  host.style.cssText = 'position:fixed;top:0;left:0;z-index:2147483647;opacity:0;pointer-events:none;transition:opacity 120ms ease;'
  const shadow = host.attachShadow({ mode: 'open' })

  const style = document.createElement('style')
  style.textContent = `
    button {
      all: initial;
      position: fixed;
      display: grid;
      place-items: center;
      width: 28px;
      height: 28px;
      border-radius: 999px;
      background: rgba(20, 20, 20, 0.88);
      color: #f1eee7;
      font: 15px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      cursor: pointer;
      pointer-events: auto;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
    }
    button:hover {
      background: rgba(32, 32, 32, 0.96);
    }
  `
  shadow.append(style)

  const button = document.createElement('button')
  button.type = 'button'
  button.title = 'Save to KIRA'
  button.setAttribute('aria-label', 'Save to KIRA')
  button.textContent = '+'
  button.addEventListener('mouseenter', () => window.clearTimeout(hideHoverButtonTimer))
  button.addEventListener('mouseleave', hideHoverButtonSoon)
  button.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    saveHoveredImage()
    hideHoverButtonNow()
  })
  shadow.append(button)

  document.documentElement.append(host)
  hoverButtonHost = host
  hoverButtonEl = button
  return { host, button }
}

function hasLikelyCaptureDrag(dataTransfer: DataTransfer | null) {
  if (!dataTransfer) return false
  if (draggingCapture) return true

  const types = [...dataTransfer.types]
  return types.some((type) =>
    ['application/x-kira-capture', 'text/html', 'text/uri-list', 'Files'].includes(type),
  )
}

function titleFromUrl(value: string) {
  try {
    const url = new URL(value, location.href)
    const filename = url.pathname.split('/').filter(Boolean).at(-1)
    return filename?.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ') || url.hostname || 'Web image'
  } catch {
    return 'Web image'
  }
}

function showDropPad(position = lastPointerPosition) {
  window.clearTimeout(hideDropPadTimer)
  const pad = ensureDropPad()
  const isAlreadyVisible = pad.classList.contains('is-visible')
  if (!isAlreadyVisible) positionDropPad(pad, position)
  void revealDropPadWhenAvailable(pad, !isAlreadyVisible)
}

async function revealDropPadWhenAvailable(pad: HTMLElement, force: boolean) {
  await refreshCaptureContext({ force })
  if (!currentContext) {
    closeDropPad()
    showToast('Mở Kira App để sử dụng tính năng này')
    return
  }
  pad.classList.add('is-visible')
}

function hideDropPadSoon() {
  window.clearTimeout(hideDropPadTimer)
  hideDropPadTimer = window.setTimeout(() => {
    if (pendingComboCapture) return
    document.getElementById(dropPadId)?.classList.remove('is-visible', 'is-over')
    draggingCapture = null
    pendingComboCapture = null
    lastPointerCapture = null
    lastPointerPosition = null
    pointerDragWindowOpened = false
    dragStartPosition = null
    lastDragPosition = null
    dragMoveCount = 0
  }, 180)
}

function closeDropPad() {
  window.clearTimeout(hideDropPadTimer)
  window.clearTimeout(revealDropPadTimer)
  pendingComboCapture = null
  document.getElementById(dropPadId)?.classList.remove('is-visible', 'is-over', 'is-combo-open')
  draggingCapture = null
  lastPointerCapture = null
  lastPointerPosition = null
  pointerDragWindowOpened = false
  dragStartPosition = null
  lastDragPosition = null
  dragMoveCount = 0
}

function scheduleDropPadReveal() {
  window.clearTimeout(revealDropPadTimer)
  revealDropPadTimer = window.setTimeout(() => {
    if (!draggingCapture) return
    showDropPad(lastDragPosition ?? dragStartPosition ?? lastPointerPosition)
  }, 800)
}

function updateNativeDragProgress(event: DragEvent) {
  if (!dragStartPosition) {
    dragStartPosition = { x: event.clientX, y: event.clientY }
  }

  const position = { x: event.clientX, y: event.clientY }
  if (lastDragPosition?.x === position.x && lastDragPosition.y === position.y) return

  lastDragPosition = position
  dragMoveCount += 1

  const distance = Math.hypot(position.x - dragStartPosition.x, position.y - dragStartPosition.y)
  if (dragMoveCount > 10 && distance > 30) {
    window.clearTimeout(revealDropPadTimer)
    showDropPad(position)
  }
}

function positionDropPad(pad: HTMLElement, position: { x: number; y: number } | null) {
  const width = Math.min(760, window.innerWidth - 28)
  const height = Math.min(430, window.innerHeight - 28)
  const fallback = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
  const point = position ?? fallback
  const left = clamp(point.x - width * 0.48, 14, window.innerWidth - width - 14)
  const top = clamp(point.y - 42, 14, window.innerHeight - height - 14)
  pad.style.setProperty('--kira-drop-left', `${left}px`)
  pad.style.setProperty('--kira-drop-top', `${top}px`)
  pad.style.setProperty('--kira-drop-width', `${width}px`)
  pad.style.setProperty('--kira-drop-height', `${height}px`)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function ensureDropPad() {
  const existing = document.getElementById(dropPadId)
  if (existing) return existing

  const pad = document.createElement('div')
  pad.id = dropPadId
  pad.innerHTML = `
    <section class="kira-capture-window" aria-label="KIRA capture targets">
      <div class="kira-capture-layout">
        <div class="kira-capture-undecided" data-drop-target="undecided">
          <div class="kira-folder-mark">
            <span>K</span>
          </div>
          <strong>Drop image here</strong>
          <span>KIRA Inbox</span>
        </div>
        <div class="kira-capture-main">
          <div class="kira-capture-brand">
            <strong>KIRA</strong>
            <span data-role="file-title">Loading file</span>
          </div>
          <div class="kira-capture-nodes" data-role="node-list"></div>
          <div class="kira-capture-create" data-drop-target="create">
            <span>+</span>
            <input type="text" placeholder="Create or select node" autocomplete="off" />
          </div>
          <div class="kira-capture-combo-list" role="listbox"></div>
        </div>
      </div>
    </section>
  `
  wireCaptureWindow(pad)

  const style = document.createElement('style')
  style.textContent = `
    #${dropPadId} {
      position: fixed;
      left: var(--kira-drop-left, 50%);
      top: var(--kira-drop-top, 50%);
      z-index: 2147483647;
      display: grid;
      width: var(--kira-drop-width, min(760px, calc(100vw - 28px)));
      height: var(--kira-drop-height, 430px);
      color: #f1eee7;
      font: 14px/1.35 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      opacity: 0;
      pointer-events: none;
      transform: translateY(8px) scale(0.99);
      transition: opacity 140ms ease, transform 140ms ease;
      -webkit-font-smoothing: antialiased;
    }
    #${dropPadId}.is-visible {
      opacity: 1;
      pointer-events: auto;
      transform: translateY(0) scale(1);
    }
    #${dropPadId} * {
      box-sizing: border-box;
    }
    #${dropPadId} .kira-capture-window {
      display: grid;
      width: 100%;
      height: 100%;
      padding: 14px;
      border: 1px solid rgba(255, 255, 255, 0.13);
      border-radius: 13px;
      background: rgba(13, 14, 13, 0.97);
      box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(18px) saturate(1.08);
    }
    #${dropPadId} .kira-capture-layout {
      display: grid;
      grid-template-columns: minmax(290px, 1fr) minmax(260px, 1fr);
      height: 100%;
    }
    #${dropPadId} [data-drop-target] {
      border: 1px solid rgba(255, 255, 255, 0.06);
      background: rgba(21, 23, 22, 0.6);
      transition: background 120ms ease, border-color 120ms ease, transform 120ms ease;
    }
    #${dropPadId} [data-drop-target].is-over {
      border-color: rgba(132, 205, 188, 0.55);
      background: rgba(132, 205, 188, 0.14);
      transform: translateY(-1px);
    }
    #${dropPadId} .kira-capture-undecided {
      display: grid;
      justify-items: center;
      align-content: center;
      gap: 16px;
      margin-right: 14px;
      padding: 28px;
      border: 1px dashed rgba(255, 255, 255, 0.16);
      border-radius: 9px;
      background: #1b1e1c;
      text-align: center;
    }
    #${dropPadId} .kira-folder-mark {
      display: grid;
      width: 142px;
      height: 112px;
      place-items: center;
      border: 2px solid rgba(255, 255, 255, 0.1);
      border-radius: 18px;
      background: linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02));
      box-shadow: inset 0 0 0 8px rgba(255,255,255,0.05);
    }
    #${dropPadId} .kira-folder-mark span {
      display: grid;
      width: 54px;
      height: 54px;
      place-items: center;
      border: 1px solid rgba(132, 205, 188, 0.28);
      border-radius: 15px;
      color: #84cdbc;
      font-size: 28px;
      font-weight: 760;
      letter-spacing: 0;
    }
    #${dropPadId} .kira-capture-undecided strong {
      font-size: 17px;
      font-weight: 560;
    }
    #${dropPadId} .kira-capture-undecided span {
      color: #77766d;
      font-size: 13px;
    }
    #${dropPadId} .kira-capture-main {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr) auto auto;
      min-width: 0;
      border-left: 1px solid rgba(255, 255, 255, 0.06);
    }
    #${dropPadId} .kira-capture-brand {
      display: flex;
      align-items: baseline;
      gap: 10px;
      min-width: 0;
      padding: 10px 22px 8px;
    }
    #${dropPadId} .kira-capture-brand strong {
      color: #9edccd;
      font-size: 15px;
      font-weight: 760;
    }
    #${dropPadId} .kira-capture-brand span {
      overflow: hidden;
      color: #77766d;
      font-size: 12px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    #${dropPadId} .kira-capture-nodes {
      display: grid;
      align-content: start;
      overflow: auto;
    }
    #${dropPadId} .kira-node-card {
      display: flex;
      align-items: center;
      gap: 12px;
      min-height: 50px;
      padding: 8px 22px;
      border: 0;
      border-radius: 0;
      background: transparent;
      text-align: left;
    }
    #${dropPadId} .kira-node-card.is-over {
      background: rgba(132, 205, 188, 0.14);
    }
    #${dropPadId} .kira-node-icon {
      display: grid;
      width: 24px;
      height: 20px;
      flex: 0 0 auto;
      place-items: center;
      color: #f1eee7;
    }
    #${dropPadId} .kira-node-icon::before {
      content: "";
      width: 23px;
      height: 17px;
      border: 1.5px solid currentColor;
      border-radius: 3px;
      box-shadow: inset 0 5px 0 rgba(255, 255, 255, 0.05);
    }
    #${dropPadId} .kira-node-text {
      display: grid;
      gap: 1px;
      min-width: 0;
    }
    #${dropPadId} .kira-node-card strong {
      overflow: hidden;
      color: #f1eee7;
      font-size: 14px;
      font-weight: 520;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    #${dropPadId} .kira-node-card span {
      overflow: hidden;
      color: #77766d;
      font-size: 11px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    #${dropPadId} .kira-node-card img {
      width: 28px;
      height: 28px;
      object-fit: cover;
      border-radius: 5px;
      background: rgba(255,255,255,0.06);
    }
    #${dropPadId} .kira-capture-create {
      display: flex;
      align-items: center;
      gap: 12px;
      min-height: 68px;
      padding: 12px 22px;
      border-style: solid;
      border-width: 1px 0 0 0;
      border-color: rgba(255, 255, 255, 0.06);
      border-radius: 0 0 8px 0;
      background: #1b1e1c;
    }
    #${dropPadId} .kira-capture-create span {
      color: #f1eee7;
      font-size: 24px;
      line-height: 1;
    }
    #${dropPadId} .kira-capture-create input {
      width: 100%;
      min-width: 0;
      height: 36px;
      border: 0;
      outline: none;
      background: transparent;
      color: #f1eee7;
      font: inherit;
      font-size: 14px;
    }
    #${dropPadId} .kira-capture-create input:focus-visible {
      outline: 2px solid #84cdbc;
      outline-offset: 2px;
    }
    #${dropPadId} .kira-capture-combo-list {
      display: none;
      grid-template-columns: 1fr;
      max-height: 124px;
      overflow: auto;
      border-top: 1px solid rgba(255,255,255,0.06);
      background: #1b1e1c;
    }
    #${dropPadId}.is-combo-open .kira-capture-combo-list {
      display: grid;
    }
    #${toastId} {
      position: fixed;
      right: 18px;
      bottom: 112px;
      z-index: 2147483647;
      max-width: 260px;
      padding: 9px 11px;
      border-radius: 10px;
      background: rgba(13, 14, 13, 0.96);
      color: #f1eee7;
      font: 12px/1.35 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      opacity: 0;
      pointer-events: none;
      transform: translateY(6px);
      transition: opacity 130ms ease, transform 130ms ease;
    }
    #${toastId}.is-visible {
      opacity: 1;
      transform: translateY(0);
    }
  `

  document.documentElement.append(style, pad)
  return pad
}

function wireCaptureWindow(pad: HTMLElement) {
  const undecided = pad.querySelector<HTMLElement>('[data-drop-target="undecided"]')
  const create = pad.querySelector<HTMLElement>('[data-drop-target="create"]')
  const input = pad.querySelector<HTMLInputElement>('.kira-capture-create input')

  wireDropTarget(undecided, (dataTransfer) => {
    const capture = currentDroppedCapture(dataTransfer)
    if (!capture) return
    closeDropPad()
    void sendCapture({ ...capture, captureIntent: 'undecided' })
  })

  wireDropTarget(create, (dataTransfer) => {
    const capture = currentDroppedCapture(dataTransfer)
    if (!capture) return
    pendingComboCapture = { ...capture, captureIntent: 'create-or-select' }
    showCombo()
  })

  create?.addEventListener('mouseenter', () => {
    if (draggingCapture || lastPointerCapture || pendingComboCapture) {
      pendingComboCapture = pendingComboCapture ?? draggingCapture ?? lastPointerCapture
      showCombo()
    }
  })
  create?.addEventListener('dragenter', () => {
    pendingComboCapture = pendingComboCapture ?? draggingCapture ?? lastPointerCapture
    showCombo()
  })
  input?.addEventListener('focus', () => {
    pendingComboCapture = pendingComboCapture ?? draggingCapture ?? lastPointerCapture
    showCombo()
  })
  input?.addEventListener('input', renderComboOptions)
  input?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return
    const title = input.value.trim()
    if (!title || !pendingComboCapture) return
    event.preventDefault()
    const capture = pendingComboCapture
    closeDropPad()
    void sendCapture({ ...capture, createIdeaTitle: title, captureIntent: 'create-or-select' })
  })
}

function wireDropTarget(target: HTMLElement | null, onDrop: CaptureDropHandler) {
  if (!target) return
  pointerDropHandlers.set(target, onDrop)
  target.addEventListener('dragenter', (event) => {
    event.preventDefault()
    target.classList.add('is-over')
  })
  target.addEventListener('dragover', (event) => {
    event.preventDefault()
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
  })
  target.addEventListener('dragleave', () => {
    target.classList.remove('is-over')
  })
  target.addEventListener('drop', (event) => {
    event.preventDefault()
    event.stopPropagation()
    target.classList.remove('is-over')
    onDrop(event.dataTransfer)
  })
}

// Completes the pointer-fallback drag (see handlePointerMoveProbe): since no
// native drag session exists, wireDropTarget's own 'drop' listener never
// fires, so the target under the release point is resolved and invoked here.
// pointerup and mouseup both fire for the same physical release and aren't
// guaranteed to land in the same task, so the guard is cleared on the next
// press (rememberPointerCapture) rather than on a deferred timer, which could
// unlock between the two events and let the drop complete twice.
function handlePointerDropRelease(event: MouseEvent | PointerEvent) {
  if (!pointerDragWindowOpened || pointerDropCompleting) return
  pointerDropCompleting = true

  const releasedOn = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-drop-target]') : null
  const handler = releasedOn ? pointerDropHandlers.get(releasedOn) : undefined
  if (handler) {
    releasedOn?.classList.remove('is-over')
    handler(null)
    return
  }

  if (document.getElementById(dropPadId)?.classList.contains('is-visible')) {
    showToast('Thả đúng vào khung KIRA để lưu')
  }
  hideDropPadSoon()
}

function currentDroppedCapture(dataTransfer?: DataTransfer | null) {
  return draggingCapture ?? extractCaptureFromDrop(dataTransfer ?? null)
}

async function refreshCaptureContext(options: { force?: boolean } = {}) {
  const now = Date.now()
  if (!options.force && now - lastContextRefreshAt < 900) return
  if (contextRefreshPromise) return contextRefreshPromise

  contextRefreshPromise = (async () => {
    lastContextRefreshAt = now
    try {
      const response = await sendBridgeMessage({ type: 'kira-get-context' })
      if (!response?.ok || !response.context) throw new Error('KIRA unavailable')
      currentContext = response.context
      renderCaptureContext()
    } catch {
      currentContext = null
      renderCaptureContext()
    }
  })().finally(() => {
    contextRefreshPromise = null
  })

  return contextRefreshPromise
}

function renderCaptureContext() {
  const pad = document.getElementById(dropPadId)
  if (!pad) return
  const title = pad.querySelector<HTMLElement>('[data-role="file-title"]')
  const nodeList = pad.querySelector<HTMLElement>('[data-role="node-list"]')
  if (title) title.textContent = currentContext?.fileTitle || 'Open KIRA to target nodes'
  if (!nodeList) return

  nodeList.innerHTML = ''
  const nodes = Array.isArray(currentContext?.nodes) ? currentContext.nodes.slice(0, 24) : []
  if (nodes.length === 0) {
    nodeList.innerHTML = '<div class="kira-node-card" data-drop-target="empty"><span class="kira-node-icon"></span><span class="kira-node-text"><strong>No nodes loaded</strong><span>Open KIRA or restart the desktop app</span></span></div>'
    return
  }

  for (const node of nodes) {
    const card = document.createElement('div')
    card.className = 'kira-node-card'
    card.dataset.dropTarget = `node:${node.kind}:${node.id}`
    const meta = node.snippet || node.subtitle || node.kind
    card.innerHTML = `${node.thumb ? `<img src="${escapeHtml(node.thumb)}" alt="" />` : '<span class="kira-node-icon"></span>'}<span class="kira-node-text"><strong>${escapeHtml(node.title)}</strong>${meta ? `<span>${escapeHtml(meta)}</span>` : ''}</span>`
    wireDropTarget(card, (dataTransfer) => {
      const capture = currentDroppedCapture(dataTransfer)
      if (!capture) return
      closeDropPad()
      void sendCapture({ ...capture, targetNode: { kind: node.kind, id: node.id }, captureIntent: 'target-node' })
    })
    nodeList.append(card)
  }
}

function showCombo() {
  const pad = document.getElementById(dropPadId)
  const input = pad?.querySelector<HTMLInputElement>('.kira-capture-create input')
  if (!pad || !input) return
  window.clearTimeout(hideDropPadTimer)
  const wasOpen = pad.classList.contains('is-combo-open')
  pad.classList.add('is-combo-open')
  if (!wasOpen) input.value = ''
  renderComboOptions()
  window.setTimeout(() => input.focus(), 20)
}

function renderComboOptions() {
  const pad = document.getElementById(dropPadId)
  const input = pad?.querySelector<HTMLInputElement>('.kira-capture-create input')
  const list = pad?.querySelector<HTMLElement>('.kira-capture-combo-list')
  if (!input || !list) return

  const query = input.value.trim().toLowerCase()
  const contextNodes = Array.isArray(currentContext?.nodes) ? currentContext.nodes : []
  const nodes = contextNodes
    .filter((node) => node.kind === 'idea' || node.title.toLowerCase().includes(query))
    .filter((node) => !query || node.title.toLowerCase().includes(query) || node.kind.includes(query))
    .slice(0, 6)
  list.innerHTML = ''

  if (query) {
    list.append(comboButton(`Create "${input.value.trim()}"`, () => {
      if (!pendingComboCapture) return
      const capture = pendingComboCapture
      closeDropPad()
      void sendCapture({ ...capture, createIdeaTitle: input.value.trim(), captureIntent: 'create-or-select' })
    }))
  }

  for (const node of nodes) {
    list.append(comboButton(`${node.kind}: ${node.title}`, () => {
      if (!pendingComboCapture) return
      const capture = pendingComboCapture
      closeDropPad()
      void sendCapture({ ...capture, targetNode: { kind: node.kind, id: node.id }, captureIntent: 'create-or-select' })
    }))
  }
}

function comboButton(label: string, onClick: () => void) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'kira-node-card'
  button.textContent = label
  button.addEventListener('click', onClick)
  return button
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char] ?? char))
}

function extractCaptureFromDrop(dataTransfer: DataTransfer | null) {
  if (!dataTransfer) return null

  const kiraCapture = dataTransfer.getData('application/x-kira-capture')
  if (kiraCapture) {
    try {
      const parsed = JSON.parse(kiraCapture) as KiraCapturePayload
      if (parsed.kiraCapture === 1 && parsed.kind === 'image') return parsed
    } catch {
      // Ignore malformed page data.
    }
  }

  const html = dataTransfer.getData('text/html')
  const imageUrl = extractImageUrlFromHtml(html)
  if (imageUrl && isCaptureUrl(imageUrl)) {
    const absoluteUrl = new URL(imageUrl, location.href).toString()
    return {
      kiraCapture: 1,
      kind: 'image',
      url: absoluteUrl,
      title: document.title?.trim() || titleFromUrl(absoluteUrl),
      source: location.href,
      pageUrl: location.href,
      capturedAt: new Date().toISOString(),
    } satisfies KiraCapturePayload
  }

  const uri = dataTransfer.getData('text/uri-list') || dataTransfer.getData('text/plain')
  if (!isCaptureUrl(uri)) return null
  const absoluteUrl = new URL(uri, location.href).toString()
  return {
    kiraCapture: 1,
    kind: 'image',
    url: absoluteUrl,
    title: document.title?.trim() || titleFromUrl(absoluteUrl),
    source: location.href,
    pageUrl: location.href,
    capturedAt: new Date().toISOString(),
  } satisfies KiraCapturePayload
}

function extractImageUrlFromHtml(html: string) {
  if (!html.trim()) return null
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const image = doc.querySelector('img')
  const imageSrcset = image?.getAttribute('srcset') || ''
  return bestUrlFromSrcset(imageSrcset)
    || bestUrlFromSourceElements(Array.from(doc.querySelectorAll('source')))
    || image?.getAttribute('src')
    || null
}

async function sendCapture(capture: KiraCapturePayload) {
  capture = await resolveBestCapture(capture)
  if (await postCapture(capture)) {
    showToast('Saved to KIRA')
    return
  }

  const pendingCapture: PendingCapture = { ...capture, previewUrl: capture.url }
  await chrome.storage.local.set({ [pendingCaptureKey]: pendingCapture })
  showToast('Mở Kira App để sử dụng tính năng này')
}

async function resolveBestCapture(capture: KiraCapturePayload) {
  if (capture.kind !== 'image') return capture
  const enlargedUrl = await enlargePinterestUrl(capture.url)
  return enlargedUrl && enlargedUrl !== capture.url ? { ...capture, url: enlargedUrl } : capture
}

async function enlargePinterestUrl(value: string) {
  let url: URL
  try {
    url = new URL(value, location.href)
  } catch {
    return value
  }

  if (!url.hostname.includes('pinimg.com')) return value
  if (!/\.(jpg|png|webp)(?:$|\?)/i.test(url.href)) return value
  if (url.href.includes('75x75_RS')) return value

  const base = url.href
    .replace(/[0-9]+x/g, 'originals')
    .replace('/enabled/', '/')
    .replace('/enabled_lo/', '/')
    .replace('/enabled_hi/', '/')
    .replace('/control/', '/')
  const extension = base.match(/\.(jpg|png|webp)(?:$|\?)/i)?.[1] || 'jpg'
  const candidates = ['jpg', 'png', 'webp', 'gif'].map((candidate) =>
    base.replace(new RegExp(`\\.${extension}(?=$|\\?)`, 'i'), `.${candidate}`),
  )

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 3000)
  try {
    for (const candidate of candidates) {
      try {
        const response = await fetch(candidate, { method: 'HEAD', signal: controller.signal })
        if (response.ok) return response.url
      } catch {
        // Try the next candidate until the shared timeout aborts.
      }
    }
  } finally {
    window.clearTimeout(timeout)
  }

  return value
}

async function postCapture(capture: KiraCapturePayload) {
  const response = await sendBridgeMessage({ type: 'kira-post-capture', capture })
  return response?.ok === true
}

// A content script's fetch carries the page's origin, so the desktop app is
// reached through the service worker rather than directly from the page.
async function sendBridgeMessage(message: KiraBridgeMessage): Promise<KiraBridgeResponse | null> {
  try {
    return (await chrome.runtime.sendMessage(message)) as KiraBridgeResponse
  } catch {
    return null
  }
}

function showToast(message: string) {
  const toast = ensureToast()
  toast.textContent = message
  toast.classList.add('is-visible')
  window.setTimeout(() => toast.classList.remove('is-visible'), 1800)
}

function ensureToast() {
  const existing = document.getElementById(toastId)
  if (existing) return existing
  ensureDropPad()
  const toast = document.createElement('div')
  toast.id = toastId
  document.documentElement.append(toast)
  return toast
}

// docs/research/2026-11-09-pinterest-similar-flow.md §A, "Cập nhật
// 2026-11-10" phương án 3: lets KIRA's Settings show a Pinterest
// "Connections" row with the extension's last-seen login status. This
// NEVER reads a cookie, a URL, a name, or a picture — only whether a
// sign-in control or a profile control is present in the header, reduced
// to one bool. "Not confident" is reported as nothing at all, never a
// guess (schedulePinterestLoginCheck below only calls reportPinterestLoginSignal,
// which drops a null signal on the floor).
//
// Not verified against the live Pinterest DOM at the time of writing — this
// environment has no network access. The two detection helpers
// (findControlByAccessibleName / findProfileAvatarControl) are the only
// place this reads page structure; if Pinterest's header markup doesn't
// match what's assumed here, fix detection there without touching the
// messaging/debounce code below it.
const PINTEREST_LOG_IN_LABELS = ['log in', 'sign in', 'đăng nhập']
const PINTEREST_SIGN_UP_LABELS = ['sign up', 'đăng ký']

function isPinterestHost(hostname: string) {
  return hostname === 'pinterest.com' || hostname.endsWith('.pinterest.com')
}

function accessibleNameMatches(element: Element, labels: string[]) {
  const raw = (element.getAttribute('aria-label') ?? element.textContent ?? '').trim().toLowerCase()
  return labels.includes(raw)
}

function findControlByAccessibleName(scope: ParentNode, labels: string[]): Element | null {
  for (const element of scope.querySelectorAll('a, button')) {
    if (accessibleNameMatches(element, labels)) return element
  }
  return null
}

// A per-user entry point (the avatar) is, unlike "Log in", not something
// Pinterest labels consistently across locales — so this looks for its
// shape instead: a link/button carrying an <img> with a real (non-empty)
// alt, which a generic logo or decorative icon in the same header normally
// wouldn't have.
function findProfileAvatarControl(scope: ParentNode): Element | null {
  for (const control of scope.querySelectorAll('a, button')) {
    const image = control.querySelector('img[alt]')
    if (image && (image.getAttribute('alt') ?? '').trim().length > 0) return control
  }
  return null
}

/** `null` means "couldn't tell" — on a genuinely ambiguous header (both
    signals present, or neither), or any host other than pinterest.com. */
function detectPinterestLoginSignal(): boolean | null {
  if (!isPinterestHost(location.hostname)) return null
  const scope = document.querySelector('header') ?? document.body
  const hasLogInControl =
    findControlByAccessibleName(scope, PINTEREST_LOG_IN_LABELS) !== null ||
    findControlByAccessibleName(scope, PINTEREST_SIGN_UP_LABELS) !== null
  const hasProfileControl = findProfileAvatarControl(scope) !== null
  if (hasLogInControl && !hasProfileControl) return false
  if (hasProfileControl && !hasLogInControl) return true
  return null
}

// Only commits to lastSentPinterestLoggedIn once a send actually succeeds —
// a failed send (app closed) leaves it as-is, so the next DOM change (the
// MutationObserver below fires often on a page this dynamic) tries again,
// rather than the extension believing it already reported a status the app
// never received.
let lastSentPinterestLoggedIn: boolean | null = null

function reportPinterestLoginSignal() {
  const signal = detectPinterestLoginSignal()
  if (signal === null || signal === lastSentPinterestLoggedIn) return
  void sendBridgeMessage({ type: 'kira-post-connection', connection: { service: 'pinterest', loggedIn: signal } }).then(
    (response) => {
      if (response?.ok) lastSentPinterestLoggedIn = signal
    },
  )
}

let pinterestLoginCheckTimer: number | undefined

// Debounced: Pinterest's header keeps mutating as the SPA hydrates and as
// the user navigates (client-side routing doesn't reload this content
// script), so this runs again after a quiet moment rather than on every
// single mutation.
function schedulePinterestLoginCheck() {
  window.clearTimeout(pinterestLoginCheckTimer)
  pinterestLoginCheckTimer = window.setTimeout(reportPinterestLoginSignal, 600)
}

if (isPinterestHost(location.hostname)) {
  schedulePinterestLoginCheck()
  new MutationObserver(schedulePinterestLoginCheck).observe(document.documentElement, {
    childList: true,
    subtree: true,
  })
}
