import type { PageImageCandidate, PendingCapture, KiraCapturePayload } from './types'

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
const minWidthInput = document.getElementById('min-width') as HTMLInputElement
const minHeightInput = document.getElementById('min-height') as HTMLInputElement
const formatFilterInput = document.getElementById('format-filter') as HTMLSelectElement
const tagsInput = document.getElementById('capture-tags') as HTMLInputElement
const noteInput = document.getElementById('capture-note') as HTMLInputElement

let currentCapture: PendingCapture | null = null
let imageCandidates: PageImageCandidate[] = []
let selectedImageUrls = new Set<string>()

void loadCapture()

copyButton.addEventListener('click', async () => {
  const captures = selectedCaptures()
  if (captures.length === 0) return

  const sent = await sendCapturesToKira(captures)
  if (sent === captures.length) {
    statusNode.textContent = sent === 1 ? 'Sent to KIRA' : `${sent} sent to KIRA`
    return
  }

  try {
    await navigator.clipboard.writeText(captures.map((capture) => JSON.stringify(capture)).join('\n'))
    statusNode.textContent = 'KIRA unavailable. Copied'
  } catch {
    statusNode.textContent = 'KIRA unavailable'
  }
})

toggleImagesButton.addEventListener('click', () => {
  const filteredImages = filteredImageCandidates()
  if (filteredImages.every((image) => selectedImageUrls.has(image.url))) {
    selectedImageUrls = new Set()
  } else {
    selectedImageUrls = new Set(filteredImages.map((image) => image.url))
  }
  renderImageCandidates()
})

minWidthInput.addEventListener('input', renderImageCandidates)
minHeightInput.addEventListener('input', renderImageCandidates)
formatFilterInput.addEventListener('change', renderImageCandidates)

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
    kiraCapture: 1,
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
  const filteredImages = filteredImageCandidates()
  imageSection.hidden = imageCandidates.length === 0
  imageGrid.innerHTML = ''
  toggleImagesButton.textContent = filteredImages.length > 0 && filteredImages.every((image) => selectedImageUrls.has(image.url)) ? 'None' : 'All'

  for (const image of filteredImages) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = selectedImageUrls.has(image.url) ? 'image-option is-selected' : 'image-option'
    button.ariaLabel = image.alt || image.url
    button.title = `${image.width}x${image.height}`
    button.dataset.meta = `${image.width}x${image.height} ${image.format.toUpperCase()}`
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

  statusNode.textContent = filteredImages.length === imageCandidates.length
    ? 'Ready'
    : `${filteredImages.length}/${imageCandidates.length} images after filters`
}

function toClipboardPayload(capture: PendingCapture): KiraCapturePayload {
  return {
    kiraCapture: 1,
    kind: capture.kind,
    url: capture.url,
    title: capture.title,
    source: capture.source,
    pageUrl: capture.pageUrl,
    tags: captureTags(),
    note: captureNote(),
    capturedAt: capture.capturedAt,
  }
}

function selectedCaptures(): KiraCapturePayload[] {
  if (!currentCapture) return []
  const tags = captureTags()
  const note = captureNote()
  const imageCaptures = filteredImageCandidates()
    .filter((image) => selectedImageUrls.has(image.url))
    .map((image) => ({
      kiraCapture: 1 as const,
      kind: 'image' as const,
      url: image.url,
      title: image.alt || currentCapture?.title || 'Page image',
      source: currentCapture?.source || currentCapture?.url || image.url,
      pageUrl: currentCapture?.url,
      tags,
      note,
      capturedAt: new Date().toISOString(),
    }))

  if (imageCaptures.length > 0) return imageCaptures
  return [toClipboardPayload(currentCapture)]
}

async function sendCapturesToKira(captures: KiraCapturePayload[]) {
  let sent = 0
  for (const capture of captures) {
    if (await sendCaptureToKira(capture)) sent += 1
  }
  return sent
}

async function sendCaptureToKira(capture: KiraCapturePayload) {
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
            format: (() => {
              const url = image.currentSrc || image.src
              let path = ''
              try {
                path = new URL(url, location.href).pathname.toLowerCase()
              } catch {
                path = url.toLowerCase()
              }
              if (path.includes('.png')) return 'png'
              if (path.includes('.webp')) return 'webp'
              if (path.includes('.gif')) return 'gif'
              if (path.includes('.svg')) return 'svg'
              if (path.includes('.jpg') || path.includes('.jpeg')) return 'jpg'
              return image.currentSrc?.startsWith('data:image/')
                ? image.currentSrc.slice('data:image/'.length).split(';')[0].replace('jpeg', 'jpg')
                : 'jpg'
            })(),
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

function filteredImageCandidates() {
  const minWidth = Number(minWidthInput.value) || 0
  const minHeight = Number(minHeightInput.value) || 0
  const format = formatFilterInput.value
  return imageCandidates.filter((image) =>
    image.width >= minWidth
    && image.height >= minHeight
    && (format === 'all' || image.format === format),
  )
}

function captureTags() {
  return tagsInput.value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 12)
}

function captureNote() {
  return noteInput.value.trim() || undefined
}
