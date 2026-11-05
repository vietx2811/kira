// Models, not providers. Every AI feature picks a model from one flat list:
// each model that a connected provider offers, tagged with that provider.
// Asked for by the user on 2026-11-05: "chọn model ... chứ không phải AI
// Provider". The old pickers listed providers ("OpenAI (gpt-4.1-mini)") and
// task routing decided the rest, which is why nobody could tell which model
// a feature would use.
//
// The default model is stored in the existing fields, so no migration: the
// selected provider id plus that provider's `model`.
import type { AiProviderProfile, AiProviderType } from './aiProviderDomain'

export type AiModelRef = { providerId: string; model: string }

export type AiModelOption = AiModelRef & {
  key: string
  providerName: string
  providerType: AiProviderType
  providerTag: string
}

const providerTags: Record<AiProviderType, string> = {
  apple_foundation: 'Apple',
  openai: 'OpenAI',
  anthropic: 'Claude',
  gemini: 'Gemini',
  openrouter: 'OpenRouter',
  ollama: 'Ollama',
  lm_studio: 'LM Studio',
  custom_openai_compatible: 'Custom',
  codex: 'Codex',
  claude_code: 'Claude Code',
}

export function providerTag(type: AiProviderType) {
  return providerTags[type] ?? type
}

export function modelKey(ref: AiModelRef) {
  return `${ref.providerId}::${ref.model}`
}

// Apple's on-device model only tags and classifies images; it cannot write,
// so it is never offered for a text feature.
export function canGenerateText(provider: AiProviderProfile) {
  return provider.type !== 'apple_foundation'
}

export function listModelOptions(providers: AiProviderProfile[]): AiModelOption[] {
  const options: AiModelOption[] = []
  for (const provider of providers) {
    if (provider.status !== 'connected' || !canGenerateText(provider)) continue
    const models = [provider.model, ...(provider.discoveredModels ?? [])]
      .map((model) => model?.trim())
      .filter((model): model is string => Boolean(model))
    for (const model of [...new Set(models)]) {
      options.push({
        key: modelKey({ providerId: provider.id, model }),
        providerId: provider.id,
        model,
        providerName: provider.name,
        providerType: provider.type,
        providerTag: providerTag(provider.type),
      })
    }
  }
  return options
}

// The model a text feature runs on: the feature's own choice if it is still
// connected, then the default model, then the first connected provider. A
// choice whose provider has since disconnected falls through rather than
// failing at send time.
export function resolveTextModel(
  providers: AiProviderProfile[],
  defaultProviderId: string,
  choice?: AiModelRef | null,
): { provider: AiProviderProfile; model: string } | null {
  const usable = (id: string | undefined) => {
    const provider = id ? providers.find((candidate) => candidate.id === id) : undefined
    return provider && provider.status === 'connected' && canGenerateText(provider) ? provider : undefined
  }
  const chosen = usable(choice?.providerId)
  if (chosen && choice) return { provider: { ...chosen, model: choice.model }, model: choice.model }
  const fallback = usable(defaultProviderId) ?? providers.find((provider) => usable(provider.id))
  return fallback ? { provider: fallback, model: fallback.model } : null
}
