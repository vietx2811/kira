// Drafting a new board from a prompt. The zero state used to answer every
// prompt with the same five hard-coded nodes ("Audience and context",
// "Creative direction", ...) and never called a model, so it looked like AI
// output while being a template. This asks the routed provider for the board
// and reads its answer; when that fails the caller shows the error instead of
// inventing a board.
import { layerFlowchart } from '../mermaid/parseMermaid'
import { RELATIONS } from '../canvas/relations'

export type BoardDraftNode = { id: string; title: string; body: string }
// The relation kinds an idea map uses; the app's other kinds (mood, material,
// reference) describe images, not links between ideas.
// The same six kinds the canvas uses (kira/canvas/relations.ts).
export const BOARD_DRAFT_RELATIONS = RELATIONS
export type BoardDraftRelation = (typeof BOARD_DRAFT_RELATIONS)[number]
export type BoardDraftLink = { from: string; to: string; relation: BoardDraftRelation; label?: string }
export type BoardDraft = {
  title: string
  nodes: BoardDraftNode[]
  links: BoardDraftLink[]
}

export const BOARD_DRAFT_MAX_NODES = 12

export function buildBoardDraftPrompt(request: string) {
  return [
    'You are Kira, the assistant inside KIRA, a canvas for turning visual references into connected ideas.',
    'Draft the first version of a board for the request below: the questions, directions and pieces of evidence the person should work through.',
    '',
    `Request: ${request}`,
    '',
    'Answer with JSON only, no prose and no code fence, in exactly this shape:',
    '{"title": string, "nodes": [{"id": string, "title": string, "body": string}], "links": [{"from": string, "to": string, "relation": string, "label": string}]}',
    '',
    'Rules:',
    `- 5 to 9 nodes, never more than ${BOARD_DRAFT_MAX_NODES}. The first node is the central idea; the others branch from it.`,
    '- title: at most 8 words. body: one or two short sentences specific to this request, not generic advice.',
    `- links connect node ids from the list. relation is one of: ${BOARD_DRAFT_RELATIONS.join(', ')}. Pick the one that is true: "contrasts" for a tension or an alternative, "example" for a concrete instance, "derived-from" when one idea comes out of another, "contains" for a part of a whole, "supports" only when one idea is evidence for another, "related" when none fits.`,
    '- label says how the two ideas connect: 2 or 3 words, at most 24 characters, specific to this request (not the relation name repeated). Every link has one.',
    '- Each node except the first has at least one link; link ideas across branches where they truly connect, not only to the center.',
    '- Write in the same language as the request.',
  ].join('\n')
}

export function parseBoardDraft(raw: string): BoardDraft {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('The model did not return a board.')
  let data: unknown
  try {
    data = JSON.parse(raw.slice(start, end + 1))
  } catch {
    throw new Error('The model returned a board that could not be read.')
  }
  const record = (data ?? {}) as { title?: unknown; nodes?: unknown; links?: unknown }
  const seen = new Set<string>()
  const nodes: BoardDraftNode[] = []
  for (const item of Array.isArray(record.nodes) ? record.nodes : []) {
    const node = (item ?? {}) as { id?: unknown; title?: unknown; body?: unknown }
    const title = text(node.title)
    if (!title) continue
    let id = text(node.id) || `n${nodes.length + 1}`
    while (seen.has(id)) id = `${id}-${nodes.length + 1}`
    seen.add(id)
    nodes.push({ id, title: title.slice(0, 120), body: text(node.body).slice(0, 600) })
    if (nodes.length === BOARD_DRAFT_MAX_NODES) break
  }
  if (nodes.length === 0) throw new Error('The model returned a board with no nodes.')
  const links: BoardDraft['links'] = []
  for (const item of Array.isArray(record.links) ? record.links : []) {
    const link = (item ?? {}) as { from?: unknown; to?: unknown; relation?: unknown; label?: unknown }
    const from = text(link.from)
    const to = text(link.to)
    if (!seen.has(from) || !seen.has(to) || from === to) continue
    const relation = (BOARD_DRAFT_RELATIONS as readonly string[]).includes(text(link.relation))
      ? (text(link.relation) as BoardDraftRelation)
      : 'related'
    links.push({ from, to, relation, label: text(link.label).slice(0, 40) || undefined })
  }
  return { title: text(record.title).slice(0, 64) || nodes[0].title.slice(0, 64), nodes, links }
}

// Canvas positions (percent of the stage) in the draft's own order: rows by
// link depth from the central node, centred, so the board reads top-down.
// Within a row, nodes sit in the order of their parents' positions, so a
// child stays under its parent and edges do not cross (they did when rows
// kept the model's listing order).
export function layoutBoardDraft(draft: BoardDraft) {
  const layers = layerFlowchart({
    nodes: draft.nodes.map((node) => ({ id: node.id, label: node.title })),
    edges: draft.links.map((link) => ({ source: link.from, target: link.to })),
  })
  const rows = new Map<number, string[]>()
  for (const node of draft.nodes) {
    const row = layers.get(node.id)?.row ?? 0
    rows.set(row, [...(rows.get(row) ?? []), node.id])
  }
  const perLine = 4
  const positions = new Map<string, { x: number; y: number }>()
  let line = 0
  for (const row of [...rows.keys()].sort((a, b) => a - b)) {
    const ids = rows.get(row)!
    const parentX = (id: string) => {
      const xs = draft.links
        .filter((link) => link.to === id && positions.has(link.from))
        .map((link) => positions.get(link.from)!.x)
      return xs.length > 0 ? xs.reduce((sum, x) => sum + x, 0) / xs.length : 50
    }
    const ordered = row === 0 ? ids : ids
      .map((id, index) => ({ id, index, key: parentX(id) }))
      .sort((a, b) => a.key - b.key || a.index - b.index)
      .map((entry) => entry.id)
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

function text(value: unknown) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

function clampPercent(value: number) {
  return Math.min(92, Math.max(8, value))
}
