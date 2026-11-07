// Auto-organize for idea boards (2026-11-07, research:
// docs/research/2026-11-07-auto-organize-layout.md). Goal: see as many ideas
// as possible in one view, with as few crossing links as possible.
//
// One algorithm does not fit every board, so the shape decides:
// - A tree (one connected group, no cycles once "related" links are left
//   out) becomes a two-sided mindmap: the most connected node in the middle,
//   its branches split left and right by weight, each side laid out by ELK's
//   layered algorithm.
// - Anything else (several groups, cycles, many-to-many) is laid out by ELK
//   layered with crossing minimisation, tried left-to-right and top-to-bottom,
//   keeping the one with fewer crossings and the shape closer to the view.
// Sizes are the real card sizes in px, so cards do not overlap. "Related"
// links are drawn but never pull the layout: they say "these touch", not
// "this one follows from that one".
//
// Pure: no DOM, no React. The caller measures cards and maps px to its own
// coordinates.

import type { Relation } from './relations'

export type AutoLayoutNode = { key: string; width: number; height: number; weight?: number }
export type AutoLayoutEdge = { source: string; target: string; relation: Relation }
export type AutoLayoutResult = {
  shape: 'mindmap' | 'layered' | 'empty'
  /** Card centres in px; the layout's bounding box is centred on (0, 0). */
  positions: Map<string, { x: number; y: number }>
  width: number
  height: number
  crossings: number
}

type ElkChild = { id: string; x?: number; y?: number; width?: number; height?: number }
type ElkGraph = {
  id: string
  layoutOptions?: Record<string, string>
  children?: ElkChild[]
  edges?: Array<{ id: string; sources: string[]; targets: string[] }>
}
export type ElkLike = { layout: (graph: ElkGraph) => Promise<ElkGraph> }

/** Links that should shape the layout. */
export function isStructuralRelation(relation: Relation) {
  return relation !== 'related'
}

const SPACING = { nodeNode: 36, betweenLayers: 84, components: 72 }

function layeredOptions(direction: 'RIGHT' | 'LEFT' | 'DOWN', aspectRatio: number): Record<string, string> {
  return {
    'elk.algorithm': 'layered',
    'elk.direction': direction,
    'elk.spacing.nodeNode': String(SPACING.nodeNode),
    'elk.layered.spacing.nodeNodeBetweenLayers': String(SPACING.betweenLayers),
    'elk.spacing.componentComponent': String(SPACING.components),
    'elk.separateConnectedComponents': 'true',
    'elk.aspectRatio': aspectRatio.toFixed(2),
    'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
    'elk.layered.thoroughness': '24',
    'elk.layered.cycleBreaking.strategy': 'GREEDY',
    'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
    'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
    'elk.edgeRouting': 'SPLINES',
  }
}

function dedupeEdges(nodes: AutoLayoutNode[], edges: AutoLayoutEdge[]) {
  const keys = new Set(nodes.map((node) => node.key))
  const seen = new Set<string>()
  const result: AutoLayoutEdge[] = []
  for (const edge of edges) {
    if (!isStructuralRelation(edge.relation)) continue
    if (!keys.has(edge.source) || !keys.has(edge.target) || edge.source === edge.target) continue
    const id = edge.source < edge.target ? `${edge.source}|${edge.target}` : `${edge.target}|${edge.source}`
    if (seen.has(id)) continue
    seen.add(id)
    result.push(edge)
  }
  return result
}

/**
 * The tree to draw as a mindmap, or null. Direction is ignored: boards link
 * evidence to ideas and ideas to evidence both ways, and a mindmap only needs
 * "connected without cycles". Nodes outside the tree (unlinked notes) are
 * allowed and packed underneath.
 */
