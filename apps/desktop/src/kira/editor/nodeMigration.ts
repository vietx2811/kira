// Pure data-migration helpers for the node editor overlay (2026-11-09
// node-editor-ux redesign). Called once per node at project-load time
// (main.tsx's normalizeIdea/normalizeNodeContent) — never on every render,
// since every node already carries a correct `title` from the moment it was
// last saved under the old "derive title from content" behavior.

// A node's title used to be recomputed from its first markdown line on every
// content edit (see the removed `deriveTitleFromContent` call sites in
// main.tsx's updateIdea/updateImage/updatePalette/updateDiagram/
// updatePlaceholder). `title` is now a real, independently-editable field —
// this stays only as the one-time fallback for the pathological case of a
// node whose title is missing or blank, so the editor never shows an empty
// title field for old data.
export function deriveTitleFromContent(markdown: string): string {
  const firstLine = markdown.split('\n').find((line) => line.trim().length > 0) ?? ''
  const stripped = firstLine.replace(/^#+\s*|^>\s*|^\d+\.\s+|^[-*]\s+|\*\*|\*|`/g, '').trim()
  return stripped.length > 0 ? stripped.slice(0, 120) : 'Untitled'
}

// Backfills `title` from `content` only when `title` is missing or blank.
// Deliberately does NOT touch `content` to do this — stripping the matching
// first line back out of the markdown would be a destructive, irreversible
// text edit (and an ambiguous one: a heading, a list item, or a line that
// merely starts the same way as the title are all different things to
// "remove"). A node that already has a title keeps it byte-for-byte, even if
// it no longer matches the content's first line.
export function ensureNodeTitle<T extends { title?: string; content?: string }>(raw: T): T & { title: string } {
  if (typeof raw.title === 'string' && raw.title.trim().length > 0) return raw as T & { title: string }
  return { ...raw, title: deriveTitleFromContent(raw.content ?? '') }
}

// Idea's dedicated "Notes" field is removed from the editor overlay (idea
// nodes only — image/palette/diagram/placeholder keep it, per the
// 2026-11-09 node-editor-ux spec's §3.3). Whatever a user already wrote
// there is merged into `content` once, never dropped silently: appended as
// a new paragraph, or used as the content outright if content was empty.
// Idempotent by construction — `notes` is cleared after merging, so running
// this again on an already-migrated idea (notes now undefined/empty) is a
// no-op and never double-appends.
export function mergeIdeaNotesIntoContent<T extends { content: string; notes?: string }>(idea: T): T {
  const notes = (idea.notes ?? '').trim()
  if (!notes) return idea
  const content = idea.content.trim().length > 0 ? `${idea.content}\n\n${notes}` : notes
  return { ...idea, content, notes: undefined }
}
