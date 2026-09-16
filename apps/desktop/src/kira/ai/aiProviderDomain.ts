// AI provider domain: types, labels, templates, and native-bridge functions
// shared by main.tsx (provider onboarding, routing, generation) and the
// Settings > AI Providers tab (apps/desktop/src/components/application/
// settings/). Extracted out of main.tsx (PHA 1 Untitled UI migration,
// 2026-09-16) as a first, low-risk step toward breaking up the 20k-line
// file: everything below is pure data or a pure function with no closure
// over app/component state, so relocating it changes nothing at the call
// sites beyond "imported" instead of "locally declared".
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

export type AiTaskKind =
  | 'tag_reference'
  | 'classify_reference'
  | 'find_similar'
  | 'generate_palette'
  | 'rebalance_palette'
  | 'generate_outline'
  | 'generate_node'
  | 'summarize_diagram'
export type AiProviderType =
  | 'apple_foundation'
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'openrouter'
  | 'ollama'
  | 'lm_studio'
  | 'custom_openai_compatible'
  | 'codex'
  | 'claude_code'
export type AiAuthMode = 'local' | 'api_key' | 'oauth' | 'openai_compatible'
export type AiProviderStatus = 'connected' | 'unavailable' | 'billing_separate' | 'key_missing'
export type AiRoutingMode = 'local_only' | 'prefer_local' | 'selected_remote'
export type AiProviderProfile = {
  id: string
  type: AiProviderType
  name: string
  authMode: AiAuthMode
  baseUrl?: string
  model: string
  status: AiProviderStatus
  secretRef?: string
  defaultFor: AiTaskKind[]
  discoveredModels?: string[]
  lastTestedAt?: string
  lastMessage?: string
  userManaged?: boolean
}
export type AiSettingsSnapshot = {
  providers: AiProviderProfile[]
  routingMode: AiRoutingMode
  selectedProviderId: string
}
export type AiProviderTestResult = {
  connected: boolean
  status: string
  message: string
}
export type AiModelListResult = {
  status: string
  models: string[]
}
export type AiGenerationResult = {
  status: string
  content: string
}
export type ExtensionTargetStatus = {
  installed: boolean
  disabled: boolean
  available: boolean
  detail: string
  installPath: string
}
export type ExtensionInstallStatus = {
  chrome: ExtensionTargetStatus
  safari: ExtensionTargetStatus
}
export type AiTaskRoute = {
  task: AiTaskKind
  providerId: string | null
  providerName: string
  status: AiProviderStatus | 'local_fallback'
  reason: string
}

export const aiTaskLabels: Record<AiTaskKind, string> = {
  tag_reference: 'Tag reference',
  classify_reference: 'Classify reference',
  find_similar: 'Find similar',
  generate_palette: 'Generate palette',
  rebalance_palette: 'Rebalance palette',
  generate_outline: 'Generate outline',
  generate_node: 'Generate node',
  summarize_diagram: 'Summarize diagram',
}

// Grouped for the provider capability picker so 8 flat checkboxes read as
// two clusters instead of one dense row (DESIGN.md §2.1 — group before you
// dump everything at one altitude).
export const aiTaskGroups: { label: string; tasks: AiTaskKind[] }[] = [
  { label: 'Tagging', tasks: ['tag_reference', 'classify_reference', 'find_similar'] },
  {
    label: 'Canvas generation',
    tasks: ['generate_palette', 'rebalance_palette', 'generate_outline', 'generate_node', 'summarize_diagram'],
  },
]

export const aiProviderTypeLabels: Record<AiProviderType, string> = {
  apple_foundation: 'Apple Foundation Models',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Gemini',
  openrouter: 'OpenRouter',
  ollama: 'Ollama',
  lm_studio: 'LM Studio',
  custom_openai_compatible: 'OpenAI-compatible',
  codex: 'Codex',
  claude_code: 'Claude Code',
}

export const aiProviderStatusLabels: Record<AiProviderStatus, string> = {
  connected: 'connected',
  unavailable: 'unavailable',
  billing_separate: 'billing separate',
  key_missing: 'key missing',
}

export const aiProviderStatusCopy: Record<AiProviderStatus, string> = {
  connected: 'Ready for routed tasks.',
  unavailable: 'Configured, but not reachable from this device.',
  billing_separate: 'Subscription and API billing are separate.',
  key_missing: 'Save a key in secure storage before testing.',
}

