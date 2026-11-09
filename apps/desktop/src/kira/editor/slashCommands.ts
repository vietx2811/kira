// Phase-1 slash-menu command list for the node editor overlay (2026-11-09
// node-editor-ux spec, decision 4a): plain structural blocks the StarterKit
// already understands (plus To-do, added as its own extension) — no AI, no
// diagram-linking, no callout. Those are explicitly deferred to a later
// phase (spec §3.2's "để sau" row).

export type SlashCommandId =
  | 'text'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'bulletList'
  | 'orderedList'
  | 'quote'
  | 'divider'
  | 'todo'

export type SlashCommandItem = {
  id: SlashCommandId
  label: string
  keywords: string[]
}

export const SLASH_COMMAND_ITEMS: SlashCommandItem[] = [
  { id: 'text', label: 'Text', keywords: ['text', 'paragraph'] },
  { id: 'heading1', label: 'Heading 1', keywords: ['heading', 'h1', 'title'] },
  { id: 'heading2', label: 'Heading 2', keywords: ['heading', 'h2', 'subtitle'] },
  { id: 'heading3', label: 'Heading 3', keywords: ['heading', 'h3'] },
  { id: 'bulletList', label: 'Bulleted list', keywords: ['bullet', 'list', 'ul'] },
  { id: 'orderedList', label: 'Numbered list', keywords: ['numbered', 'ordered', 'list', 'ol'] },
  { id: 'quote', label: 'Quote', keywords: ['quote', 'blockquote'] },
  { id: 'divider', label: 'Divider', keywords: ['divider', 'hr', 'line', 'separator'] },
  { id: 'todo', label: 'To-do', keywords: ['todo', 'task', 'checkbox', 'checklist'] },
]

// Query is whatever the user typed after "/", lowercased by the caller's
// Suggestion config. Matches on the label or any keyword, substring —
// same permissiveness as every other filter-as-you-type menu in the app.
export function filterSlashCommands(query: string): SlashCommandItem[] {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return SLASH_COMMAND_ITEMS
  return SLASH_COMMAND_ITEMS.filter((item) => (
    item.label.toLowerCase().includes(trimmed)
    || item.keywords.some((keyword) => keyword.includes(trimmed))
  ))
}
