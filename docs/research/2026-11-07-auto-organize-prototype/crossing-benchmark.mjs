// Prototype for docs/research/2026-11-07-auto-organize-layout.md §4.
//
// Zero dependencies, plain Node (>=18). Run: node crossing-benchmark.mjs
//
// `layerFlowchart` and `layoutBoardDraft` below are a line-by-line port of
// apps/desktop/src/kira/mermaid/parseMermaid.ts (layerFlowchart, lines
// 235-269) and apps/desktop/src/kira/ai/boardDraft.ts (layoutBoardDraft,
// lines 88-123) at commit 5dd1596 — KIRA's REAL current algorithm for
// positioning an AI-drafted board, not a reimplementation from the
// description. Diffed by eye against the source; grep both files for
// "layerFlowchart" / "layoutBoardDraft" to re-check if this drifts.
//
// Two candidates, both honestly limited the same way the original is: no
// awareness of card width/height (percent-grid positions only), and no
// edge-label placement (that already has its own fix in canvas/edgeLabels.ts
// and is orthogonal to node placement, which is what this file measures).
//
// - "layered+barycenter": keeps the current row assignment (it is a
//   reasonable longest-path-from-roots layering) and replaces the current
//   "sort each row by the average x of each node's OWN parents" ordering —
//   which ignores every other row and every cross-branch link — with two
//   barycenter sweeps (down using parents, up using children) plus one
//   adjacent-swap transposition pass, the textbook Sugiyama crossing
//   reduction. This is the direct, minimal fix for the current function.
// - "force": a plain spring-repulsion relaxation (Hooke's law on edges,
//   inverse-square repulsion on all pairs), seeded with a deterministic PRNG
//   so re-running this file reproduces the same numbers. Shown only on the
//   fixture with a cycle and a disconnected component, where "layered" as a
//   concept does not apply cleanly.
//
// All positions are percent-of-stage, matching the app's own coordinate
// space (clampPercent to 8..92, same as the source).

// ---------------------------------------------------------------------------
// Verbatim port: layerFlowchart (parseMermaid.ts:235-269)
// ---------------------------------------------------------------------------
function layerFlowchart(nodes, edges) {
  const ids = nodes.map((n) => n.id)
  const incoming = new Map(ids.map((id) => [id, 0]))
  const outgoing = new Map(ids.map((id) => [id, []]))
  for (const edge of edges) {
    if (edge.source === edge.target || !incoming.has(edge.target) || !outgoing.has(edge.source)) continue
    outgoing.get(edge.source).push(edge.target)
    incoming.set(edge.target, incoming.get(edge.target) + 1)
  }
  const row = new Map()
  const roots = ids.filter((id) => incoming.get(id) === 0)
  const queue = roots.length > 0 ? roots : ids.slice(0, 1)
  queue.forEach((id) => row.set(id, 0))
  for (let index = 0; index < queue.length; index += 1) {
    const id = queue[index]
    for (const target of outgoing.get(id)) {
      if (row.has(target)) continue
      row.set(target, row.get(id) + 1)
      queue.push(target)
    }
  }
  let spill = Math.max(-1, ...row.values()) + 1
  for (const id of ids) if (!row.has(id)) row.set(id, spill++)

  const placed = new Map()
  const used = new Map()
  for (const id of ids) {
    const r = row.get(id)
    const column = used.get(r) ?? 0
    used.set(r, column + 1)
    placed.set(id, { row: r, column })
  }
  return placed
}

function clampPercent(value) {
  return Math.min(92, Math.max(8, value))
}

