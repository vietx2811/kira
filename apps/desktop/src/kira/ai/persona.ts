// The user's persona, shared with other creative tools through
// ~/.creative-os/user.json (user decision 2026-11-08: Kira reads it itself).
// Every AI text prompt Kira sends starts with a short "about the user" block
// built from it, so the user never has to repeat who they are.
//
// The file belongs to the user and to other tools too: unknown fields are
// kept as they are when Kira saves its edits back.

export type UserPersona = {
  name?: string
  role?: string
  industry?: string[]
  location?: string
  language?: 'vi' | 'en' | 'both'
  aestheticTendency?: string[]
  avoidKeywords?: string[]
  clientTypes?: string[]
  typicalDeliverables?: string[]
  responseStyle?: 'concise' | 'detailed' | 'conversational'
  feedbackStyle?: 'direct' | 'diplomatic' | 'socratic'
  /** Written by hand or by another tool; used as is when present. */
  promptContext?: string
}

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')
const list = (value: unknown) =>
  Array.isArray(value)
    ? value.map(text).filter(Boolean).slice(0, 24)
    : typeof value === 'string'
      ? value.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 24)
      : []
const oneOf = <T extends string>(value: unknown, options: readonly T[]) =>
  (options as readonly string[]).includes(value as string) ? (value as T) : undefined

/** Reads whatever is in user.json; never throws, drops what it cannot use. */
export function normalizePersona(raw: unknown): UserPersona {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  // The spec's "preference load" output nests it as { persona, promptContext }.
  const body = (source.persona && typeof source.persona === 'object' ? source.persona : source) as Record<string, unknown>
  const persona: UserPersona = {
    name: text(body.name) || undefined,
    role: text(body.role) || undefined,
    industry: list(body.industry),
    location: text(body.location) || undefined,
    language: oneOf(body.language, ['vi', 'en', 'both'] as const),
    aestheticTendency: list(body.aestheticTendency),
    avoidKeywords: list(body.avoidKeywords),
    clientTypes: list(body.clientTypes),
    typicalDeliverables: list(body.typicalDeliverables),
    responseStyle: oneOf(body.responseStyle, ['concise', 'detailed', 'conversational'] as const),
    feedbackStyle: oneOf(body.feedbackStyle, ['direct', 'diplomatic', 'socratic'] as const),
    promptContext: text(source.promptContext) || text(body.promptContext) || undefined,
  }
  return persona
}

export function isPersonaEmpty(persona: UserPersona) {
  return !persona.promptContext
    && !persona.name
    && !persona.role
    && !persona.location
    && !persona.language
    && !persona.responseStyle
    && !persona.feedbackStyle
    && [persona.industry, persona.aestheticTendency, persona.avoidKeywords, persona.clientTypes, persona.typicalDeliverables]
      .every((items) => !items || items.length === 0)
}

const feedbackLines = {
  direct: 'Give feedback directly; say plainly what is weak.',
  diplomatic: 'Give feedback diplomatically; frame weaknesses as what to strengthen.',
  socratic: 'Give feedback as questions that lead the user to the weakness.',
} as const

/** The block prepended to every AI text prompt; empty when there is no persona. */
export function personaPromptContext(persona: UserPersona) {
  if (isPersonaEmpty(persona)) return ''
  if (persona.promptContext) return `ABOUT THE USER:\n${persona.promptContext}`
  const lines: string[] = []
  const who = [persona.name, persona.role].filter(Boolean).join(', ')
  const field = persona.industry?.length ? ` working in ${persona.industry.join(', ')}` : ''
  if (who || field) lines.push(`${who || 'The user'}${field}.`)
  if (persona.location) lines.push(`Location: ${persona.location} (use it for cultural context).`)
  if (persona.aestheticTendency?.length) lines.push(`Aesthetic tendency: ${persona.aestheticTendency.join(', ')}.`)
  if (persona.clientTypes?.length) lines.push(`Clients: ${persona.clientTypes.join(', ')}.`)
  if (persona.typicalDeliverables?.length) lines.push(`Typical deliverables: ${persona.typicalDeliverables.join(', ')}.`)
  if (persona.avoidKeywords?.length) lines.push(`Avoid these words and clichés: ${persona.avoidKeywords.join(', ')}.`)
  if (persona.responseStyle) lines.push(`Response style: ${persona.responseStyle}.`)
  if (persona.feedbackStyle) lines.push(feedbackLines[persona.feedbackStyle])
  if (persona.language === 'vi') lines.push('Prefers Vietnamese unless they write in another language.')
  if (persona.language === 'en') lines.push('Prefers English unless they write in another language.')
  return `ABOUT THE USER:\n${lines.join('\n')}`
}

/** Prompt with the persona block in front, or the prompt unchanged. */
export function withPersona(prompt: string, context: string) {
  return context ? `${context}\n\n---\n\n${prompt}` : prompt
}

/**
 * The fields Kira edits, written back over the file's original content so
 * fields Kira does not know about survive. Empty values remove the field.
 * A hand-written promptContext wins over the fields when prompts are built.
 */
export function mergePersonaForSave(original: unknown, edited: UserPersona) {
  const base = (original && typeof original === 'object' && !Array.isArray(original) ? { ...(original as Record<string, unknown>) } : {}) as Record<string, unknown>
  const target = (base.persona && typeof base.persona === 'object' ? { ...(base.persona as Record<string, unknown>) } : base)
  const keys: Array<Exclude<keyof UserPersona, 'promptContext'>> = [
    'name', 'role', 'industry', 'location', 'language', 'aestheticTendency', 'avoidKeywords',
    'clientTypes', 'typicalDeliverables', 'responseStyle', 'feedbackStyle',
  ]
  for (const key of keys) {
    const value = edited[key]
    if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) delete target[key]
    else target[key] = value
  }
  if (target !== base) base.persona = target
  // promptContext lives at the top level in the spec's format; keep it
  // wherever the file already had it.
  const contextHome = typeof target.promptContext === 'string' && typeof base.promptContext !== 'string' ? target : base
  if (edited.promptContext) contextHome.promptContext = edited.promptContext
  else delete contextHome.promptContext
  return base
}

// App-wide current context, read by the one function that sends text prompts.
let currentContext = ''
export function setCurrentPersonaContext(context: string) {
  currentContext = context
}
export function currentPersonaContext() {
  return currentContext
}
