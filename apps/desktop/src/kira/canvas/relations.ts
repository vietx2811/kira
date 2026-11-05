// The kinds of link between two nodes. There were nine; reviewed 2026-11-06
// and cut to six, one per question a link answers:
//
//   supports      is evidence for
//   contrasts     is a tension or an alternative
//   example       is an instance or a reference of
//   derived-from  comes out of (shown as "leads to")
//   contains      is a part of
//   related       connected, none of the above fits
//
// What went: "mood" and "material" said which aspect of an image supports an
// idea, not how the two relate, so they are "supports" with that word as the
// link's label; "reference" was "example" under another name. Old projects
// keep their meaning through normalizeRelation: the old kind becomes the
// label when the link had none.

export const RELATIONS = ['supports', 'contrasts', 'example', 'derived-from', 'contains', 'related'] as const
export type Relation = (typeof RELATIONS)[number]

const RETIRED: Record<string, { relation: Relation; label: string }> = {
  mood: { relation: 'supports', label: 'mood' },
  material: { relation: 'supports', label: 'material' },
  reference: { relation: 'example', label: 'reference' },
}

export function isRelation(value: unknown): value is Relation {
  return typeof value === 'string' && (RELATIONS as readonly string[]).includes(value)
}

// A stored relation, possibly a retired one, as a current relation plus the
// label to keep. Unknown values become "related".
export function normalizeRelation(value: unknown, label?: string): { relation: Relation; label?: string } {
  if (isRelation(value)) return { relation: value, label }
  const retired = typeof value === 'string' ? RETIRED[value] : undefined
  if (retired) return { relation: retired.relation, label: label?.trim() ? label : retired.label }
  return { relation: 'related', label }
}

// Evidence first: how strongly a link of this kind backs the node it points at.
export function relationWeight(relation: Relation) {
  return { supports: 0, example: 1, contains: 2, 'derived-from': 3, contrasts: 4, related: 5 }[relation]
}
