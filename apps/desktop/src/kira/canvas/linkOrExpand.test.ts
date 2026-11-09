/**
 * Run with: bun test apps/desktop/src/kira
 */
import { describe, expect, test } from 'bun:test'
import { decideLinkOrExpand } from './linkOrExpand'

describe('decideLinkOrExpand', () => {
  test('dropping on a different existing node links to it', () => {
    expect(decideLinkOrExpand({ kind: 'idea', id: 'a' }, { kind: 'image', id: 'b' }))
      .toEqual({ type: 'link', target: { kind: 'image', id: 'b' } })
  })
  test('dropping on empty canvas opens the create-linked-node menu', () => {
    expect(decideLinkOrExpand({ kind: 'idea', id: 'a' }, null)).toEqual({ type: 'open-create-menu' })
  })
  test('dropping back onto the source node itself is a no-op', () => {
    expect(decideLinkOrExpand({ kind: 'idea', id: 'a' }, { kind: 'idea', id: 'a' })).toEqual({ type: 'noop' })
  })
  test('same id but a different kind is still treated as a different node (links)', () => {
    expect(decideLinkOrExpand({ kind: 'idea', id: 'a' }, { kind: 'image', id: 'a' }))
      .toEqual({ type: 'link', target: { kind: 'image', id: 'a' } })
  })
})
