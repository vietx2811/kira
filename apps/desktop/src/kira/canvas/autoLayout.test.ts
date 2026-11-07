import { describe, expect, test } from 'bun:test'
import { autoLayout, countCrossings, findMindmapTree, type AutoLayoutEdge, type AutoLayoutNode } from './autoLayout'

// Bun defines `self`, so ELK's bundled worker thinks it runs inside a Web
// Worker and exports nothing. Hide it while ELK builds its in-process worker.
const savedSelf = (globalThis as { self?: unknown }).self
delete (globalThis as { self?: unknown }).self
const { default: ELK } = await import('elkjs/lib/elk.bundled.js')
const elk = new ELK()
;(globalThis as { self?: unknown }).self = savedSelf
const card = (key: string, width = 240, height = 120): AutoLayoutNode => ({ key, width, height })

function overlaps(nodes: AutoLayoutNode[], positions: Map<string, { x: number; y: number }>) {
  let count = 0
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const a = nodes[i]
      const b = nodes[j]
      const p = positions.get(a.key)!
      const q = positions.get(b.key)!
      if (Math.abs(p.x - q.x) < (a.width + b.width) / 2 && Math.abs(p.y - q.y) < (a.height + b.height) / 2) count += 1
    }
  }
  return count
}

describe('autoLayout', () => {
  test('a tree becomes a two-sided mindmap around its hub', async () => {
    const nodes = ['hub', 'a', 'b', 'c', 'd', 'a1', 'a2', 'c1'].map((key) => card(key))
    const edges: AutoLayoutEdge[] = [
      { source: 'hub', target: 'a', relation: 'contains' },
      { source: 'hub', target: 'b', relation: 'contains' },
      { source: 'c', target: 'hub', relation: 'supports' },
      { source: 'hub', target: 'd', relation: 'derived-from' },
      { source: 'a', target: 'a1', relation: 'example' },
      { source: 'a', target: 'a2', relation: 'example' },
      { source: 'c', target: 'c1', relation: 'contrasts' },
    ]
    const result = await autoLayout(elk, nodes, edges)
    expect(result.shape).toBe('mindmap')
    const hub = result.positions.get('hub')!
    const sides = ['a', 'b', 'c', 'd'].map((key) => Math.sign(result.positions.get(key)!.x - hub.x))
    expect(sides).toContain(1)
    expect(sides).toContain(-1)
    expect(overlaps(nodes, result.positions)).toBe(0)
    expect(result.crossings).toBe(0)
  })

  test('"related" links do not stop a tree from being a mindmap', () => {
    const nodes = ['hub', 'a', 'b', 'c', 'a1'].map((key) => card(key))
    const edges: AutoLayoutEdge[] = [
      { source: 'hub', target: 'a', relation: 'contains' },
      { source: 'hub', target: 'b', relation: 'contains' },
      { source: 'hub', target: 'c', relation: 'contains' },
      { source: 'a', target: 'a1', relation: 'example' },
      { source: 'a1', target: 'c', relation: 'related' },
    ]
    expect(findMindmapTree(nodes, edges)?.root).toBe('hub')
  })

  test('a cycle with cross links lays out without overlaps and with few crossings', async () => {
    const keys = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']
    const nodes = keys.map((key, index) => card(key, 200 + (index % 3) * 60, 90 + (index % 2) * 80))
    const edges: AutoLayoutEdge[] = [
      ['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'a'], ['b', 'e'], ['e', 'f'], ['f', 'b'], ['c', 'g'], ['h', 'g'], ['i', 'j'],
    ].map(([source, target]) => ({ source, target, relation: 'supports' as const }))
    const result = await autoLayout(elk, nodes, edges, { aspectRatio: 1.6 })
    expect(result.shape).toBe('layered')
    expect(result.positions.size).toBe(keys.length)
    expect(overlaps(nodes, result.positions)).toBe(0)
    expect(result.crossings).toBeLessThanOrEqual(1)
  })

  test('unlinked cards are packed, not stacked', async () => {
    const nodes = Array.from({ length: 9 }, (_, index) => card(`n${index}`))
    const result = await autoLayout(elk, nodes, [], { aspectRatio: 1.6 })
    expect(overlaps(nodes, result.positions)).toBe(0)
    // Packed toward the view's shape, not one long row.
    expect(result.width / result.height).toBeLessThan(5)
  })

  test('countCrossings ignores links that share a card', () => {
    const positions = new Map([
      ['a', { x: 0, y: 0 }], ['b', { x: 10, y: 10 }], ['c', { x: 0, y: 10 }], ['d', { x: 10, y: 0 }],
    ])
    expect(countCrossings(positions, [
      { source: 'a', target: 'b', relation: 'supports' },
      { source: 'c', target: 'd', relation: 'supports' },
    ])).toBe(1)
    expect(countCrossings(positions, [
      { source: 'a', target: 'b', relation: 'supports' },
      { source: 'a', target: 'd', relation: 'supports' },
    ])).toBe(0)
  })
})
