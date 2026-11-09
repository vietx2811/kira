/**
 * Run with: bun test apps/desktop/src/kira
 */
import { describe, expect, test } from 'bun:test'
import { resolveImportSlot } from './importLayout'

describe('resolveImportSlot', () => {
  test('reproduces the fix: an empty board, 3 captures in a batch, no two share a slot', () => {
    const seedCount = 6
    const imagesLengthBeforeBatch = 0
    const slots = [0, 1, 2].map((i) => resolveImportSlot(imagesLengthBeforeBatch + i, seedCount))
    expect(slots).toEqual([0, 1, 2])
    expect(new Set(slots).size).toBe(3)
  })

  test('a batch straddling the seed-count boundary still has no duplicate slots', () => {
    const seedCount = 6
    const imagesLengthBeforeBatch = 4
    const slots = [0, 1, 2, 3].map((i) => resolveImportSlot(imagesLengthBeforeBatch + i, seedCount))
    expect(new Set(slots).size).toBe(slots.length)
  })

  test('normal case (board already past the seed count) behaves exactly as before', () => {
    const seedCount = 6
    expect(resolveImportSlot(6, seedCount)).toBe(0)
    expect(resolveImportSlot(7, seedCount)).toBe(1)
    expect(resolveImportSlot(10, seedCount)).toBe(4)
  })

  test('zero seed count never needs the offset branch', () => {
    expect(resolveImportSlot(0, 0)).toBe(0)
    expect(resolveImportSlot(3, 0)).toBe(3)
  })
})
