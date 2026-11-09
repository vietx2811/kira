/**
 * Default title/content for a freshly created idea node (main.tsx's
 * createIdea, the "Idea" toolbar button), split out so the bug below is
 * unit-testable (`bun test apps/desktop/src/kira`) without the app.
 *
 * Bug: createIdea used to set both `title` and `content` to the literal
 * string 'Untitled idea' — the editor body opened already containing text
 * identical to the title sitting right above it, instead of showing
 * NodeRichEditor's own empty-state placeholder ("Type '/' to insert a
 * block"). `content` must be empty, not a copy of the title.
 *
 * Safe at load time too: ensureNodeTitle (kira/editor/nodeMigration.ts)
 * only ever derives `title` FROM `content` when `title` is missing or
 * blank — never the reverse — so a node with a real title and empty
 * content is never "fixed" back into having a duplicated body.
 */
export const NEW_IDEA_DEFAULT_TITLE = 'Untitled idea'

export function newIdeaDefaults(): { title: string; content: string } {
  return { title: NEW_IDEA_DEFAULT_TITLE, content: '' }
}

/**
 * Regression from the fix above: the idea card's canvas face
 * (main.tsx's `displayView.ideas.map`) renders `idea.content` through a
 * read-only NodeRichEditor — Tiptap's Placeholder extension only shows
 * placeholder text in an *editable* editor, so a brand new idea (empty
 * content by design now) rendered completely blank on the face, no title,
 * nothing. Resolves what the face should show instead: the title when
 * there's no content, or a dim "Untitled" placeholder in the rare case
 * both are blank (legacy/malformed data — newIdeaDefaults always sets a
 * real title). An idea with real content (every pre-existing idea, and
 * any idea once the user types something) is untouched — `kind: 'content'`
 * tells the caller to render NodeRichEditor exactly as before.
 */
export type IdeaFaceDisplay = { kind: 'content' } | { kind: 'title' | 'placeholder'; text: string }

const UNTITLED_IDEA_PLACEHOLDER = 'Untitled'

export function resolveIdeaFaceDisplay(idea: { title: string; content: string }): IdeaFaceDisplay {
  if (idea.content.trim().length > 0) return { kind: 'content' }
  if (idea.title.trim().length > 0) return { kind: 'title', text: idea.title }
  return { kind: 'placeholder', text: UNTITLED_IDEA_PLACEHOLDER }
}
