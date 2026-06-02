export type VixioCapturePayload = {
  vixioCapture: 1
  kind: 'image' | 'page'
  url: string
  title: string
  source: string
  pageUrl?: string
  capturedAt: string
}

export type PendingCapture = VixioCapturePayload & {
  previewUrl?: string
}

export type PageImageCandidate = {
  url: string
  width: number
  height: number
  alt: string
}
