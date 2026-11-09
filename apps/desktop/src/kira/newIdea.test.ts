/**
 * Run with: bun test apps/desktop/src/kira
 */
import { describe, expect, test } from 'bun:test'
import { NEW_IDEA_DEFAULT_TITLE, newIdeaDefaults, resolveIdeaFaceDisplay } from './newIdea'

describe('newIdeaDefaults', () => {
  test('content is empty, not a copy of the title', () => {
    const defaults = newIdeaDefaults()
    expect(defaults.content).toBe('')
    expect(defaults.title).toBe(NEW_IDEA_DEFAULT_TITLE)
    expect(defaults.content).not.toBe(defaults.title)
  })
})

describe('resolveIdeaFaceDisplay', () => {
  test('a brand new idea (empty content, real title) shows the title — the regression this fixes', () => {
    expect(resolveIdeaFaceDisplay({ title: NEW_IDEA_DEFAULT_TITLE, content: '' })).toEqual({
      kind: 'title',
      text: NEW_IDEA_DEFAULT_TITLE,
    })
  })

  test('an idea with real content (every pre-existing idea) renders through NodeRichEditor unchanged', () => {
    expect(resolveIdeaFaceDisplay({ title: 'Ritual tools', content: 'Objects that invite attention.' })).toEqual({
      kind: 'content',
    })
  })

  test('whitespace-only content counts as empty, not real content', () => {
    expect(resolveIdeaFaceDisplay({ title: 'My idea', content: '   \n  ' })).toEqual({ kind: 'title', text: 'My idea' })
  })

  test('both title and content blank: a dim placeholder, not a blank face', () => {
    expect(resolveIdeaFaceDisplay({ title: '', content: '' })).toEqual({ kind: 'placeholder', text: 'Untitled' })
  })

  test('whitespace-only title with empty content also falls back to the placeholder', () => {
    expect(resolveIdeaFaceDisplay({ title: '   ', content: '' })).toEqual({ kind: 'placeholder', text: 'Untitled' })
  })

  test('content wins over title when both are present', () => {
    expect(resolveIdeaFaceDisplay({ title: 'My idea', content: 'The actual note.' })).toEqual({ kind: 'content' })
  })
})
