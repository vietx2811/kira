/**
 * Run with: bun test apps/desktop/src/kira
 */
import { describe, expect, test } from 'bun:test'
import { findOpenSlotNearAnchor, type PlacedPoint } from './placeNode'

const ANCHOR: PlacedPoint = { x: 50, y: 50 }

function collidesAny(point: PlacedPoint, occupied: PlacedPoint[], stepX = 10, stepY = 12): boolean {
  return occupied.some((o) => Math.abs(o.x - point.x) < stepX * 0.75 && Math.abs(o.y - point.y) < stepY * 0.75)
}

describe('findOpenSlotNearAnchor', () => {
  test('empty board: lands exactly on the anchor', () => {
    expect(findOpenSlotNearAnchor({ anchor: ANCHOR, occupied: [] })).toEqual(ANCHOR)
  })

  test('reproduces the bug: 3 calls in a row, feeding each chosen point back in before the next (no render in between), never collide', () => {
    const occupied: PlacedPoint[] = []
    const placed: PlacedPoint[] = []
    for (let i = 0; i < 3; i++) {
      const point = findOpenSlotNearAnchor({ anchor: ANCHOR, occupied })
      expect(collidesAny(point, occupied)).toBe(false)
      occupied.push(point)
      placed.push(point)
    }
    // All 3 pairwise distinct (the actual symptom: captures 2 and 3 shared one spot).
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        expect(collidesAny(placed[i], [placed[j]])).toBe(false)
      }
    }
  })

  test('a board with 7+ existing nodes: the new point avoids all of them', () => {
    const occupied: PlacedPoint[] = Array.from({ length: 9 }, (_, i) => ({
      x: 20 + (i % 3) * 20,
      y: 20 + Math.floor(i / 3) * 20,
    }))
    const point = findOpenSlotNearAnchor({ anchor: ANCHOR, occupied })
    expect(collidesAny(point, occupied)).toBe(false)
  })

  test('the anchor itself already has a node on it: moves out to the first free ring', () => {
    const occupied: PlacedPoint[] = [ANCHOR]
    const point = findOpenSlotNearAnchor({ anchor: ANCHOR, occupied })
    expect(collidesAny(point, occupied)).toBe(false)
    expect(point).not.toEqual(ANCHOR)
  })

  test('anchor and its entire first ring are occupied: still finds a free spot on the second ring', () => {
    const occupied: PlacedPoint[] = [ANCHOR]
    // Saturate ring 1 by placing something at each of its 8 cells.
    for (const [gx, gy] of [
      [-1, -1], [0, -1], [1, -1],
      [-1, 0], [1, 0],
      [-1, 1], [0, 1], [1, 1],
    ] as const) {
      occupied.push({ x: ANCHOR.x + gx * 10, y: ANCHOR.y + gy * 12 })
    }
    const point = findOpenSlotNearAnchor({ anchor: ANCHOR, occupied })
    expect(collidesAny(point, occupied)).toBe(false)
  })

  test('a saturated board within maxRings still returns a point, never throws or hangs', () => {
    const occupied: PlacedPoint[] = []
    for (let gx = -8; gx <= 8; gx++) {
      for (let gy = -8; gy <= 8; gy++) {
        occupied.push({ x: 50 + gx * 10, y: 50 + gy * 12 })
      }
    }
    const point = findOpenSlotNearAnchor({ anchor: ANCHOR, occupied, maxRings: 8 })
    expect(Number.isFinite(point.x)).toBe(true)
    expect(Number.isFinite(point.y)).toBe(true)
  })

  test('clamps into [minX, maxX] / [minY, maxY] even when the anchor sits outside them', () => {
    const point = findOpenSlotNearAnchor({ anchor: { x: 150, y: -40 }, occupied: [] })
    expect(point.x).toBeLessThanOrEqual(92)
    expect(point.y).toBeGreaterThanOrEqual(8)
  })

  test('non-finite anchor coordinates do not produce NaN', () => {
    const point = findOpenSlotNearAnchor({ anchor: { x: Number.NaN, y: 50 }, occupied: [] })
    expect(Number.isFinite(point.x)).toBe(true)
    expect(Number.isFinite(point.y)).toBe(true)
  })
})