export function findMindmapTree(nodes: AutoLayoutNode[], edges: AutoLayoutEdge[]) {
  const structural = dedupeEdges(nodes, edges)
  const adjacency = new Map<string, string[]>(nodes.map((node) => [node.key, []]))
  for (const edge of structural) {
    adjacency.get(edge.source)!.push(edge.target)
    adjacency.get(edge.target)!.push(edge.source)
  }
  const linked = nodes.filter((node) => adjacency.get(node.key)!.length > 0)
  if (linked.length < 4) return null
  // One connected group.
  const seen = new Set<string>([linked[0].key])
  const queue = [linked[0].key]
  while (queue.length) {
    for (const next of adjacency.get(queue.shift()!)!) {
      if (seen.has(next)) continue
      seen.add(next)
      queue.push(next)
    }
  }
  if (seen.size !== linked.length) return null
  // No cycles: a connected group is a tree when it has one edge fewer than nodes.
  if (structural.length !== linked.length - 1) return null
  const weightOf = new Map(nodes.map((node) => [node.key, node.weight ?? 0]))
  const root = [...linked].sort((a, b) => {
    const degree = adjacency.get(b.key)!.length - adjacency.get(a.key)!.length
    return degree !== 0 ? degree : (weightOf.get(b.key)! - weightOf.get(a.key)!)
  })[0].key
  if (adjacency.get(root)!.length < 3) return null
  // Orient away from the root.
  const children = new Map<string, string[]>()
  const order = [root]
  const visited = new Set([root])
  for (let index = 0; index < order.length; index += 1) {
    const current = order[index]
    const kids = adjacency.get(current)!.filter((next) => !visited.has(next))
    kids.forEach((kid) => visited.add(kid))
    children.set(current, kids)
    order.push(...kids)
  }
  return { root, children, members: new Set(order) }
}

function centres(children: ElkChild[]) {
  return new Map(children.map((child) => [child.id, {
    x: (child.x ?? 0) + (child.width ?? 0) / 2,
    y: (child.y ?? 0) + (child.height ?? 0) / 2,
  }]))
}

/** Straight-line crossings between link midlines, links sharing a node excluded. */
export function countCrossings(positions: Map<string, { x: number; y: number }>, edges: AutoLayoutEdge[]) {
  const segments = edges
    .map((edge) => ({ edge, a: positions.get(edge.source), b: positions.get(edge.target) }))
    .filter((segment): segment is { edge: AutoLayoutEdge; a: { x: number; y: number }; b: { x: number; y: number } } => Boolean(segment.a && segment.b))
  const orient = (p: { x: number; y: number }, q: { x: number; y: number }, r: { x: number; y: number }) =>
    Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x))
  let count = 0
  for (let i = 0; i < segments.length; i += 1) {
    for (let j = i + 1; j < segments.length; j += 1) {
      const s = segments[i]
      const t = segments[j]
      const shared = [s.edge.source, s.edge.target].some((key) => key === t.edge.source || key === t.edge.target)
      if (shared) continue
      if (orient(s.a, s.b, t.a) * orient(s.a, s.b, t.b) < 0 && orient(t.a, t.b, s.a) * orient(t.a, t.b, s.b) < 0) count += 1
    }
  }
  return count
}

function centreOnOrigin(positions: Map<string, { x: number; y: number }>, sizes: Map<string, AutoLayoutNode>) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [key, point] of positions) {
    const node = sizes.get(key)!
    minX = Math.min(minX, point.x - node.width / 2)
    maxX = Math.max(maxX, point.x + node.width / 2)
    minY = Math.min(minY, point.y - node.height / 2)
    maxY = Math.max(maxY, point.y + node.height / 2)
  }
  if (!Number.isFinite(minX)) return { positions, width: 0, height: 0 }
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const centred = new Map([...positions].map(([key, point]) => [key, { x: point.x - cx, y: point.y - cy }]))
  return { positions: centred, width: maxX - minX, height: maxY - minY }
}

