export type KiraCapturePayload = {
  kiraCapture: 1
  kind: 'image' | 'page'
  url: string
  title: string
  source: string
  pageUrl?: string
  // Open Graph preview image for a page capture (kind: 'page') — the app
  // uses this as the thumbnail instead of the page's own URL.
  imageUrl?: string
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

// docs/research/2026-11-09-pinterest-similar-flow.md §A, "Cập nhật
// 2026-11-10" phương án 3. Deliberately the only two fields: never a
// cookie, a URL, a name, or a picture (CLAUDE.md "Ràng buộc đã chốt" + this
// task's own hard constraints). `service` is a closed union, not `string`,
// so adding a second connected service later is a type change here, not a
// typo waiting to happen. Mirrors KNOWN_CONNECTION_SERVICES in lib.rs and
// KiraConnectionPayload in apps/desktop/src/kira/pinterestConnection.ts.
export type KiraConnectionPayload = {
  service: 'pinterest'
  loggedIn: boolean
}

/**
 * Every request to the desktop app goes through the service worker.
 * A content script's fetch runs with the page's origin, so from Chrome 142 a
 * direct call to 127.0.0.1 is subject to the Local Network Access prompt; the
 * service worker is covered by the extension's own host_permissions instead.
 */
export type KiraBridgeMessage =
  | { type: 'kira-post-capture'; capture: KiraCapturePayload }
  | { type: 'kira-post-connection'; connection: KiraConnectionPayload }
  | { type: 'kira-get-context' }
  | { type: 'kira-open-drag-window'; capture: PendingCapture }
  // background.ts has no DOM of its own (service worker) — this relays a
  // user-facing toast to the tab's content script for paths it can't show
  // feedback on directly, e.g. the native "Capture Image to KIRA" context
  // menu item rejecting an embedded (data:/blob:) image.
  | { type: 'kira-show-toast'; message: string }
  // The save-hovered-image keyboard command fires in background.ts (there's
  // no DOM there either), so it asks the content script — the only place
  // that knows what's currently hovered — to do the actual capture.
  | { type: 'kira-save-hovered-image' }

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
