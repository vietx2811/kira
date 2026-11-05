/**
 * Run with: bun test apps/desktop/src/kira
 */
import { expect, test } from 'bun:test'
import { RELATIONS, normalizeRelation } from './relations'

test('six relations, one per question', () => {
  expect(RELATIONS.length).toBe(6)
})

test('current relations pass through with their label', () => {
  expect(normalizeRelation('contrasts', 'đổi hướng')).toEqual({ relation: 'contrasts', label: 'đổi hướng' })
})

test('retired relations keep their meaning as the label', () => {
  expect(normalizeRelation('mood')).toEqual({ relation: 'supports', label: 'mood' })
  expect(normalizeRelation('material', '')).toEqual({ relation: 'supports', label: 'material' })
  expect(normalizeRelation('reference')).toEqual({ relation: 'example', label: 'reference' })
})

test('a retired relation does not overwrite a label the user wrote', () => {
  expect(normalizeRelation('mood', 'ánh sáng ấm')).toEqual({ relation: 'supports', label: 'ánh sáng ấm' })
})

test('anything unknown becomes related', () => {
  expect(normalizeRelation('bogus')).toEqual({ relation: 'related', label: undefined })
})
