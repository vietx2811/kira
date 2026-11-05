/**
 * Run with: bun test apps/desktop/src/kira
 */
import { describe, expect, test } from 'bun:test'
import { edgeLabelText, placeEdgeLabels } from './edgeLabels'

describe('placeEdgeLabels', () => {
  test('labels that share a midpoint line are pushed apart, not stacked', () => {
    // Three edges from one row to the next: same y, x close together.
    const placements = placeEdgeLabels(
      [
        { id: 'a', x: 40, y: 30, text: 'định hình câu chuyện' },
        { id: 'b', x: 46, y: 30, text: 'thực đơn là sản phẩm' },
        { id: 'c', x: 52, y: 30, text: 'xác định đối tượng' },
      ],
      1200,
      800,
    )
    const shown = [...placements.values()].filter((spot) => spot.shown)
    expect(shown.length).toBeGreaterThanOrEqual(2)
    // No two shown labels at the same height when they are this close.
    const ys = shown.map((spot) => spot.y.toFixed(2))
    expect(new Set(ys).size).toBe(ys.length)
  })

  test('labels far apart keep their midpoints', () => {
    const placements = placeEdgeLabels(
      [
        { id: 'a', x: 20, y: 30, text: 'gần' },
        { id: 'b', x: 80, y: 30, text: 'xa' },
      ],
      1200,
      800,
    )
    expect(placements.get('a')).toEqual({ x: 20, y: 30, shown: true })
    expect(placements.get('b')).toEqual({ x: 80, y: 30, shown: true })
  })

  test('a label with no free slot nearby falls back to the joint dot', () => {
    const crowd = Array.from({ length: 8 }, (_, index) => ({ id: `l${index}`, x: 50, y: 50, text: 'cùng một chỗ' }))
    const placements = placeEdgeLabels(crowd, 1200, 800)
    expect([...placements.values()].some((spot) => !spot.shown)).toBeTruthy()
  })
})

describe('placeEdgeLabels keeps labels off cards', () => {
  test('a label whose midpoint is on a card moves to a free slot beside it', () => {
    // A card centred at (50, 40), 20% wide and 10% tall; the edge midpoint is
    // on its bottom edge.
    const placements = placeEdgeLabels([{ id: 'a', x: 50, y: 44, text: 'chất liệu câu chuyện' }], 1200, 800, [
      { x: 50, y: 40, w: 20, h: 10 },
    ])
    const spot = placements.get('a')!
    expect(spot.shown).toBeTruthy()
    // Clear of the card: below its bottom edge (45) or above its top (35).
    const half = (22 / 800) * 100 / 2
    expect(spot.y - half >= 45 || spot.y + half <= 35).toBeTruthy()
  })

  test('a label already clear of every card stays at its midpoint', () => {
    const placements = placeEdgeLabels([{ id: 'a', x: 50, y: 60, text: 'gần' }], 1200, 800, [{ x: 50, y: 40, w: 20, h: 10 }])
    expect(placements.get('a')).toEqual({ x: 50, y: 60, shown: true })
  })
})

test('edgeLabelText cuts long labels to a few words', () => {
  expect(edgeLabelText('menu quyết định band giá cho khách trẻ')).toBe('menu quyết định band gi…')
  expect(edgeLabelText('  ngắn  ')).toBe('ngắn')
})