export const aiRoutingLabels: Record<AiRoutingMode, string> = {
  local_only: 'Local only',
  prefer_local: 'Prefer local, fallback remote',
  selected_remote: 'Selected remote provider',
}

export const providerConnectionNotes = [
  {
    id: 'openai',
    title: 'OpenAI / ChatGPT',
    providerId: 'openai',
    truth: 'A ChatGPT subscription cannot be connected as API billing. KIRA needs an OpenAI Platform API key.',
    action: 'Paste an OpenAI API key',
    href: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'anthropic',
    title: 'Anthropic / Claude',
    providerId: 'anthropic',
    truth: 'A Claude subscription cannot be connected as API billing. KIRA needs an Anthropic Console API key.',
    action: 'Paste an Anthropic API key',
    href: 'https://console.anthropic.com/settings/keys',
  },
  {
    id: 'local',
    title: 'Local models',
    providerId: 'apple-foundation',
    truth: 'Local providers keep routing available when remote billing or keys are not ready.',
    action: 'Check local runtime',
    href: '',
  },
  {
    id: 'codex',
    title: 'Codex (ChatGPT login)',
    providerId: 'codex',
    truth: 'KIRA can sign you in with ChatGPT (or reuse an existing Codex login). Auth is owned by the Codex CLI; billing follows your ChatGPT/Codex plan.',
    action: 'Sign in with ChatGPT',
    href: '',
  },
]

// Where to mint a personal API key for the "bring your own key" flow, per provider type.
export function aiProviderKeyHelp(type: AiProviderType): { href: string; label: string } | null {
  switch (type) {
    case 'openai':
      return { href: 'https://platform.openai.com/api-keys', label: 'Get an OpenAI API key' }
    case 'anthropic':
      return { href: 'https://console.anthropic.com/settings/keys', label: 'Get an Anthropic API key' }
    case 'codex':
    case 'claude_code':
      return null
    default:
      return null
  }
}

export const extensionInstallTargets = [
  {
    id: 'chrome',
    title: 'Chrome / Chromium',
    status: 'Manual load',
    primary: 'Open bundled dist',
    secondary: 'Open extensions page',
    instruction: 'Open the bundled dist folder, then in Chrome Extensions enable Developer mode and Load unpacked.',
    path: 'Bundled in KIRA.app/Contents/Resources/.../extension/dist',
    href: 'chrome://extensions',
    installActionId: 'chrome_dist',
    settingsActionId: 'chrome',
  },
  {
    id: 'safari',
    title: 'Safari',
    status: 'Embedded',
    primary: 'Enable in Safari',
    secondary: 'Open Safari settings',
    instruction: 'KIRA includes the Safari extension. Enable KIRA Capture in Safari Extensions.',
    path: 'Embedded in KIRA.app/Contents/PlugIns',
    href: 'x-apple.systempreferences:com.apple.Safari-Settings.extension',
    installActionId: 'safari_app',
    settingsActionId: 'safari',
  },
]

export function defaultExtensionInstallStatus(): ExtensionInstallStatus {
  return {
    chrome: {
      installed: false,
      disabled: false,
      available: true,
      detail: 'Desktop status check not run',
      installPath: 'Bundled in KIRA.app/Contents/Resources/.../extension/dist',
    },
    safari: {
      installed: false,
      disabled: false,
      available: true,
      detail: 'Desktop status check not run',
      installPath: 'Embedded in KIRA.app/Contents/PlugIns',
    },
  }
}

export function extensionStatusForTarget(status: ExtensionInstallStatus, targetId: string) {
  return targetId === 'safari' ? status.safari : status.chrome
}