// ---------------------------------------------------------------------------
// Verbatim port: layoutBoardDraft (boardDraft.ts:88-123)
// ---------------------------------------------------------------------------
function layoutBoardDraftCurrent(draft) {
  const layers = layerFlowchart(
    draft.nodes.map((n) => ({ id: n.id })),
    draft.links.map((l) => ({ source: l.from, target: l.to })),
  )
  const rows = new Map()
  for (const node of draft.nodes) {
    const row = layers.get(node.id)?.row ?? 0
    rows.set(row, [...(rows.get(row) ?? []), node.id])
  }
  const perLine = 4
  const positions = new Map()
  let line = 0
  for (const row of [...rows.keys()].sort((a, b) => a - b)) {
    const ids = rows.get(row)
    const parentX = (id) => {
      const xs = draft.links
        .filter((link) => link.to === id && positions.has(link.from))
        .map((link) => positions.get(link.from).x)
      return xs.length > 0 ? xs.reduce((sum, x) => sum + x, 0) / xs.length : 50
    }
    const ordered = row === 0 ? ids : ids
      .map((id, index) => ({ id, index, key: parentX(id) }))
      .sort((a, b) => a.key - b.key || a.index - b.index)
      .map((e) => e.id)
    for (let start = 0; start < ordered.length; start += perLine) {
      const chunk = ordered.slice(start, start + perLine)
      chunk.forEach((id, column) => {
        const x = 50 + (column - (chunk.length - 1) / 2) * 20
        positions.set(id, { x: clampPercent(x), y: clampPercent(22 + line * 16) })
      })
      line += 1
    }
  }
  return positions
}

// ---------------------------------------------------------------------------
// Candidate A: same row assignment, barycenter ordering + one transposition
// pass (Sugiyama). This is the direct fix for the ordering step above, not a
// different algorithm family.
// ---------------------------------------------------------------------------
function layoutBoardDraftBarycenter(draft) {
  const ids = draft.nodes.map((n) => n.id)
  const layers = layerFlowchart(
    draft.nodes.map((n) => ({ id: n.id })),
    draft.links.map((l) => ({ source: l.from, target: l.to })),
  )
  const rowOf = new Map(ids.map((id) => [id, layers.get(id)?.row ?? 0]))
  const maxRow = Math.max(...rowOf.values())
  const rows = []
  for (let r = 0; r <= maxRow; r += 1) rows.push(ids.filter((id) => rowOf.get(id) === r))

  const parentsOf = new Map(ids.map((id) => [id, []]))
  const childrenOf = new Map(ids.map((id) => [id, []]))
  for (const link of draft.links) {
    if (!rowOf.has(link.from) || !rowOf.has(link.to) || link.from === link.to) continue
    childrenOf.get(link.from).push(link.to)
    parentsOf.get(link.to).push(link.from)
  }

  // order[r] = array of ids, left-to-right position in that row.
  const order = rows.map((row) => [...row])
  const posInRow = () => {
    const m = new Map()
    order.forEach((row) => row.forEach((id, i) => m.set(id, i)))
    return m
  }

  function barycenterPass(neighborsOf) {
    const pos = posInRow()
    for (let r = 0; r < order.length; r += 1) {
      const scored = order[r].map((id) => {
        const neigh = neighborsOf.get(id) ?? []
        const xs = neigh.map((n) => pos.get(n)).filter((v) => v !== undefined)
        const score = xs.length > 0 ? xs.reduce((s, v) => s + v, 0) / xs.length : pos.get(id)
        return { id, score }
      })
      // Stable sort by score; ties keep current relative order.
      const withIndex = scored.map((s, i) => ({ ...s, i }))
      withIndex.sort((a, b) => a.score - b.score || a.i - b.i)
      order[r] = withIndex.map((s) => s.id)
    }
  }

  // Down sweep (order by parents' positions), then up sweep (by children's),
  // then one more down sweep — standard 3-pass compromise between the two
  // directions pulling a row in opposite ways. This only looks at
  // adjacent-row edges, same as classic Sugiyama.
  barycenterPass(parentsOf)
  barycenterPass(childrenOf)
  barycenterPass(parentsOf)

  function positionsFromOrder(ord) {
    const perLine = 4
    const positions = new Map()
    let line = 0
    for (const rowIds of ord) {
      for (let start = 0; start < rowIds.length; start += perLine) {
        const chunk = rowIds.slice(start, start + perLine)
        chunk.forEach((id, column) => {
          const x = 50 + (column - (chunk.length - 1) / 2) * 20
          positions.set(id, { x: clampPercent(x), y: clampPercent(22 + line * 16) })
        })
        line += 1
      }
    }
    return positions
  }

  // Greedy local search, full graph: try every adjacent swap within every
  // row, keep it only if it strictly lowers the TOTAL crossing count, not
  // just the two neighbor rows — AI-drafted boards have same-rank
  // cross-branch links the plain Sugiyama view never looks at, by the
  // prompt's own "link ideas across branches" rule. Repeat full sweeps
  // until a pass makes no improvement, capped so this always terminates.
  for (let sweep = 0; sweep < 6; sweep += 1) {
    let improvedThisSweep = false
    for (let r = 0; r < order.length; r += 1) {
      for (let i = 0; i < order[r].length - 1; i += 1) {
        const before = countCrossings(positionsFromOrder(order), draft.links)
        const swapped = order.map((row, idx) => (idx === r ? [...row] : row))
        const tmp = swapped[r][i]
        swapped[r][i] = swapped[r][i + 1]
        swapped[r][i + 1] = tmp
        const after = countCrossings(positionsFromOrder(swapped), draft.links)
        if (after < before) {
          order[r] = swapped[r]
          improvedThisSweep = true
        }
      }
    }
    if (!improvedThisSweep) break
  }

  return positionsFromOrder(order)
}

