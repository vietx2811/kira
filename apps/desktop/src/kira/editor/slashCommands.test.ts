/**
 * Run with: bun test apps/desktop/src/kira
 */
import { describe, expect, test } from 'bun:test'
import { filterSlashCommands, SLASH_COMMAND_ITEMS } from './slashCommands'

describe('filterSlashCommands', () => {
  test('returns every item for an empty query', () => {
    expect(filterSlashCommands('')).toEqual(SLASH_COMMAND_ITEMS)
    expect(filterSlashCommands('   ')).toEqual(SLASH_COMMAND_ITEMS)
  })
  test('matches by label, case-insensitively', () => {
    expect(filterSlashCommands('HEADING').map((item) => item.id)).toEqual(['heading1', 'heading2', 'heading3'])
  })
  test('matches by keyword even when the label differs', () => {
    expect(filterSlashCommands('checklist').map((item) => item.id)).toEqual(['todo'])
    expect(filterSlashCommands('hr').map((item) => item.id)).toEqual(['divider'])
  })
  test('narrows as more characters are typed', () => {
    expect(filterSlashCommands('h1').map((item) => item.id)).toEqual(['heading1'])
  })
  test('returns an empty list when nothing matches', () => {
    expect(filterSlashCommands('zzzzz')).toEqual([])
  })
})
