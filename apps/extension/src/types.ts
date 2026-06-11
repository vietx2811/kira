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

export type KiraCaptureContext = {
  app: 'kira'
  fileTitle: string
  filePath?: string
  nodes: KiraCaptureNode[]
  updatedAt: string
}
