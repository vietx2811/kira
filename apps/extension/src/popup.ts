import type { PageImageCandidate, PendingCapture, VixioCapturePayload } from './types'

const pendingCaptureKey = 'pendingCapture'
const captureEndpoint = 'http://127.0.0.1:47653/capture'

const kindNode = document.getElementById('capture-kind') as HTMLSpanElement
const titleNode = document.getElementById('capture-title') as HTMLHeadingElement
const sourceNode = document.getElementById('capture-source') as HTMLParagraphElement
const previewNode = document.getElementById('capture-preview') as HTMLImageElement
const copyButton = document.getElementById('copy-capture') as HTMLButtonElement
const statusNode = document.getElementById('status') as HTMLParagraphElement
const imageSection = document.getElementById('image-section') as HTMLElement
const imageGrid = document.getElementById('image-grid') as HTMLDivElement
const toggleImagesButton = document.getElementById('toggle-images') as HTMLButtonElement

let currentCapture: PendingCapture | null = null
let imageCandidates: PageImageCandidate[] = []
let selectedImageUrls = new Set<string>()

void loadCapture()

copyButton.addEventListener('click', async () => {
  const captures = selectedCaptures()
  if (captures.length === 0) return

  const sent = await sendCapturesToVixio(captures)
  if (sent === captures.length) {
    statusNode.textContent = sent === 1 ? 'Sent to Vixio' : `${sent} sent to Vixio`
    return
  }

  try {
    await navigator.clipboard.writeText(captures.map((capture) => JSON.stringify(capture)).join('\n'))
    statusNode.textContent = 'Vixio unavailable. Copied'
  } catch {
    statusNode.textContent = 'Vixio unavailable'
  }
})

toggleImagesButton.addEventListener('click', () => {
  if (selectedImageUrls.size === imageCandidates.length) {
    selectedImageUrls = new Set()
  } else {
    selectedImageUrls = new Set(imageCandidates.map((image) => image.url))
  }
  renderImageCandidates()
})

async function loadCapture() {
  const stored = await chrome.storage.local.get<{ pendingCapture?: PendingCapture }>([pendingCaptureKey])
  currentCapture = stored.pendingCapture ?? (await captureActiveTab())
  imageCandidates = await discoverPageImages()
  selectedImageUrls = new Set(currentCapture?.kind === 'image' ? [currentCapture.url] : imageCandidates.slice(0, 3).map((image) => image.url))
  renderCapture(currentCapture)
  renderImageCandidates()
}

async function captureActiveTab(): Promise<PendingCapture | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.url) return null

  return {
    vixioCapture: 1,
    kind: 'page',
    url: tab.url,
    title: tab.title?.trim() || 'Untitled',
    source: tab.url,
    capturedAt: new Date().toISOString(),
  }
}

function renderCapture(capture: PendingCapture | null) {
  if (!capture) {
    copyButton.disabled = true
    titleNode.textContent = 'No active tab'
    sourceNode.textContent = ''
    statusNode.textContent = 'Open a page first'
    return
  }

  kindNode.textContent = capture.kind === 'image' ? 'Image' : 'Page'
  titleNode.textContent = capture.title
  sourceNode.textContent = capture.source
  copyButton.disabled = false
  statusNode.textContent = 'Ready'

  if (capture.previewUrl) {
    previewNode.hidden = false
    previewNode.src = capture.previewUrl
  } else {
    previewNode.hidden = true
    previewNode.removeAttribute('src')
  }
}

function renderImageCandidates() {
  imageSection.hidden = imageCandidates.length === 0
  imageGrid.innerHTML = ''
  toggleImagesButton.textContent = selectedImageUrls.size === imageCandidates.length ? 'None' : 'All'

  for (const image of imageCandidates) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = selectedImageUrls.has(image.url) ? 'image-option is-selected' : 'image-option'
    button.ariaLabel = image.alt || image.url
    button.title = `${image.width}x${image.height}`
    button.addEventListener('click', () => {
      if (selectedImageUrls.has(image.url)) {
        selectedImageUrls.delete(image.url)
      } else {
        selectedImageUrls.add(image.url)
      }
      renderImageCandidates()
    })

    const img = document.createElement('img')
    img.src = image.url
    img.alt = ''
    button.append(img)
    imageGrid.append(button)
  }
}

function toClipboardPayload(capture: PendingCapture): VixioCapturePayload {
  return {
    vixioCapture: 1,
    kind: capture.kind,
    url: capture.url,
    title: capture.title,
    source: capture.source,
    pageUrl: capture.pageUrl,
    capturedAt: capture.capturedAt,
  }
}

function selectedCaptures(): VixioCapturePayload[] {
  if (!currentCapture) return []
  const imageCaptures = imageCandidates
    .filter((image) => selectedImageUrls.has(image.url))
    .map((image) => ({
      vixioCapture: 1 as const,
      kind: 'image' as const,
      url: image.url,
      title: image.alt || currentCapture?.title || 'Page image',
      source: currentCapture?.source || currentCapture?.url || image.url,
      pageUrl: currentCapture?.url,
      capturedAt: new Date().toISOString(),
    }))

  if (imageCaptures.length > 0) return imageCaptures
  return [toClipboardPayload(currentCapture)]
}

async function sendCapturesToVixio(captures: VixioCapturePayload[]) {
  let sent = 0
  for (const capture of captures) {
    if (await sendCaptureToVixio(capture)) sent += 1
  }
  return sent
}

async function sendCaptureToVixio(capture: VixioCapturePayload) {
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

async function discoverPageImages(): Promise<PageImageCandidate[]> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) return []

  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () =>
        Array.from(document.images)
          .map((image) => ({
            url: image.currentSrc || image.src,
            width: image.naturalWidth,
            height: image.naturalHeight,
            alt: image.alt || image.title || '',
          }))
          .filter((image) => image.url && image.width >= 160 && image.height >= 120)
          .slice(0, 20),
    })
    return dedupeImages(result?.result ?? [])
  } catch {
    return []
  }
}

function dedupeImages(images: PageImageCandidate[]) {
  const seen = new Set<string>()
  return images.filter((image) => {
    if (seen.has(image.url)) return false
    seen.add(image.url)
    return true
  })
}
