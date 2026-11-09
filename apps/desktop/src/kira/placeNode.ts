/**
 * Pure "find an empty spot near an anchor point" placement for newly
 * created/imported nodes, split out so it's unit-testable (`bun test
 * apps/desktop/src/kira`) without the app.
 *
 * Replaces the old per-kind "slot index" math (`Math.max(0, index -
 * imagesSeed.length)`, a column/row grid keyed to a global counter) that
 * main.tsx's createReferenceFromCapture/File/Url all duplicated — that
 * approach broke two ways reported live:
 *   1. `handleKiraCapture` computed `index` from
 *      `projectStateRef.current.images.length`, a ref that only updates on
 *      the NEXT render. Three browser-extension captures arriving a few ms
 *      apart (three separate Tauri IPC events) all read the same stale
 *      length before React had a chance to re-render between them, so all
 *      three got the same `index` and landed on the same x/y.
 *   2. Even with a correct index, the slot formula is just a fixed column/
 *      row grid with no awareness of what's actually already on the board
 *      — a new node (including ones created via the bottom toolbar, not
 *      just captures) could land exactly on top of an existing one.
 *
 * This fixes both by taking the actual occupied positions as input (not an
 * index) and scanning outward from an anchor point (the visible canvas's
 * center — see kira/visibleCanvasCenter.ts) in a square-ring spiral until
 * it finds a spot that doesn't collide with anything already there. The
 * caller is responsible for including not-yet-rendered placements (chosen
 * earlier in the same rapid-fire burst, before React has committed them)
 * in `occupied` — see main.tsx's pendingPlacementsRef.
 */

export type PlacedPoint = { x: number; y: number }

export type FindOpenSlotNearAnchorInput = {
  anchor: PlacedPoint
  /** Every node's current x/y, including ones chosen earlier in the same
      burst but not yet reflected in React state. */
  occupied: PlacedPoint[]
  /** World-percent footprint a node is assumed to need clear around it.
      Two points closer than 0.75x these steps on BOTH axes are treated as
      colliding. Defaults roughly match the old grid's own column/row
      spacing (9/14). */
  stepX?: number
  stepY?: number
  minX?: number
  maxX?: number
  minY?: number
  maxY?: number
  /** Safety cap — past this many rings out, give up searching and return
      the best candidate found (or the clamped anchor itself) rather than
      scanning forever on a saturated board. */
  maxRings?: number
}

const DEFAULT_STEP_X = 10
const DEFAULT_STEP_Y = 12
const DEFAULT_MIN = 8
const DEFAULT_MAX = 92
const DEFAULT_MAX_RINGS = 8
const COLLISION_FACTOR = 0.75

function clampWorld(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return (min + max) / 2
  return Math.min(max, Math.max(min, value))
}

function collides(a: PlacedPoint, b: PlacedPoint, stepX: number, stepY: number): boolean {
  return Math.abs(a.x - b.x) < stepX * COLLISION_FACTOR && Math.abs(a.y - b.y) < stepY * COLLISION_FACTOR
}

/** Grid offsets (in step units) forming the square ring at Chebyshev
    distance `ring` from the origin — ring 0 is just the origin itself. */
function ringOffsets(ring: number): Array<[number, number]> {
  if (ring === 0) return [[0, 0]]
  const offsets: Array<[number, number]> = []
  for (let gx = -ring; gx <= ring; gx++) {
    offsets.push([gx, -ring])
    offsets.push([gx, ring])
  }
  for (let gy = -ring + 1; gy <= ring - 1; gy++) {
    offsets.push([-ring, gy])
    offsets.push([ring, gy])
  }
  return offsets
}

export function findOpenSlotNearAnchor(input: FindOpenSlotNearAnchorInput): PlacedPoint {
  const {
    anchor,
    occupied,
    stepX = DEFAULT_STEP_X,
    stepY = DEFAULT_STEP_Y,
    minX = DEFAULT_MIN,
    maxX = DEFAULT_MAX,
    minY = DEFAULT_MIN,
    maxY = DEFAULT_MAX,
    maxRings = DEFAULT_MAX_RINGS,
  } = input

  const clampedAnchor = { x: clampWorld(anchor.x, minX, maxX), y: clampWorld(anchor.y, minY, maxY) }
  let fallback = clampedAnchor

  for (let ring = 0; ring <= maxRings; ring++) {
    for (const [gx, gy] of ringOffsets(ring)) {
      const candidate = {
        x: clampWorld(anchor.x + gx * stepX, minX, maxX),
        y: clampWorld(anchor.y + gy * stepY, minY, maxY),
      }
      if (!occupied.some((point) => collides(candidate, point, stepX, stepY))) {
        return candidate
      }
      if (ring === maxRings) fallback = candidate
    }
  }
  return fallback
}
