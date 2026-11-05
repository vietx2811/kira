/**
 * Run with: bun test apps/desktop/src/kira
 */
import { describe, expect, test } from 'bun:test'
import { buildBoardDraftPrompt, layoutBoardDraft, parseBoardDraft } from './boardDraft'

const ANSWER = `Đây là bảng nháp:
\`\`\`json
{"title": "Quán phở Hà Nội cho Gen Z",
 "nodes": [
  {"id": "root", "title": "Phở cho Gen Z", "body": "Giữ vị gốc, đổi cách kể."},
  {"id": "a", "title": "Khách hàng", "body": "Sinh viên, dân văn phòng trẻ."},
  {"id": "b", "title": "Chất liệu thị giác", "body": "Men sứ, khói, ánh đèn vàng."},
  {"id": "c", "title": "", "body": "no title, dropped"}
 ],
 "links": [
  {"from": "root", "to": "a", "relation": "contains", "label": "cho ai"},
  {"from": "root", "to": "b", "relation": "made-up", "label": ""},
  {"from": "root", "to": "missing"},
  {"from": "a", "to": "a"}
 ]}
\`\`\``

describe('parseBoardDraft', () => {
  test('reads the JSON out of a chatty, fenced answer and drops broken parts', () => {
    const draft = parseBoardDraft(ANSWER)
    expect(draft.title).toBe('Quán phở Hà Nội cho Gen Z')
    expect(draft.nodes.map((node) => node.id)).toEqual(['root', 'a', 'b'])
    expect(draft.links).toEqual([
      { from: 'root', to: 'a', relation: 'contains', label: 'cho ai' },
      // an unknown relation falls back to "related" instead of being dropped
      { from: 'root', to: 'b', relation: 'related', label: undefined },
    ])
  })

  test('duplicate ids stay distinct and the title falls back to the first node', () => {
    const draft = parseBoardDraft('{"nodes":[{"id":"x","title":"Một"},{"id":"x","title":"Hai"}]}')
    expect(new Set(draft.nodes.map((node) => node.id)).size).toBe(2)
    expect(draft.title).toBe('Một')
  })

  test('says what went wrong instead of returning an empty board', () => {
    expect(() => parseBoardDraft('Sorry, I cannot help with that.')).toThrow('did not return a board')
    expect(() => parseBoardDraft('{"nodes": [}')).toThrow('could not be read')
    expect(() => parseBoardDraft('{"nodes": []}')).toThrow('no nodes')
  })
})

describe('layoutBoardDraft', () => {
  test('the central node sits on top, its branches on the row below, centred', () => {
    const positions = layoutBoardDraft(parseBoardDraft(ANSWER))
    expect(positions.get('root')).toEqual({ x: 50, y: 22 })
    expect(positions.get('a')).toEqual({ x: 40, y: 38 })
    expect(positions.get('b')).toEqual({ x: 60, y: 38 })
  })

  test('a wide row wraps instead of running off the stage', () => {
    const nodes = Array.from({ length: 7 }, (_, index) => ({ id: `n${index}`, title: `N${index}`, body: '' }))
    const links = nodes.slice(1).map((node) => ({ from: 'n0', to: node.id, relation: 'related' as const }))
    const positions = layoutBoardDraft({ title: 't', nodes, links })
    const xs = [...positions.values()].map((spot) => spot.x)
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(8)
    expect(Math.max(...xs)).toBeLessThanOrEqual(92)
    expect(new Set([...positions.values()].map((spot) => spot.y)).size).toBe(3)
  })
})

describe('layoutBoardDraft keeps children under their parents', () => {
  test('a grandchild sits under its own parent, not where the list put it', () => {
    const draft = {
      title: 't',
      nodes: ['root', 'left', 'right', 'right-child', 'left-child'].map((id) => ({ id, title: id, body: '' })),
      links: [
        { from: 'root', to: 'left', relation: 'contains' as const },
        { from: 'root', to: 'right', relation: 'contains' as const },
        { from: 'right', to: 'right-child', relation: 'example' as const },
        { from: 'left', to: 'left-child', relation: 'example' as const },
      ],
    }
    const positions = layoutBoardDraft(draft)
    expect(positions.get('left-child')!.x).toBeLessThanOrEqual(positions.get('right-child')!.x)
    expect(positions.get('left-child')!.x).toBeLessThanOrEqual(positions.get('left')!.x + 10)
  })
})

test('the prompt carries the request and asks for JSON in its language', () => {
  const prompt = buildBoardDraftPrompt('Bộ nhận diện cho tiệm bánh mì')
  expect(prompt).toContain('Request: Bộ nhận diện cho tiệm bánh mì')
  expect(prompt).toContain('JSON only')
  expect(prompt).toContain('same language as the request')
  expect(prompt).toContain('relation is one of')
})