// ---------------------------------------------------------------------------
// Candidate B: plain force-directed relaxation. Used only on the fixture
// with a cycle + a disconnected component, where "row" is not a meaningful
// concept. Deterministic PRNG so re-runs reproduce the same layout.
// ---------------------------------------------------------------------------
function mulberry32(seed) {
  let a = seed
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function layoutForceDirected(draft, { iterations = 400, seed = 42 } = {}) {
  const rand = mulberry32(seed)
  const ids = draft.nodes.map((n) => n.id)
  const pos = new Map(ids.map((id) => [id, { x: 50 + (rand() - 0.5) * 60, y: 50 + (rand() - 0.5) * 60 }]))
  const edges = draft.links.filter((l) => l.from !== l.to).map((l) => [l.from, l.to])
  const idealLen = 22 // percent units; tuned to roughly fill the 8..92 box for ~10 nodes
  const spring = 0.02
  const repulse = 60
  const damping = 0.9
  const vel = new Map(ids.map((id) => [id, { x: 0, y: 0 }]))

  for (let iter = 0; iter < iterations; iter += 1) {
    const force = new Map(ids.map((id) => [id, { x: 0, y: 0 }]))
    // Repulsion, all pairs.
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const a = pos.get(ids[i]), b = pos.get(ids[j])
        let dx = a.x - b.x, dy = a.y - b.y
        let dist = Math.hypot(dx, dy) || 0.01
        const f = repulse / (dist * dist)
        dx /= dist; dy /= dist
        force.get(ids[i]).x += dx * f; force.get(ids[i]).y += dy * f
        force.get(ids[j]).x -= dx * f; force.get(ids[j]).y -= dy * f
      }
    }
    // Spring, edges only.
    for (const [from, to] of edges) {
      const a = pos.get(from), b = pos.get(to)
      let dx = b.x - a.x, dy = b.y - a.y
      const dist = Math.hypot(dx, dy) || 0.01
      const stretch = dist - idealLen
      const f = spring * stretch
      dx /= dist; dy /= dist
      force.get(from).x += dx * f; force.get(from).y += dy * f
      force.get(to).x -= dx * f; force.get(to).y -= dy * f
    }
    // Weak centering pull so disconnected components don't drift to infinity.
    for (const id of ids) {
      const p = pos.get(id)
      force.get(id).x += (50 - p.x) * 0.002
      force.get(id).y += (50 - p.y) * 0.002
    }
    for (const id of ids) {
      const v = vel.get(id), f = force.get(id), p = pos.get(id)
      v.x = (v.x + f.x) * damping
      v.y = (v.y + f.y) * damping
      p.x = clampPercent(p.x + v.x)
      p.y = clampPercent(p.y + v.y)
    }
  }
  return pos
}

