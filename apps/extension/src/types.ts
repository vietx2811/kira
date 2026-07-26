export type KiraCapturePayload = {
  kiraCapture: 1
  kind: 'image' | 'page'
  url: string
  title: string
  source: string
  pageUrl?: string
  tags?: string[]
  note?: string
  targetNode?: KiraCaptureNodeRef
  createIdeaTitle?: string
  captureIntent?: 'undecided' | 'target-node' | 'create-or-select'
  capturedAt: string
}

export type PendingCapture = KiraCapturePayload & {
  previewUrl?: string
}

export type PageImageCandidate = {
  url: string
  width: number
  height: number
  alt: string
  format: string
}

export type KiraCaptureNodeKind = 'idea' | 'image' | 'palette' | 'diagram' | 'placeholder'

export type KiraCaptureNodeRef = {
  kind: KiraCaptureNodeKind
  id: string
}

export type KiraCaptureNode = KiraCaptureNodeRef & {
  title: string
  subtitle?: string
  thumb?: string
}

/**
 * Every request to the desktop app goes through the service worker.
 * A content script's fetch runs with the page's origin, so from Chrome 142 a
 * direct call to 127.0.0.1 is subject to the Local Network Access prompt; the
 * service worker is covered by the extension's own host_permissions instead.
 */
export type KiraBridgeMessage =
  | { type: 'kira-post-capture'; capture: KiraCapturePayload }
  | { type: 'kira-get-context' }
  | { type: 'kira-open-drag-window'; capture: PendingCapture }

export type KiraBridgeResponse =
  | { ok: true; context?: KiraCaptureContext | null }
  | { ok: false }

export type KiraCaptureContext = {
  app: 'kira'
  fileTitle: string
  filePath?: string
  nodes: KiraCaptureNode[]
  updatedAt: string
}
