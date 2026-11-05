// Where to draw link labels so they can be read. A label sits at its edge's
// midpoint, but edges from one row to the next share a midpoint height, so on
// an AI-drafted board their labels landed on one line and covered each other
// and the cards (measured on a 9-node draft, 2026-11-06). Here each label is
// placed in turn, nudged up or down past the ones already placed, and left
// as the plain joint dot when no nearby slot is free.

export type EdgeLabelInput = { id: string; x: number; y: number; text: string }
export type EdgeLabelPlacement = { x: number; y: number; shown: boolean }

// Shown text: the label, cut to a few words' width; the full text goes in the
// joint's tooltip and accessible name.
export const EDGE_LABEL_MAX_CHARS = 24

export function edgeLabelText(text: string) {
  const clean = text.trim()
  return clean.length > EDGE_LABEL_MAX_CHARS ? `${clean.slice(0, EDGE_LABEL_MAX_CHARS - 1).trimEnd()}…` : clean
}

// Rough label box in px for the 11px label type: per-character width plus
// padding and border. Generous on purpose; an overlap costs more than a gap.
function boxPx(text: string) {
  return { width: edgeLabelText(text).length * 6.4 + 18, height: 22 }
}

export function placeEdgeLabels(
  labels: EdgeLabelInput[],
  stageWidthPx: number,
  stageHeightPx: number,
): Map<string, EdgeLabelPlacement> {
  const placed: { x: number; y: number; w: number; h: number }[] = []
  const result = new Map<string, EdgeLabelPlacement>()
  if (stageWidthPx <= 0 || stageHeightPx <= 0) {
    for (const label of labels) result.set(label.id, { x: label.x, y: label.y, shown: true })
    return result
  }
  const overlaps = (x: number, y: number, w: number, h: number) =>
    placed.some((other) => Math.abs(other.x - x) < (other.w + w) / 2 + 0.4 && Math.abs(other.y - y) < (other.h + h) / 2 + 0.3)

  const ordered = [...labels].sort((a, b) => a.y - b.y || a.x - b.x)
  for (const label of ordered) {
    const px = boxPx(label.text)
    const w = (px.width / stageWidthPx) * 100
    const h = (px.height / stageHeightPx) * 100
    // Midpoint first, then alternately below and above it, a label height at a time.
    const offsets = [0, 1, -1, 2, -2]
    const slot = offsets.map((step) => label.y + step * h * 1.15).find((y) => !overlaps(label.x, y, w, h))
    if (slot === undefined) {
      result.set(label.id, { x: label.x, y: label.y, shown: false })
      continue
    }
    placed.push({ x: label.x, y: slot, w, h })
    result.set(label.id, { x: label.x, y: slot, shown: true })
  }
  return result
}
