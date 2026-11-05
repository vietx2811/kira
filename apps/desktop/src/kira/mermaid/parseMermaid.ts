// Reading Mermaid text that a user opened from a file or pasted in.
//
// Two jobs, kept apart on purpose:
// - extractMermaidSource: get the diagram out of what the user handed over (a
//   .mmd file, or a Markdown file with a ```mermaid fence) and pick a title.
// - parseMermaidFlowchart: turn a flowchart into nodes and edges so it can
//   become editable ideas and links on the canvas. Other diagram kinds
//   (sequence, class, ...) are still kept and drawn, they just do not unpack
//   into ideas.
//
// Validating the syntax is mermaid's job (mermaid.parse), not this file's.

export type MermaidFlowchart = {
  nodes: { id: string; label: string }[]
  edges: { source: string; target: string; label?: string }[]
}

export type MermaidDocument = {
  source: string
  title: string
}

const MERMAID_FILE_EXTENSIONS = ['mmd', 'mermaid', 'md', 'markdown', 'txt']
export const MERMAID_FILE_ACCEPT = MERMAID_FILE_EXTENSIONS.map((extension) => `.${extension}`).join(',')

export function extractMermaidSource(text: string, fileName?: string): MermaidDocument | null {
  const isMarkdown = /\.(md|markdown)$/i.test(fileName ?? '')
  const fenced = text.match(/```\s*mermaid[^\n]*\n([\s\S]*?)```/i)
  let source = fenced ? fenced[1] : isMarkdown ? '' : text
  source = source.replace(/^﻿/, '').trim()
  if (!source) return null

  const frontmatterTitle = source.match(/^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/)?.[1]?.match(/^\s*title:\s*(.+)$/m)?.[1]
  const directiveTitle = source.match(/^\s*title\s+(.+)$/m)?.[1]
  const fileTitle = fileName?.replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '')
  const title = cleanTitle(frontmatterTitle) || cleanTitle(fileTitle) || cleanTitle(directiveTitle) || 'Mermaid diagram'
  return { source, title }
}

