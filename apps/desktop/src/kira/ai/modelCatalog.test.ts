/**
 * Run with: bun test apps/desktop/src/kira
 */
import { describe, expect, test } from 'bun:test'
import type { AiProviderProfile } from './aiProviderDomain'
import { listModelOptions, modelKey, resolveTextModel } from './modelCatalog'

function provider(patch: Partial<AiProviderProfile> & Pick<AiProviderProfile, 'id' | 'type'>): AiProviderProfile {
  return { name: patch.id, authMode: 'api_key', model: 'm', status: 'connected', defaultFor: [], ...patch }
}

const providers = [
  provider({ id: 'apple-foundation', type: 'apple_foundation', authMode: 'local', model: 'system default' }),
  provider({ id: 'openai', type: 'openai', model: 'gpt-4.1-mini', discoveredModels: ['gpt-4.1-mini', 'gpt-5'] }),
  provider({ id: 'anthropic', type: 'anthropic', model: 'claude-sonnet-4-6', status: 'key_missing' }),
  provider({ id: 'claude_code', type: 'claude_code', model: 'claude-sonnet-4-6' }),
]

describe('listModelOptions', () => {
  test('lists each model of each connected text provider once, tagged by provider', () => {
    expect(listModelOptions(providers).map((option) => `${option.providerTag}: ${option.model}`)).toEqual([
      'OpenAI: gpt-4.1-mini',
      'OpenAI: gpt-5',
      'Claude Code: claude-sonnet-4-6',
    ])
  })

  test('shows the name the provider gives a model, the id otherwise', () => {
    const options = listModelOptions([
      provider({
        id: 'claude_code',
        type: 'claude_code',
        model: 'claude-opus-5-5',
        discoveredModels: ['claude-opus-5-5', 'claude-haiku-4-5-20251001', 'claude-new'],
        discoveredModelLabels: { 'claude-opus-5-5': 'Opus 5.5', 'claude-haiku-4-5-20251001': 'Haiku 4.5' },
      }),
    ])
    expect(options.map((option) => [option.model, option.label])).toEqual([
      ['claude-opus-5-5', 'Opus 5.5'],
      ['claude-haiku-4-5-20251001', 'Haiku 4.5'],
      ['claude-new', 'claude-new'],
    ])
  })

  test('the same model name from two providers stays two choices', () => {
    const keys = listModelOptions([
      provider({ id: 'a', type: 'openrouter', model: 'gpt-5' }),
      provider({ id: 'b', type: 'openai', model: 'gpt-5' }),
    ]).map((option) => option.key)
    expect(keys).toEqual(['a::gpt-5', 'b::gpt-5'])
  })
})

describe('resolveTextModel', () => {
  test("a feature's own choice wins and carries its model", () => {
    const resolved = resolveTextModel(providers, 'claude_code', { providerId: 'openai', model: 'gpt-5' })
    expect(resolved?.provider.id).toBe('openai')
    expect(resolved?.provider.model).toBe('gpt-5')
  })

  test('without a choice the default model is used', () => {
    expect(resolveTextModel(providers, 'claude_code')?.provider.id).toBe('claude_code')
  })

  test('a choice or default that is not connected falls through to a connected one', () => {
    const resolved = resolveTextModel(providers, 'anthropic', { providerId: 'anthropic', model: 'x' })
    expect(resolved?.provider.id).toBe('openai')
  })

  test('the on-device model is never used for text', () => {
    expect(resolveTextModel([providers[0]], 'apple-foundation')).toEqual(null)
  })
})

test('modelKey keeps provider and model apart', () => {
  expect(modelKey({ providerId: 'openai', model: 'gpt-5' })).toBe('openai::gpt-5')
})
