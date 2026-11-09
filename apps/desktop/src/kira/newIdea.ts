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
