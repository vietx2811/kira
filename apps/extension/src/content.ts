type KiraCaptureNodeKind = 'idea' | 'image' | 'palette' | 'diagram' | 'placeholder'

type KiraCapturePayload = {
  kiraCapture: 1
  kind: 'image' | 'page'
  url: string
  title: string
  source: string
  pageUrl?: string
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

const captureEndpoint = 'http://127.0.0.1:47653/capture'
const contextEndpoint = 'http://127.0.0.1:47653/context'
const pendingCaptureKey = 'pendingCapture'
const dropPadId = 'kira-capture-drop-pad'
const toastId = 'kira-capture-toast'

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

document.addEventListener('pointerdown', rememberPointerCapture, true)
document.addEventListener('mousedown', rememberPointerCapture, true)
document.addEventListener('pointermove', handlePointerMoveProbe, true)
document.addEventListener('pointerup', clearPointerCapture, true)
document.addEventListener('mouseup', clearPointerCapture, true)
document.addEventListener('dragstart', handleDragStart, true)
document.addEventListener('dragenter', handleDocumentDragProbe, true)
document.addEventListener('dragover', handleDocumentDragProbe, true)
document.addEventListener('dragleave', handleDocumentDragLeave, true)
document.addEventListener('dragend', hideDropPadSoon, true)
document.addEventListener('drop', hideDropPadSoon, true)
document.addEventListener('contextmenu', handleAltContextMenu, true)

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
  if (!capture) return

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
    return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'data:'
  } catch {
    return false
  }
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
  pad.classList.add('is-visible')
  void refreshCaptureContext({ force: !isAlreadyVisible })
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
      color: #181b1a;
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
      border: 1px solid rgba(0, 0, 0, 0.18);
      border-radius: 13px;
      background: rgba(249, 249, 247, 0.98);
      box-shadow: 0 24px 64px rgba(0, 0, 0, 0.34);
      backdrop-filter: blur(18px) saturate(1.08);
    }
    #${dropPadId} .kira-capture-layout {
      display: grid;
      grid-template-columns: minmax(290px, 1fr) minmax(260px, 1fr);
      height: 100%;
    }
    #${dropPadId} [data-drop-target] {
      border: 1px solid rgba(0, 0, 0, 0.08);
      background: rgba(255, 255, 255, 0.7);
      transition: background 120ms ease, border-color 120ms ease, transform 120ms ease;
    }
    #${dropPadId} [data-drop-target].is-over {
      border-color: rgba(58, 121, 106, 0.5);
      background: rgba(232, 247, 243, 0.9);
      transform: translateY(-1px);
    }
    #${dropPadId} .kira-capture-undecided {
      display: grid;
      justify-items: center;
      align-content: center;
      gap: 16px;
      margin-right: 14px;
      padding: 28px;
      border: 1px dashed rgba(0, 0, 0, 0.24);
      border-radius: 9px;
      background: #f5f5f3;
      text-align: center;
    }
    #${dropPadId} .kira-folder-mark {
      display: grid;
      width: 142px;
      height: 112px;
      place-items: center;
      border: 2px solid rgba(24, 27, 26, 0.12);
      border-radius: 18px;
      background: linear-gradient(180deg, rgba(255,255,255,0.82), rgba(235,236,232,0.78));
      box-shadow: inset 0 0 0 8px rgba(255,255,255,0.38);
    }
    #${dropPadId} .kira-folder-mark span {
      display: grid;
      width: 54px;
      height: 54px;
      place-items: center;
      border: 1px solid rgba(58, 121, 106, 0.18);
      border-radius: 15px;
      color: #3a796a;
      font-size: 28px;
      font-weight: 760;
      letter-spacing: 0;
    }
    #${dropPadId} .kira-capture-undecided strong {
      font-size: 17px;
      font-weight: 560;
    }
    #${dropPadId} .kira-capture-undecided span {
      color: #8a8c89;
      font-size: 13px;
    }
    #${dropPadId} .kira-capture-main {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr) auto auto;
      min-width: 0;
      border-left: 1px solid rgba(0, 0, 0, 0.1);
    }
    #${dropPadId} .kira-capture-brand {
      display: flex;
      align-items: baseline;
      gap: 10px;
      min-width: 0;
      padding: 10px 22px 8px;
    }
    #${dropPadId} .kira-capture-brand strong {
      color: #3a796a;
      font-size: 15px;
      font-weight: 760;
    }
    #${dropPadId} .kira-capture-brand span {
      overflow: hidden;
      color: #8a8c89;
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
      background: rgba(232, 247, 243, 0.9);
    }
    #${dropPadId} .kira-node-icon {
      display: grid;
      width: 24px;
      height: 20px;
      flex: 0 0 auto;
      place-items: center;
      color: #181b1a;
    }
    #${dropPadId} .kira-node-icon::before {
      content: "";
      width: 23px;
      height: 17px;
      border: 1.5px solid currentColor;
      border-radius: 3px;
      box-shadow: inset 0 5px 0 rgba(24, 27, 26, 0.04);
    }
    #${dropPadId} .kira-node-text {
      display: grid;
      gap: 1px;
      min-width: 0;
    }
    #${dropPadId} .kira-node-card strong {
      overflow: hidden;
      color: #181b1a;
      font-size: 14px;
      font-weight: 520;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    #${dropPadId} .kira-node-card span {
      overflow: hidden;
      color: #8a8c89;
      font-size: 11px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    #${dropPadId} .kira-node-card img {
      width: 28px;
      height: 28px;
      object-fit: cover;
      border-radius: 5px;
      background: rgba(0,0,0,0.08);
    }
    #${dropPadId} .kira-capture-create {
      display: flex;
      align-items: center;
      gap: 12px;
      min-height: 68px;
      padding: 12px 22px;
      border-width: 1px 0 0 0;
      border-radius: 0 0 8px 0;
      background: #fbfbfa;
    }
    #${dropPadId} .kira-capture-create span {
      color: #181b1a;
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
      color: #181b1a;
      font: inherit;
      font-size: 14px;
    }
    #${dropPadId} .kira-capture-combo-list {
      display: none;
      grid-template-columns: 1fr;
      max-height: 124px;
      overflow: auto;
      border-top: 1px solid rgba(0,0,0,0.08);
      background: #fbfbfa;
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
      background: rgba(13, 15, 14, 0.94);
      color: #f2f4ef;
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

  wireDropTarget(undecided, (event) => {
    const capture = currentDroppedCapture(event.dataTransfer)
    if (!capture) return
    closeDropPad()
    void sendCapture({ ...capture, captureIntent: 'undecided' })
  })

  wireDropTarget(create, (event) => {
    const capture = currentDroppedCapture(event.dataTransfer)
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

function wireDropTarget(target: HTMLElement | null, onDrop: (event: DragEvent) => void) {
  if (!target) return
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
    onDrop(event)
  })
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
      const response = await fetch(contextEndpoint, { method: 'GET' })
      if (!response.ok) return
      currentContext = (await response.json()) as KiraCaptureContext
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
    wireDropTarget(card, (event) => {
      const capture = currentDroppedCapture(event.dataTransfer)
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
  try {
    await navigator.clipboard.writeText(JSON.stringify(capture))
    showToast('KIRA unavailable. Capture copied.')
  } catch {
    showToast('KIRA unavailable. Open extension popup.')
  }
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