async function layoutMindmap(
  elk: ElkLike,
  nodes: AutoLayoutNode[],
  edges: AutoLayoutEdge[],
  tree: NonNullable<ReturnType<typeof findMindmapTree>>,
  aspectRatio: number,
) {
  const sizes = new Map(nodes.map((node) => [node.key, node]))
  const subtreeWeight = new Map<string, number>()
  const weigh = (key: string): number => {
    const own = sizes.get(key)!.height + SPACING.nodeNode
    const total = own + (tree.children.get(key) ?? []).reduce((sum, kid) => sum + weigh(kid), 0)
    subtreeWeight.set(key, total)
    return total
  }
  weigh(tree.root)
  // Branches alternate to the lighter side, heaviest first, so both sides
  // end up about the same height.
  const branches = [...tree.children.get(tree.root)!].sort((a, b) => subtreeWeight.get(b)! - subtreeWeight.get(a)!)
  const sides: { right: string[]; left: string[] } = { right: [], left: [] }
  let rightWeight = 0
  let leftWeight = 0
  for (const branch of branches) {
    if (rightWeight <= leftWeight) {
      sides.right.push(branch)
      rightWeight += subtreeWeight.get(branch)!
    } else {
      sides.left.push(branch)
      leftWeight += subtreeWeight.get(branch)!
    }
  }
  const collect = (key: string, into: string[]) => {
    into.push(key)
    for (const kid of tree.children.get(key) ?? []) collect(kid, into)
    return into
  }
  const placed = new Map<string, { x: number; y: number }>()
  for (const side of ['right', 'left'] as const) {
    if (sides[side].length === 0) continue
    const members = [tree.root, ...sides[side].flatMap((branch) => collect(branch, []))]
    const memberSet = new Set(members)
    const sideEdges: Array<{ id: string; sources: string[]; targets: string[] }> = []
    for (const parent of members) {
      for (const kid of tree.children.get(parent) ?? []) {
        if (memberSet.has(kid)) sideEdges.push({ id: `${parent}>${kid}`, sources: [parent], targets: [kid] })
      }
    }
    const graph = await elk.layout({
      id: `mindmap-${side}`,
      layoutOptions: { ...layeredOptions(side === 'right' ? 'RIGHT' : 'LEFT', aspectRatio), 'elk.separateConnectedComponents': 'false' },
      children: members.map((key) => ({ id: key, width: sizes.get(key)!.width, height: sizes.get(key)!.height })),
      edges: sideEdges,
    })
    const points = centres(graph.children ?? [])
    const rootPoint = points.get(tree.root)!
    for (const [key, point] of points) {
      if (key === tree.root && placed.has(key)) continue
      placed.set(key, { x: point.x - rootPoint.x, y: point.y - rootPoint.y })
    }
  }
  // Unlinked cards: one shelf under the mindmap, centred.
  const loose = nodes.filter((node) => !tree.members.has(node.key))
  if (loose.length) {
    let bottom = -Infinity
    for (const [key, point] of placed) bottom = Math.max(bottom, point.y + sizes.get(key)!.height / 2)
    const rowWidth = loose.reduce((sum, node) => sum + node.width, 0) + SPACING.nodeNode * (loose.length - 1)
    let cursor = -rowWidth / 2
    const rowHeight = Math.max(...loose.map((node) => node.height))
    for (const node of loose) {
      placed.set(node.key, { x: cursor + node.width / 2, y: bottom + SPACING.components + rowHeight / 2 })
      cursor += node.width + SPACING.nodeNode
    }
  }
  const centred = centreOnOrigin(placed, sizes)
  return {
    shape: 'mindmap' as const,
    ...centred,
    crossings: countCrossings(centred.positions, dedupeEdges(nodes, edges)),
  }
}

async function layoutLayered(elk: ElkLike, nodes: AutoLayoutNode[], edges: AutoLayoutEdge[], aspectRatio: number) {
  const sizes = new Map(nodes.map((node) => [node.key, node]))
  const structural = dedupeEdges(nodes, edges)
  const candidates: AutoLayoutResult[] = []
  for (const direction of ['RIGHT', 'DOWN'] as const) {
    const graph = await elk.layout({
      id: `board-${direction}`,
      layoutOptions: layeredOptions(direction, aspectRatio),
      children: nodes.map((node) => ({ id: node.key, width: node.width, height: node.height })),
      edges: structural.map((edge, index) => ({ id: `e${index}`, sources: [edge.source], targets: [edge.target] })),
    })
    const centred = centreOnOrigin(centres(graph.children ?? []), sizes)
    candidates.push({ shape: 'layered', ...centred, crossings: countCrossings(centred.positions, structural) })
  }
  // Fewer crossings first; then the shape that fills the view better.
  const fit = (result: AutoLayoutResult) => Math.abs(Math.log((result.width / Math.max(1, result.height)) / aspectRatio))
  return candidates.sort((a, b) => (a.crossings - b.crossings) || (fit(a) - fit(b)))[0]
}

export async function autoLayout(
  elk: ElkLike,
  nodes: AutoLayoutNode[],
  edges: AutoLayoutEdge[],
  options: { aspectRatio?: number } = {},
): Promise<AutoLayoutResult> {
  if (nodes.length === 0) return { shape: 'empty', positions: new Map(), width: 0, height: 0, crossings: 0 }
  const aspectRatio = options.aspectRatio && Number.isFinite(options.aspectRatio) ? options.aspectRatio : 1.6
  const tree = findMindmapTree(nodes, edges)
  if (tree) return layoutMindmap(elk, nodes, edges, tree, aspectRatio)
  return layoutLayered(elk, nodes, edges, aspectRatio)
}