// ---------------------------------------------------------------------------
// Crossing count: proper segment intersection, skipping pairs that share an
// endpoint (two edges meeting at a node are not a "crossing").
// ---------------------------------------------------------------------------
function ccw(a, b, c) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
}
function segmentsIntersect(p1, p2, p3, p4) {
  const d1 = ccw(p3, p4, p1)
  const d2 = ccw(p3, p4, p2)
  const d3 = ccw(p1, p2, p3)
  const d4 = ccw(p1, p2, p4)
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true
  return false // collinear/touching cases intentionally not counted as a crossing
}
function countCrossings(positions, links) {
  const edges = links.filter((l) => l.from !== l.to && positions.has(l.from) && positions.has(l.to))
  let crossings = 0
  for (let i = 0; i < edges.length; i += 1) {
    for (let j = i + 1; j < edges.length; j += 1) {
      const e1 = edges[i], e2 = edges[j]
      const shared = [e1.from, e1.to].some((n) => n === e2.from || n === e2.to)
      if (shared) continue
      if (segmentsIntersect(positions.get(e1.from), positions.get(e1.to), positions.get(e2.from), positions.get(e2.to))) {
        crossings += 1
      }
    }
  }
  return crossings
}
// How many nodes sit within 0.5 percentage points of another node on BOTH
// axes — i.e. rendered on top of each other, unreadable regardless of
// crossing count. Crossing count alone does not catch this; the current
// algorithm's fixed y-step (22 + line*16, clamped to 92) hits it on any
// board deep enough that clampPercent saturates (fixture C).
function countOverlaps(positions) {
  const pts = [...positions.values()]
  let count = 0
  for (let i = 0; i < pts.length; i += 1) {
    for (let j = i + 1; j < pts.length; j += 1) {
      if (Math.abs(pts[i].x - pts[j].x) < 0.5 && Math.abs(pts[i].y - pts[j].y) < 0.5) count += 1
    }
  }
  return count
}
function totalEdgeLength(positions, links) {
  let sum = 0
  for (const l of links) {
    if (l.from === l.to || !positions.has(l.from) || !positions.has(l.to)) continue
    const a = positions.get(l.from), b = positions.get(l.to)
    sum += Math.hypot(a.x - b.x, a.y - b.y)
  }
  return sum
}