export const aiProviderTemplates: Record<Exclude<AiProviderType, 'apple_foundation'>, Omit<AiProviderProfile, 'id' | 'userManaged'>> = {
  openai: {
    type: 'openai',
    name: 'OpenAI Platform',
    authMode: 'api_key',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4.1-mini',
    status: 'key_missing',
    defaultFor: ['generate_outline', 'generate_node', 'summarize_diagram'],
  },
  anthropic: {
    type: 'anthropic',
    name: 'Anthropic Console',
    authMode: 'api_key',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-6',
    status: 'key_missing',
    defaultFor: ['generate_outline', 'generate_node'],
  },
  gemini: {
    type: 'gemini',
    name: 'Gemini API',
    authMode: 'api_key',
    baseUrl: 'https://generativelanguage.googleapis.com',
    model: 'gemini-1.5-pro',
    status: 'key_missing',
    defaultFor: ['classify_reference', 'generate_palette', 'generate_node'],
  },
  openrouter: {
    type: 'openrouter',
    name: 'OpenRouter',
    authMode: 'openai_compatible',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'auto',
    status: 'key_missing',
    defaultFor: ['find_similar', 'generate_outline', 'generate_node'],
  },
  ollama: {
    type: 'ollama',
    name: 'Ollama',
    authMode: 'openai_compatible',
    baseUrl: 'http://localhost:11434/v1',
    model: 'llama3.2',
    status: 'unavailable',
    defaultFor: ['tag_reference', 'classify_reference', 'generate_node'],
  },
  lm_studio: {
    type: 'lm_studio',
    name: 'LM Studio',
    authMode: 'openai_compatible',
    baseUrl: 'http://localhost:1234/v1',
    model: 'local-model',
    status: 'unavailable',
    defaultFor: ['tag_reference', 'generate_node'],
  },
  custom_openai_compatible: {
    type: 'custom_openai_compatible',
    name: 'Custom OpenAI-compatible',
    authMode: 'openai_compatible',
    baseUrl: 'http://localhost:8000/v1',
    model: 'model-id',
    status: 'key_missing',
    defaultFor: ['generate_node'],
  },
  codex: {
    type: 'codex',
    name: 'Codex CLI (ChatGPT login)',
    authMode: 'oauth',
    model: 'gpt-5.5',
    status: 'unavailable',
    defaultFor: ['generate_outline', 'generate_node', 'summarize_diagram'],
  },
  claude_code: {
    type: 'claude_code',
    name: 'Claude Code (CLI)',
    authMode: 'oauth',
    model: 'claude-sonnet-4-6',
    status: 'unavailable',
    defaultFor: [],
  },
}

// Types addable a second time from "Add other provider" — CLI singletons (codex, claude_code) and the
// local runtime (apple_foundation) are fixed default entries, not user-instantiable duplicates.
export const addableProviderTypes = (Object.keys(aiProviderTemplates) as Exclude<AiProviderType, 'apple_foundation'>[]).filter(
  (type) => type !== 'codex' && type !== 'claude_code',
)

// The handful of providers shown up front in Settings > AI Providers; everything else (extra
// OpenAI-compatible endpoints, Ollama, LM Studio, OpenRouter, Gemini, duplicate profiles) lives
// behind the "More providers" disclosure so the default view stays a short, obvious list.
export const primaryProviderTypeOrder: AiProviderType[] = ['apple_foundation', 'claude_code', 'codex', 'openai', 'anthropic']

export function formatMetadataTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

export type CodexLoginEvent =
  | { type: 'oauth_url'; url: string }
  | { type: 'device_code'; verificationUrl: string; userCode: string }
  | { type: 'success' }
  | { type: 'error'; message: string }

export function requestCodexLogin(method: 'chatgpt' | 'device' | 'api-key', apiKey?: string) {
  return invoke<void>('codex_login', { method, apiKey })
}

export function cancelCodexLogin() {
  return invoke<void>('codex_cancel_login')
}

export function codexLogout() {
  return invoke<void>('codex_logout')
}

// Opens Terminal with `claude auth login` running. KIRA shows no login UI of its own and never
// handles the token — the CLI owns the flow end to end.
export function openClaudeCodeLoginTerminal() {
  return invoke<void>('claude_code_open_login_terminal')
}

export function onCodexLoginProgress(callback: (event: CodexLoginEvent) => void) {
  return listen<CodexLoginEvent>('codex://login', (event) => callback(event.payload))
}

// Detects the native error surfaced when a Codex (ChatGPT OAuth) provider runs a
// generation while the user is signed out. Used to turn a raw error into an
// actionable "sign in" prompt instead of dumping the message into the node body.
export function isCodexLoggedOutError(message: string): boolean {
  return /not signed in|sign in with chatgpt|not logged in/i.test(message)
}
