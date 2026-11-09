/**
 * Run with: bun test apps/desktop/src/kira
 */
import { describe, expect, test } from 'bun:test'
import { deriveTitleFromContent, ensureNodeTitle, mergeIdeaNotesIntoContent } from './nodeMigration'

describe('deriveTitleFromContent', () => {
  test('strips heading/list/quote/bold markers from the first non-empty line', () => {
    expect(deriveTitleFromContent('# Hello world')).toBe('Hello world')
    expect(deriveTitleFromContent('- A bullet title')).toBe('A bullet title')
    expect(deriveTitleFromContent('> A quoted title')).toBe('A quoted title')
    expect(deriveTitleFromContent('**Bold title**')).toBe('Bold title')
  })
  test('skips leading blank lines', () => {
    expect(deriveTitleFromContent('\n\nReal first line\nsecond line')).toBe('Real first line')
  })
  test('falls back to Untitled for blank content', () => {
    expect(deriveTitleFromContent('')).toBe('Untitled')
    expect(deriveTitleFromContent('   \n   ')).toBe('Untitled')
  })
})

describe('ensureNodeTitle', () => {
  test('a node that already has a title keeps it exactly, even if it no longer matches content', () => {
    const node = { title: 'My own title', content: 'Something else entirely' }
    expect(ensureNodeTitle(node)).toEqual(node)
  })
  test('backfills from content when title is missing', () => {
    const node = { content: '# Derived title\nbody' }
    expect(ensureNodeTitle(node).title).toBe('Derived title')
  })
  test('backfills from content when title is an empty or whitespace-only string', () => {
    expect(ensureNodeTitle({ title: '', content: 'From content' }).title).toBe('From content')
    expect(ensureNodeTitle({ title: '   ', content: 'From content' }).title).toBe('From content')
  })
  test('falls back to Untitled when both title and content are missing', () => {
    expect(ensureNodeTitle({}).title).toBe('Untitled')
  })
})

describe('mergeIdeaNotesIntoContent', () => {
  test('appends notes to existing content as a new paragraph and clears notes', () => {
    const idea: { content: string; notes?: string } = { content: 'Main body text.', notes: 'A private note.' }
    const merged = mergeIdeaNotesIntoContent(idea)
    expect(merged.content).toBe('Main body text.\n\nA private note.')
    expect(merged.notes).toBe(undefined)
  })
  test('uses notes as the content outright when content was empty', () => {
    const idea = { content: '', notes: 'Only a note.' }
    expect(mergeIdeaNotesIntoContent(idea)).toEqual({ content: 'Only a note.', notes: undefined })
  })
  test('is a no-op when notes is undefined or blank — content is untouched', () => {
    expect(mergeIdeaNotesIntoContent({ content: 'Body', notes: undefined })).toEqual({ content: 'Body', notes: undefined })
    expect(mergeIdeaNotesIntoContent({ content: 'Body', notes: '   ' })).toEqual({ content: 'Body', notes: '   ' })
  })
  test('is idempotent: migrating an already-migrated idea does not duplicate the note', () => {
    const idea = { content: 'Main body text.', notes: 'A private note.' }
    const once = mergeIdeaNotesIntoContent(idea)
    const twice = mergeIdeaNotesIntoContent(once)
    expect(twice).toEqual(once)
    expect(twice.content).toBe('Main body text.\n\nA private note.')
  })
})
