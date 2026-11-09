/**
 * Run with: bun test apps/desktop/src/kira
 */
import { describe, expect, test } from 'bun:test'
import { NEW_IDEA_DEFAULT_TITLE, newIdeaDefaults } from './newIdea'

describe('newIdeaDefaults', () => {
  test('content is empty, not a copy of the title', () => {
    const defaults = newIdeaDefaults()
    expect(defaults.content).toBe('')
    expect(defaults.title).toBe(NEW_IDEA_DEFAULT_TITLE)
    expect(defaults.content).not.toBe(defaults.title)
  })
})
