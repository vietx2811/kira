import { describe, expect, test } from 'bun:test'
import { isPersonaEmpty, mergePersonaForSave, normalizePersona, personaPromptContext, withPersona } from './persona'

describe('persona', () => {
  test('builds the about-the-user block from fields', () => {
    const persona = normalizePersona({
      name: 'ViệtX',
      role: 'Art Director',
      industry: ['F&B', 'Branding'],
      location: 'Hà Nội',
      aestheticTendency: ['Korean minimal', 'Vietnamese folk'],
      avoidKeywords: 'generic, modern, elegant',
      responseStyle: 'concise',
      feedbackStyle: 'direct',
      language: 'vi',
    })
    const context = personaPromptContext(persona)
    expect(context.startsWith('ABOUT THE USER:\nViệtX, Art Director working in F&B, Branding.')).toBe(true)
    expect(context).toContain('Avoid these words and clichés: generic, modern, elegant.')
    expect(context).toContain('Give feedback directly')
    expect(context).toContain('Prefers Vietnamese')
  })

  test('a hand-written promptContext wins, also in the nested format', () => {
    const persona = normalizePersona({ persona: { role: 'Brand Strategist' }, promptContext: 'You are assisting X.' })
    expect(persona.role).toBe('Brand Strategist')
    expect(personaPromptContext(persona)).toBe('ABOUT THE USER:\nYou are assisting X.')
  })

  test('no file, junk or empty values give no block and leave prompts alone', () => {
    for (const raw of [null, 'text', [], {}, { name: '  ', industry: [] }]) {
      const persona = normalizePersona(raw)
      expect(isPersonaEmpty(persona)).toBe(true)
      expect(withPersona('PROMPT', personaPromptContext(persona))).toBe('PROMPT')
    }
    expect(normalizePersona({ responseStyle: 'loud', language: 'fr' }).responseStyle).toBe(undefined)
  })

  test('saving keeps fields Kira does not know and removes cleared ones', () => {
    const original = { name: 'A', role: 'Old', theme: 'dark', defaults: { gridSize: 20 } }
    const saved = mergePersonaForSave(original, normalizePersona({ name: 'A', role: '', industry: ['F&B'] }))
    expect(saved).toEqual({ name: 'A', theme: 'dark', defaults: { gridSize: 20 }, industry: ['F&B'] })
    const nested = mergePersonaForSave({ persona: { name: 'A' }, promptContext: 'old' }, normalizePersona({ name: 'B', promptContext: 'new' }))
    expect(nested).toEqual({ persona: { name: 'B' }, promptContext: 'new' })
  })
})
