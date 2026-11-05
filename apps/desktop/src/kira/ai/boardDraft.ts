// Drafting a new board from a prompt. The zero state used to answer every
// prompt with the same five hard-coded nodes ("Audience and context",
// "Creative direction", ...) and never called a model, so it looked like AI
// output while being a template. This asks the routed provider for the board
// and reads its answer; when that fails the caller shows the error instead of
// inventing a board.
import { layerFlowchart } from '../mermaid/parseMermaid'

export type BoardDraftNode = { id: string; title: string; body: string }
export type BoardDraft = {
  title: string
  nodes: BoardDraftNode[]
  links: { from: string; to: string; label?: string }[]
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
    '{"title": string, "nodes": [{"id": string, "title": string, "body": string}], "links": [{"from": string, "to": string, "label": string}]}',
    '',
    'Rules:',
    `- 5 to 9 nodes, never more than ${BOARD_DRAFT_MAX_NODES}. The first node is the central idea; the others branch from it.`,
    '- title: at most 8 words. body: one or two short sentences specific to this request, not generic advice.',
    '- links connect node ids from the list; label is a few words or an empty string.',
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
    const link = (item ?? {}) as { from?: unknown; to?: unknown; label?: unknown }
    const from = text(link.from)
    const to = text(link.to)
    if (!seen.has(from) || !seen.has(to) || from === to) continue
    links.push({ from, to, label: text(link.label) || undefined })
  }
  return { title: text(record.title).slice(0, 64) || nodes[0].title.slice(0, 64), nodes, links }
}

// Canvas positions (percent of the stage) in the draft's own order: rows by
// link depth from the central node, centred, so the board reads top-down.
export function layoutBoardDraft(draft: BoardDraft) {
  const layers = layerFlowchart({
    nodes: draft.nodes.map((node) => ({ id: node.id, label: node.title })),
    edges: draft.links.map((link) => ({ source: link.from, target: link.to })),
  })
  const rowSize = new Map<number, number>()
  for (const spot of layers.values()) rowSize.set(spot.row, (rowSize.get(spot.row) ?? 0) + 1)
  // At most four to a line; a wide row wraps onto the next line.
  const perLine = 4
  const lineOfRow = new Map<number, number>()
  let line = 0
  for (const row of [...rowSize.keys()].sort((a, b) => a - b)) {
    lineOfRow.set(row, line)
    line += Math.ceil(rowSize.get(row)! / perLine)
  }
  const positions = new Map<string, { x: number; y: number }>()
  for (const node of draft.nodes) {
    const spot = layers.get(node.id) ?? { row: 0, column: 0 }
    const inRow = rowSize.get(spot.row) ?? 1
    const lineIndex = Math.floor(spot.column / perLine)
    const onLine = Math.min(perLine, inRow - lineIndex * perLine)
    const column = spot.column % perLine
    const x = 50 + (column - (onLine - 1) / 2) * 20
    const y = 22 + ((lineOfRow.get(spot.row) ?? 0) + lineIndex) * 16
    positions.set(node.id, { x: clampPercent(x), y: clampPercent(y) })
  }
  return positions
}

function text(value: unknown) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

function clampPercent(value: number) {
  return Math.min(92, Math.max(8, value))
}