function cleanTitle(value: string | undefined) {
  return (value ?? '').replace(/^["']|["']$/g, '').trim()
}

// Arrow forms: --> --- -.-> -.- ==> === --o --x <--> and longer runs of each.
const ARROW = String.raw`<?(?:-{2,}[->ox]?|={2,}[=>ox]?|-\.+-[->ox]?)`
// A label written inside the arrow (A -- text --> B) is moved into the pipe
// form (A -->|text| B) first, so the rest only has to understand one form.
const INLINE_LABEL = new RegExp(String.raw`\s(--|==|-\.)\s+([^|>]+?)\s+(-{2,}[->ox]|-{3,}|={2,}[=>ox]|\.-+[->ox]?|={3,})(?=\s|$|[A-Za-z0-9_])`, 'g')
const SEGMENT = new RegExp(String.raw`\s*${ARROW}\s*(?:\|([^|]*)\|)?\s*`, 'g')

const SKIPPED_STATEMENT = /^(subgraph|end|classDef|class|style|linkStyle|click|direction|accTitle|accDescr|title)\b/i

export function parseMermaidFlowchart(source: string): MermaidFlowchart {
  const body = source.replace(/^---\s*\n[\s\S]*?\n---\s*(?:\n|$)/, '')
  const lines = body
    .split(/\r?\n/)
    .flatMap((line) => splitOutside(line.replace(/%%.*$/, ''), /;/g))
    .map((line) => line.trim())
    .filter(Boolean)
  const header = lines[0] ?? ''
  if (!/^(graph|flowchart)\b/i.test(header)) return { nodes: [], edges: [] }

  const nodeMap = new Map<string, string>()
  const edges: MermaidFlowchart['edges'] = []

  function register(raw: string) {
    const cleaned = raw.trim().replace(/:::[\w-]+$/, '').trim()
    const match = cleaned.match(/^([\p{L}\p{N}_-]+)\s*(.*)$/u)
    if (!match) return null
    const id = match[1]
    const label = shapeLabel(match[2])
    if (label || !nodeMap.has(id)) nodeMap.set(id, label || id)
    return id
  }

  for (const line of lines.slice(1)) {
    if (SKIPPED_STATEMENT.test(line)) continue
    const normalized = moveInlineLabels(` ${line}`).trim()

    // Split "A --> B -->|x| C & D" into node groups and the labels between them.
    // Arrows and & are searched for in a masked copy, so the same characters
    // inside a label ([Bảng màu & chất liệu], [a --> b]) are never split on.
    const masked = maskShapes(normalized)
    const groups: string[] = []
    const labels: (string | undefined)[] = []
    let cursor = 0
    SEGMENT.lastIndex = 0
    for (let match = SEGMENT.exec(masked); match; match = SEGMENT.exec(masked)) {
      if (match[0].length === 0) {
        SEGMENT.lastIndex += 1
        continue
      }
      groups.push(normalized.slice(cursor, match.index))
      const pipe = normalized.slice(match.index, match.index + match[0].length).match(/\|([^|]*)\|/)
      labels.push(pipe?.[1]?.trim() || undefined)
      cursor = match.index + match[0].length
    }
    groups.push(normalized.slice(cursor))

    const ids = groups.map((group) =>
      splitOutside(group, /\s+&\s+/g)
        .map(register)
        .filter((id): id is string => Boolean(id)),
    )
    for (let index = 0; index < labels.length; index += 1) {
      for (const sourceId of ids[index]) {
        for (const targetId of ids[index + 1] ?? []) {
          edges.push({ source: sourceId, target: targetId, label: labels[index] ? normalizeLabel(labels[index]!) : undefined })
        }
      }
    }
  }

  return {
    nodes: [...nodeMap.entries()].map(([id, label]) => ({ id, label })),
    edges,
  }
}

// Same length as the input, with everything inside brackets or quotes turned
// into a placeholder, so a regex can find structure without seeing labels.
// The pipe label (-->|text|) is masked too, except for its two pipes.
function maskShapes(line: string) {
  const closers: string[] = []
  let quote = ''
  let inPipe = false
  let out = ''
  for (const char of line) {
    const inside = closers.length > 0 || quote !== '' || inPipe
    if (quote) {
      if (char === quote) quote = ''
    } else if (closers.length > 0) {
      if (char === closers[closers.length - 1]) closers.pop()
      else if (char === '[' || char === '(' || char === '{') closers.push(char === '[' ? ']' : char === '(' ? ')' : '}')
    } else if (char === '|') {
      inPipe = !inPipe
      out += char
      continue
    } else if (!inPipe && char === '"') {
      quote = char
    } else if (!inPipe && (char === '[' || char === '(' || char === '{')) {
      closers.push(char === '[' ? ']' : char === '(' ? ')' : '}')
      out += char
      continue
    }
    out += inside || quote ? '\u0001'.repeat(char.length) : char
  }
  return out
}

function moveInlineLabels(line: string) {
  const masked = maskShapes(line)
  let out = ''
  let cursor = 0
  INLINE_LABEL.lastIndex = 0
  for (let match = INLINE_LABEL.exec(masked); match; match = INLINE_LABEL.exec(masked)) {
    const labelStart = match.index + match[0].indexOf(match[2])
    const label = line.slice(labelStart, labelStart + match[2].length).trim()
    out += `${line.slice(cursor, match.index)} ${match[3]}|${label}| `
    cursor = match.index + match[0].length
  }
  return out + line.slice(cursor)
}

function splitOutside(text: string, separator: RegExp) {
  const masked = maskShapes(text)
  const parts: string[] = []
  let cursor = 0
  separator.lastIndex = 0
  for (let match = separator.exec(masked); match; match = separator.exec(masked)) {
    if (match[0].length === 0) {
      separator.lastIndex += 1
      continue
    }
    parts.push(text.slice(cursor, match.index))
    cursor = match.index + match[0].length
  }
  parts.push(text.slice(cursor))
  return parts
}

// [text] (text) {text} ([text]) [[text]] [(text)] ((text)) {{text}} >text]
// [/text/] [\text\] and the quoted "text" forms of each.
function shapeLabel(shape: string) {
  const trimmed = shape.trim()
  if (!trimmed) return ''
  const inner = trimmed.replace(/^[[({>]+[/\\]?/, '').replace(/[/\\]?[\])}]+$/, '')
  return normalizeLabel(inner)
}

function normalizeLabel(value: string) {
  return value
    .trim()
    .replace(/^["'`]|["'`]$/g, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Rows for placing a flowchart's nodes as ideas: each node's row is its depth
// along the edges from the nodes nothing points at, so the ideas keep the
// diagram's top-to-bottom order. An edge back to a node already placed (a
// loop, C --> A) is ignored rather than pushing that node down forever.
export function layerFlowchart(flowchart: MermaidFlowchart): Map<string, { row: number; column: number }> {
  const ids = flowchart.nodes.map((node) => node.id)
  const incoming = new Map(ids.map((id) => [id, 0]))
  const outgoing = new Map<string, string[]>(ids.map((id) => [id, []]))
  for (const edge of flowchart.edges) {
    if (edge.source === edge.target || !incoming.has(edge.target) || !outgoing.has(edge.source)) continue
    outgoing.get(edge.source)!.push(edge.target)
    incoming.set(edge.target, incoming.get(edge.target)! + 1)
  }
  const row = new Map<string, number>()
  const roots = ids.filter((id) => incoming.get(id) === 0)
  const queue = roots.length > 0 ? roots : ids.slice(0, 1)
  queue.forEach((id) => row.set(id, 0))
  for (let index = 0; index < queue.length; index += 1) {
    const id = queue[index]
    for (const target of outgoing.get(id)!) {
      if (row.has(target)) continue
      row.set(target, row.get(id)! + 1)
      queue.push(target)
    }
  }
  // Nodes only reachable through a cycle, or not connected at all, go last.
  let spill = Math.max(-1, ...row.values()) + 1
  for (const id of ids) if (!row.has(id)) row.set(id, spill++)

  const placed = new Map<string, { row: number; column: number }>()
  const used = new Map<number, number>()
  for (const id of ids) {
    const r = row.get(id)!
    const column = used.get(r) ?? 0
    used.set(r, column + 1)
    placed.set(id, { row: r, column })
  }
  return placed
}