// ---------------------------------------------------------------------------
// Fixtures. Node count and shape chosen to match what the app can actually
// produce today: fixture B hits BOARD_DRAFT_MAX_NODES (12, boardDraft.ts:23)
// and follows the AI prompt's own instruction to link across branches
// (buildBoardDraftPrompt, boardDraft.ts:40); fixture C is the shape the
// prompt does NOT ask for (a cycle) but nothing in parseBoardDraft rejects,
// since the model is free to return any {from,to} pair, and is also the
// shape "Discover mode"'s inferred weak-support edges can produce elsewhere
// in the app.
// ---------------------------------------------------------------------------
const FIXTURES = {
  A_clean_tree: {
    title: 'A — clean tree (7 nodes, no cross-links)',
    nodes: ['center', 'b1', 'b2', 'b3', 'c1', 'c2', 'c3'].map((id) => ({ id, title: id })),
    links: [
      ['center', 'b1'], ['center', 'b2'], ['center', 'b3'],
      ['b1', 'c1'], ['b2', 'c2'], ['b3', 'c3'],
    ].map(([from, to]) => ({ from, to, relation: 'related' })),
  },
  B_brainstorm_12node_crosslinks: {
    title: 'B — 12-node brainstorm with cross-branch links (realistic AI output)',
    nodes: ['center', 'a1', 'a2', 'a3', 'b1', 'b2', 'b3', 'c1', 'c2', 'c3', 'd1', 'd2'].map((id) => ({ id, title: id })),
    links: [
      ['center', 'a1'], ['center', 'b1'], ['center', 'c1'], ['center', 'd1'],
      ['a1', 'a2'], ['a1', 'a3'], ['b1', 'b2'], ['b1', 'b3'], ['c1', 'c2'], ['c1', 'c3'], ['d1', 'd2'],
      // Cross-branch links the prompt explicitly asks for.
      ['a2', 'c2'], ['b3', 'd2'], ['a3', 'b2'], ['c3', 'd1'],
    ].map(([from, to]) => ({ from, to, relation: 'related' })),
  },
  C_cycle_plus_island: {
    title: 'C — feedback cycle + a disconnected pair (10 nodes)',
    nodes: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7', 'h8', 'island1', 'island2'].map((id) => ({ id, title: id })),
    links: [
      ['h1', 'h2'], ['h2', 'h3'], ['h3', 'h4'], ['h4', 'h1'], // 4-cycle
      ['h1', 'h5'], ['h5', 'h6'], ['h6', 'h7'], ['h7', 'h8'], ['h8', 'h5'], // another cycle hanging off h1
      ['island1', 'island2'], // disconnected component
    ].map(([from, to]) => ({ from, to, relation: 'related' })),
  },
}

function report(fixtureKey, fixture) {
  const current = layoutBoardDraftCurrent(fixture)
  const barycenter = layoutBoardDraftBarycenter(fixture)
  const lines = [`\n## ${fixture.title}`, `nodes=${fixture.nodes.length} links=${fixture.links.length}`]
  lines.push(`current (layoutBoardDraft, verbatim):       crossings=${countCrossings(current, fixture.links)}  overlappingPairs=${countOverlaps(current)}  totalEdgeLen=${totalEdgeLength(current, fixture.links).toFixed(1)}`)
  lines.push(`candidate layered+barycenter+transposition: crossings=${countCrossings(barycenter, fixture.links)}  overlappingPairs=${countOverlaps(barycenter)}  totalEdgeLen=${totalEdgeLength(barycenter, fixture.links).toFixed(1)}`)
  if (fixtureKey === 'C_cycle_plus_island') {
    const force = layoutForceDirected(fixture, { iterations: 500, seed: 7 })
    lines.push(`candidate force-directed (500 iter, seed=7):  crossings=${countCrossings(force, fixture.links)}  overlappingPairs=${countOverlaps(force)}  totalEdgeLen=${totalEdgeLength(force, fixture.links).toFixed(1)}`)
  }
  console.log(lines.join('\n'))
  return { current, barycenter, force: fixtureKey === 'C_cycle_plus_island' ? layoutForceDirected(fixture, { iterations: 500, seed: 7 }) : null }
}

console.log('KIRA auto-organize prototype — edge-crossing count, before/after.')
console.log('Run at:', new Date().toISOString(), '— see file header for the commit this ports from.')
const results = {}
for (const [key, fixture] of Object.entries(FIXTURES)) {
  results[key] = report(key, fixture)
}

// Dump positions as JSON so the HTML specimen (svg-specimen.html, same
// folder) can render them without re-running this file.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const outDir = dirname(fileURLToPath(import.meta.url))
const dump = Object.fromEntries(
  Object.entries(results).map(([key, r]) => [key, {
    links: FIXTURES[key].links,
    current: Object.fromEntries(r.current),
    barycenter: Object.fromEntries(r.barycenter),
    force: r.force ? Object.fromEntries(r.force) : null,
  }]),
)
writeFileSync(join(outDir, 'results.json'), JSON.stringify(dump, null, 2))
console.log('\nWrote results.json (positions for svg-specimen.html).')
