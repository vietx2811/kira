/**
 * Run with: bun test apps/desktop/src/kira
 */
import { describe, expect, test } from 'bun:test'
import { extractMermaidSource, layerFlowchart, parseMermaidFlowchart } from './parseMermaid'

// The diagram QA imported in docs/research/2026-09-21-qa-slides-export.md §2.3:
// the old parser kept 3 of its 5 edges and lost both labelled ones.
const QA_DIAGRAM = `flowchart TD
  A[Khảo sát thị trường] --> B{Đủ dữ liệu?}
  B -- Chưa --> C[Phỏng vấn thêm]
  B -- Rồi --> D[Định hướng thị giác]
  C --> A
  D --> E[Bảng màu & chất liệu]`

describe('parseMermaidFlowchart', () => {
  test('keeps every node label and every edge, including inline-labelled ones', () => {
    const parsed = parseMermaidFlowchart(QA_DIAGRAM)
    expect(parsed.nodes).toEqual([
      { id: 'A', label: 'Khảo sát thị trường' },
      { id: 'B', label: 'Đủ dữ liệu?' },
      { id: 'C', label: 'Phỏng vấn thêm' },
      { id: 'D', label: 'Định hướng thị giác' },
      { id: 'E', label: 'Bảng màu & chất liệu' },
    ])
    expect(parsed.edges).toEqual([
      { source: 'A', target: 'B', label: undefined },
      { source: 'B', target: 'C', label: 'Chưa' },
      { source: 'B', target: 'D', label: 'Rồi' },
      { source: 'C', target: 'A', label: undefined },
      { source: 'D', target: 'E', label: undefined },
    ])
  })

  test('reads pipe labels, dotted and thick arrows, chains and & groups', () => {
    const parsed = parseMermaidFlowchart(`graph LR
      start([Bắt đầu]) -->|có| mid[[Giữa]]
      mid -.-> end1((Kết)) ==> tail
      a & b --> c`)
    expect(parsed.edges).toEqual([
      { source: 'start', target: 'mid', label: 'có' },
      { source: 'mid', target: 'end1', label: undefined },
      { source: 'end1', target: 'tail', label: undefined },
      { source: 'a', target: 'c', label: undefined },
      { source: 'b', target: 'c', label: undefined },
    ])
    expect(parsed.nodes.find((node) => node.id === 'start')?.label).toBe('Bắt đầu')
    expect(parsed.nodes.find((node) => node.id === 'mid')?.label).toBe('Giữa')
    expect(parsed.nodes.find((node) => node.id === 'end1')?.label).toBe('Kết')
  })

  test('skips styling statements, subgraph wrappers, comments and frontmatter', () => {
    const parsed = parseMermaidFlowchart(`---
title: Quy trình
---
%%{init: {"theme": "dark"}}%%
flowchart TB
  subgraph Nhóm
    x["Có dấu ngoặc kép"] --> y
  end
  classDef hot fill:#f00
  class x hot
  style y fill:#0f0
  %% a comment --> not an edge`)
    expect(parsed.nodes.map((node) => node.id)).toEqual(['x', 'y'])
    expect(parsed.nodes[0].label).toBe('Có dấu ngoặc kép')
    expect(parsed.edges).toHaveLength(1)
  })

  test('arrow-looking text inside a label is not an edge', () => {
    const parsed = parseMermaidFlowchart(`flowchart LR
      A[Cũ -- mới --> sau] -- vì --> B("x & y")`)
    expect(parsed.nodes).toEqual([
      { id: 'A', label: 'Cũ -- mới --> sau' },
      { id: 'B', label: 'x & y' },
    ])
    expect(parsed.edges).toEqual([{ source: 'A', target: 'B', label: 'vì' }])
  })

  test('a node referenced before its label is declared still gets the label', () => {
    const parsed = parseMermaidFlowchart(`flowchart TD
      A --> B
      B[Tên thật]`)
    expect(parsed.nodes.find((node) => node.id === 'B')?.label).toBe('Tên thật')
  })

  test('returns nothing for diagrams that are not flowcharts', () => {
    expect(parseMermaidFlowchart('sequenceDiagram\n  A->>B: hi')).toEqual({ nodes: [], edges: [] })
  })
})

describe('extractMermaidSource', () => {
  test('macOS smart dashes, arrows and quotes outside labels go back to syntax', () => {
    const typed = 'flowchart LR; a[Ý tưởng — gốc] \u2014 dẫn tới \u2192 b[\u201CPhác thảo\u201D]'
    const source = extractMermaidSource(typed)!.source
    expect(source).toBe('flowchart LR; a[Ý tưởng — gốc] -- dẫn tới --> b[\u201CPhác thảo\u201D]')
    expect(parseMermaidFlowchart(source).edges).toEqual([{ source: 'a', target: 'b', label: 'dẫn tới' }])
  })

  test('a .mmd file is the diagram, titled after the file', () => {
    expect(extractMermaidSource(QA_DIAGRAM, 'Quy trình nghiên cứu.mmd')).toEqual({ source: QA_DIAGRAM, title: 'Quy trình nghiên cứu' })
  })

  test('frontmatter title beats the file name', () => {
    const text = '---\ntitle: "Hành trình khách"\n---\nflowchart LR\n  a --> b'
    expect(extractMermaidSource(text, 'x.mmd')?.title).toBe('Hành trình khách')
  })

  test('a Markdown file yields its first mermaid fence', () => {
    const markdown = '# Ghi chú\n\nVăn bản.\n\n```mermaid\nflowchart LR\n  a --> b\n```\n'
    expect(extractMermaidSource(markdown, 'notes.md')).toEqual({ source: 'flowchart LR\n  a --> b', title: 'notes' })
  })

  test('a Markdown file without a mermaid fence yields nothing', () => {
    expect(extractMermaidSource('# Chỉ có chữ', 'notes.md')).toEqual(null)
  })

  test('pasted text with no file name falls back to a generic title', () => {
    expect(extractMermaidSource('  flowchart LR\n a --> b  ')?.title).toBe('Mermaid diagram')
  })
})

describe('layerFlowchart', () => {
  test('rows follow the edges and a loop back does not push a node down', () => {
    const layers = layerFlowchart(parseMermaidFlowchart(QA_DIAGRAM))
    expect(Object.fromEntries(layers)).toEqual({
      A: { row: 0, column: 0 },
      B: { row: 1, column: 0 },
      C: { row: 2, column: 0 },
      D: { row: 2, column: 1 },
      E: { row: 3, column: 0 },
    })
  })

  test('a pure cycle still places every node', () => {
    const layers = layerFlowchart(parseMermaidFlowchart('flowchart LR\n a --> b --> a\n lone'))
    expect([...layers.keys()].sort()).toEqual(['a', 'b', 'lone'])
  })
})
