/**
 * Pure arithmetic for "the middle of the canvas area the user can actually
 * see right now" — split out of main.tsx's fitGraphToContent (which already
 * computes the same visible area, "between the side panels, above the
 * bottom bar", to fit existing content into it) so the formula is
 * unit-testable (`bun test apps/desktop/src/kira`) without the app.
 *
 * Bug this fixes: main.tsx's bottom-toolbar node-creation buttons (Image
 * placeholder, Palette, Idea, Sticker, Frame) call their create*() function
 * with no position, which then falls back to a single hardcoded world x/y
 * (e.g. `{ x: 58, y: 42 }`). The canvas container is always full-window
 * (styles.css .library-drawer-panel is `position: absolute`, an overlay —
 * it does not shrink the canvas), so a fixed world position can land behind
 * an open Library panel regardless of the user's current pan/zoom. This
 * computes the actual on-screen visible area (same inset/clearance
 * constants fitGraphToContent uses) and converts its center through the
 * current pan/zoom back into a world x/y percent, matching how
 * eventPercent/pointerPercent already convert a screen point the other way.
 */

export type GraphTransform = { x: number; y: number; scale: number }

export type VisibleCanvasAreaInput = {
  /** canvasRef.current.getBoundingClientRect().width/height */
  canvasWidth: number
  canvasHeight: number
  /** --canvas-overlay-left-inset (Library panel width when open, else 0) */
  leftPanelInset: number
  /** --canvas-right-inset (Kira panel width + gutter when open, else 0) */
  rightPanelInset: number
  graphTransform: GraphTransform
}

// Same clearance/chrome constants as fitGraphToContent's own `area`: 32px
// breathing room past each side panel, 72px for the topbar, 96px for the
// bottom toolbar.
const SIDE_CLEARANCE = 32
const TOP_CLEARANCE = 72
const BOTTOM_CLEARANCE = 96

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 50
  return Math.min(92, Math.max(8, value))
}

export function visibleCanvasAreaCenterPercent(input: VisibleCanvasAreaInput): { x: number; y: number } {
  const { canvasWidth, canvasHeight, leftPanelInset, rightPanelInset, graphTransform } = input
  if (canvasWidth <= 0 || canvasHeight <= 0) return { x: 50, y: 50 }

  const areaLeft = leftPanelInset + SIDE_CLEARANCE
  const areaRight = Math.max(areaLeft, canvasWidth - rightPanelInset - SIDE_CLEARANCE)
  const areaTop = TOP_CLEARANCE
  const areaBottom = Math.max(areaTop, canvasHeight - BOTTOM_CLEARANCE)

  const centerClientX = (areaLeft + areaRight) / 2
  const centerClientY = (areaTop + areaBottom) / 2

  return {
    x: clampPercent(((centerClientX - graphTransform.x) / graphTransform.scale / canvasWidth) * 100),
    y: clampPercent(((centerClientY - graphTransform.y) / graphTransform.scale / canvasHeight) * 100),
  }
}
