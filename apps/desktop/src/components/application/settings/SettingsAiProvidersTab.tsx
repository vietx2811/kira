import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/base/buttons/button'
import { Badge } from '@/components/base/badges/badges'
import { Input } from '@/components/base/input/input'
import { Checkbox } from '@/components/base/checkbox/checkbox'
import { StringSelect } from './StringSelect'
import { CodexApiKeyField } from './CodexApiKeyField'
import { ClaudeCodeStatus } from './ClaudeCodeStatus'
import { DeleteProviderDialog } from './DeleteProviderDialog'
import type { AiAuthMode, AiProviderProfile, AiProviderType, AiTaskKind, CodexLoginEvent } from '@/kira/ai/aiProviderDomain'
import {
  addableProviderTypes,
  aiProviderKeyHelp,
  aiProviderStatusCopy,
  aiProviderStatusLabels,
  aiProviderTypeLabels,
  aiTaskGroups,
  aiTaskLabels,
  cancelCodexLogin,
  codexLogout,
  formatMetadataTime,
  onCodexLoginProgress,
  primaryProviderTypeOrder,
  requestCodexLogin,
} from '@/kira/ai/aiProviderDomain'

export function SettingsAiProvidersTab({
  providers,
  activeProviderId,
  onActiveProviderChange,
  onProviderAdd,
  onProviderChange,
  onProviderDelete,
  onProviderSecretSave,
  onProviderSecretDelete,
  onProviderTest,
  onProviderModelsList,
  onProviderTaskToggle,
}: {
  providers: AiProviderProfile[]
  activeProviderId: string
  onActiveProviderChange: (providerId: string) => void
  onProviderAdd: (type: Exclude<AiProviderType, 'apple_foundation'>) => void
  onProviderChange: (providerId: string, patch: Partial<Pick<AiProviderProfile, 'name' | 'baseUrl' | 'model' | 'authMode'>>) => void
  onProviderDelete: (providerId: string) => void
  onProviderSecretSave: (providerId: string, secret: string) => void
  onProviderSecretDelete: (providerId: string) => void
  onProviderTest: (providerId: string) => void | Promise<void>
  onProviderModelsList: (providerId: string) => void | Promise<void>
  onProviderTaskToggle: (providerId: string, task: AiTaskKind) => void
}) {
  const activeProvider = providers.find((provider) => provider.id === activeProviderId) ?? providers[0]
  const primaryProviders = primaryProviderTypeOrder
    .map((type) => providers.find((provider) => provider.type === type))
    .filter((provider): provider is AiProviderProfile => Boolean(provider))
  const primaryProviderIds = new Set(primaryProviders.map((provider) => provider.id))
  const moreProviders = providers.filter((provider) => !primaryProviderIds.has(provider.id))

  const [secretDrafts, setSecretDrafts] = useState<Record<string, string>>({})
  const [codexLoginBusy, setCodexLoginBusy] = useState(false)
  const [codexLoginEvent, setCodexLoginEvent] = useState<CodexLoginEvent | null>(null)
  const [codexLoginSlow, setCodexLoginSlow] = useState(false)
  const codexAutoOpenedUrlRef = useRef<string | null>(null)
  // onProviderTest/onProviderModelsList are async under the hood (native IPC
  // calls) but were previously fired with no feedback at all — not even a
  // disabled button — so a double-click could fire the same probe twice.
  const [providerBusy, setProviderBusy] = useState<{ id: string; action: 'test' | 'models' } | null>(null)
  const [pendingDeleteProviderId, setPendingDeleteProviderId] = useState<string | null>(null)
  const pendingDeleteProvider = pendingDeleteProviderId ? (providers.find((provider) => provider.id === pendingDeleteProviderId) ?? null) : null
  const [providerTypeDraft, setProviderTypeDraft] = useState<Exclude<AiProviderType, 'apple_foundation'>>(addableProviderTypes[0])

  async function handleProviderTest(providerId: string) {
    setProviderBusy({ id: providerId, action: 'test' })
    try {
      await onProviderTest(providerId)
    } finally {
      setProviderBusy((current) => (current?.id === providerId && current.action === 'test' ? null : current))
    }
  }
  async function handleProviderModelsList(providerId: string) {
    setProviderBusy({ id: providerId, action: 'models' })
    try {
      await onProviderModelsList(providerId)
    } finally {
      setProviderBusy((current) => (current?.id === providerId && current.action === 'models' ? null : current))
    }
  }

  const activeProviderType = activeProvider?.type
  const activeProviderId_ = activeProvider?.id

  useEffect(() => {
    if (activeProviderType !== 'codex') return
    let unlisten: (() => void) | undefined
    void onCodexLoginProgress((event) => {
      setCodexLoginEvent(event)
      // The bundled codex binary is spawned headlessly (no TTY), so its own browser-open
      // attempt isn't reliable. Open the sign-in URL ourselves the moment it arrives, instead
      // of leaving the user staring at a spinner with only a small fallback link to notice.
      const urlToOpen = event.type === 'oauth_url' ? event.url : event.type === 'device_code' ? event.verificationUrl : null
      if (urlToOpen && codexAutoOpenedUrlRef.current !== urlToOpen) {
        codexAutoOpenedUrlRef.current = urlToOpen
        window.open(urlToOpen, '_blank', 'noopener,noreferrer')
      }
    }).then((u) => {
      unlisten = u
    })
    return () => unlisten?.()
  }, [activeProviderType])

  // If the login flow stays busy with no resolution for a while, surface a reassurance/escape
  // hatch instead of leaving the user guessing whether the app is stuck.
  useEffect(() => {
    if (!codexLoginBusy) {
      setCodexLoginSlow(false)
      return
    }
    const timer = window.setTimeout(() => setCodexLoginSlow(true), 15000)
    return () => window.clearTimeout(timer)
  }, [codexLoginBusy])

  // Reuse the existing Test-button handler (onProviderTest -> testAiProvider) to refresh provider status.
  function refreshCodexStatus() {
    if (activeProviderId_) onProviderTest(activeProviderId_)
  }

  async function startCodexLogin(method: 'chatgpt' | 'device' | 'api-key', apiKey?: string) {
    setCodexLoginBusy(true)
    setCodexLoginEvent(null)
    codexAutoOpenedUrlRef.current = null
    try {
      await requestCodexLogin(method, apiKey)
      refreshCodexStatus()
    } catch (error) {
      setCodexLoginEvent({ type: 'error', message: error instanceof Error ? error.message : String(error) })
    } finally {
      setCodexLoginBusy(false)
    }
  }

  function renderProviderRow(provider: AiProviderProfile) {
    const isActive = provider.id === activeProvider.id
    return (
      <button
        type="button"
        key={provider.id}
        aria-pressed={isActive}
        onClick={() => onActiveProviderChange(provider.id)}
        className={[
          'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left transition duration-100 ease-linear',
          isActive ? 'bg-active text-primary' : 'text-secondary hover:bg-primary_hover',
        ].join(' ')}
      >
        <span className="flex min-w-0 flex-col">
          <strong className="truncate text-sm font-semibold" title={provider.name}>
            {provider.name}
          </strong>
          <em className="truncate text-xs not-italic text-tertiary" title={aiProviderTypeLabels[provider.type]}>
            {aiProviderTypeLabels[provider.type]}
          </em>
        </span>
        <small className="shrink-0 text-xs text-tertiary">{aiProviderStatusLabels[provider.status]}</small>
      </button>
    )
  }

  return (
    <section className="flex flex-col gap-4" id="settings-providers">
      <div className="grid grid-cols-[220px_minmax(0,1fr)] gap-5">
        <aside className="flex flex-col gap-3" aria-label="Provider registry">
          <div className="flex flex-col gap-0.5">{primaryProviders.map(renderProviderRow)}</div>

          <details className="rounded-lg border border-secondary p-2">
            <summary className="flex cursor-pointer items-center justify-between gap-2 px-1 py-1">
              <h3 className="text-sm font-semibold text-primary">More providers</h3>
              <Badge color="gray" size="sm">
                {moreProviders.length}
              </Badge>
            </summary>
            <div className="mt-1 flex flex-col gap-0.5">{moreProviders.map(renderProviderRow)}</div>
            <div className="mt-2 flex items-center gap-2 border-t border-secondary pt-2">
              <StringSelect
                aria-label="Provider type"
                value={providerTypeDraft}
                onChange={(value) => setProviderTypeDraft(value as Exclude<AiProviderType, 'apple_foundation'>)}
                options={addableProviderTypes.map((type) => ({ value: type, label: aiProviderTypeLabels[type] }))}
                size="sm"
                className="flex-1"
              />
              <Button color="secondary" size="sm" onPress={() => onProviderAdd(providerTypeDraft)}>
                Add
              </Button>
            </div>
          </details>
        </aside>

        {activeProvider && (
          <article className="flex flex-col gap-4 rounded-lg border border-secondary p-4">
            <div className="flex items-start justify-between gap-3 border-b border-secondary pb-3">
              <div className="flex flex-col gap-0.5">
                <strong className="text-md font-semibold text-primary">{activeProvider.name}</strong>
                <span className="text-sm text-tertiary">
                  {aiProviderTypeLabels[activeProvider.type]} · {aiProviderStatusCopy[activeProvider.status]}
                </span>
              </div>
              <Badge color={activeProvider.status === 'connected' ? 'success' : activeProvider.status === 'key_missing' ? 'warning' : 'gray'} size="md">
                {aiProviderStatusLabels[activeProvider.status]}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Name"
                size="sm"
                value={activeProvider.name}
                onChange={(value) => onProviderChange(activeProvider.id, { name: value })}
                isDisabled={activeProvider.authMode === 'local'}
              />
              {activeProvider.discoveredModels && activeProvider.discoveredModels.length > 0 ? (
                <StringSelect
                  label="Model"
                  value={activeProvider.model}
                  onChange={(value) => onProviderChange(activeProvider.id, { model: value })}
                  options={activeProvider.discoveredModels.map((model) => ({ value: model, label: model }))}
                  size="sm"
                />
              ) : (
                <Input
                  label="Model"
                  size="sm"
                  value={activeProvider.model}
                  onChange={(value) => onProviderChange(activeProvider.id, { model: value })}
                  isDisabled={activeProvider.authMode === 'local'}
                />
              )}
            </div>

            {activeProvider.type !== 'codex' && activeProvider.type !== 'claude_code' && (
              <details className="rounded-lg border border-secondary p-3">
                <summary className="flex cursor-pointer items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-primary">Advanced</h3>
                  <span className="text-xs text-tertiary">Auth mode · Base URL</span>
                </summary>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <StringSelect
                    label="Auth mode"
                    value={activeProvider.authMode}
                    onChange={(value) => onProviderChange(activeProvider.id, { authMode: value as AiAuthMode })}
                    options={[
                      { value: 'local', label: 'local' },
                      { value: 'api_key', label: 'api_key' },
                      { value: 'oauth', label: 'oauth' },
                      { value: 'openai_compatible', label: 'openai_compatible' },
                    ]}
                    isDisabled={activeProvider.authMode === 'local'}
                    size="sm"
                  />
                  <Input
                    label="Base URL"
                    size="sm"
                    value={activeProvider.baseUrl ?? ''}
                    placeholder={activeProvider.authMode === 'local' ? 'local runtime' : 'https://api.example.com/v1'}
                    onChange={(value) => onProviderChange(activeProvider.id, { baseUrl: value })}
                    isDisabled={activeProvider.authMode === 'local'}
                  />
                </div>

                {activeProvider.authMode === 'oauth' && (
                  <div className="mt-3 flex flex-col gap-1 rounded-lg bg-warning-secondary p-3">
                    <strong className="text-sm font-semibold text-warning-primary">OAuth is for enterprise gateways only</strong>
                    <span className="text-sm text-warning-primary">
                      Claude Pro/Max and ChatGPT Plus subscriptions cannot be connected by OAuth. Since February 2026 Anthropic and OpenAI restrict
                      subscription tokens to their own apps. For Claude or OpenAI, switch this profile to <strong>API key</strong> and bring your own key.
                    </span>
                  </div>
                )}
              </details>
            )}

            {activeProvider.type === 'codex' ? (
              <div className="flex flex-col gap-3">
                {activeProvider.status === 'connected' ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="size-2 shrink-0 rounded-full bg-fg-success-primary" aria-hidden="true" />
                    <span className="text-sm text-secondary">{activeProvider.lastMessage ?? 'Signed in to Codex'}</span>
                    <Button
                      color="tertiary"
                      size="sm"
                      onPress={() => {
                        void codexLogout().then(() => refreshCodexStatus())
                      }}
                    >
                      Sign out
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <Button color="primary" size="md" isDisabled={codexLoginBusy} isLoading={codexLoginBusy} onPress={() => startCodexLogin('chatgpt')}>
                      Sign in with ChatGPT
                    </Button>
                    <div className="flex items-center gap-2">
                      <Button color="secondary" size="sm" isDisabled={codexLoginBusy} onPress={() => startCodexLogin('device')}>
                        Use a sign-in code
                      </Button>
                      {codexLoginBusy && (
                        <Button
                          color="secondary"
                          size="sm"
                          onPress={() => {
                            void cancelCodexLogin()
                          }}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                    <details>
                      <summary className="cursor-pointer text-sm font-medium text-brand-secondary">Use an API key instead</summary>
                      <CodexApiKeyField busy={codexLoginBusy} onSubmit={(key) => startCodexLogin('api-key', key)} />
                    </details>
                  </div>
                )}
                {codexLoginEvent?.type === 'oauth_url' && (
                  <p className="text-sm text-tertiary">
                    Opened a sign-in tab. Didn&rsquo;t see it?{' '}
                    <a
                      href={codexLoginEvent.url}
                      className="text-brand-secondary underline"
                      onClick={(event) => {
                        event.preventDefault()
                        window.open(codexLoginEvent.url, '_blank', 'noopener,noreferrer')
                      }}
                    >
                      Open it again
                    </a>
                  </p>
                )}
                {codexLoginBusy && codexLoginSlow && (
                  <p className="text-sm text-tertiary">
                    Still waiting on the browser sign-in. Finish it in the opened tab, or{' '}
                    <a
                      href="#"
                      className="text-brand-secondary underline"
                      onClick={(event) => {
                        event.preventDefault()
                        void cancelCodexLogin()
                      }}
                    >
                      cancel
                    </a>{' '}
                    and try a sign-in code instead.
                  </p>
                )}
                {codexLoginEvent?.type === 'device_code' && (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg bg-secondary p-3 text-sm">
                    <span>
                      Open{' '}
                      <a
                        href={codexLoginEvent.verificationUrl}
                        className="text-brand-secondary underline"
                        onClick={(event) => {
                          event.preventDefault()
                          window.open(codexLoginEvent.verificationUrl, '_blank', 'noopener,noreferrer')
                        }}
                      >
                        {codexLoginEvent.verificationUrl}
                      </a>{' '}
                      and enter
                    </span>
                    <code className="rounded bg-primary px-1.5 py-0.5 font-mono text-xs">{codexLoginEvent.userCode}</code>
                    <Button
                      color="tertiary"
                      size="sm"
                      onPress={() => {
                        void navigator.clipboard.writeText(codexLoginEvent.userCode)
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                )}
                {codexLoginEvent?.type === 'error' && <p className="text-sm text-error-primary">{codexLoginEvent.message}</p>}
              </div>
            ) : activeProvider.type === 'claude_code' ? (
              <ClaudeCodeStatus provider={activeProvider} />
            ) : activeProvider.authMode !== 'local' ? (
              <div className="flex flex-col gap-1.5">
                <Input
                  label="API key"
                  size="sm"
                  type="password"
                  value={secretDrafts[activeProvider.id] ?? ''}
                  placeholder={activeProvider.secretRef ? 'Stored in Keychain' : 'Paste your own API key (sk-…)'}
                  onChange={(value) => setSecretDrafts((current) => ({ ...current, [activeProvider.id]: value }))}
                />
                {(() => {
                  const help = aiProviderKeyHelp(activeProvider.type)
                  return help ? (
                    <a className="text-sm text-brand-secondary underline" href={help.href} target="_blank" rel="noreferrer">
                      {help.label} ↗
                    </a>
                  ) : null
                })()}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2 border-t border-secondary pt-3">
              {activeProvider.authMode !== 'local' && activeProvider.type !== 'codex' && activeProvider.type !== 'claude_code' && (
                <>
                  <Button
                    color={activeProvider.secretRef ? 'secondary' : 'primary'}
                    size="sm"
                    onPress={() => {
                      onProviderSecretSave(activeProvider.id, secretDrafts[activeProvider.id] ?? '')
                      setSecretDrafts((current) => ({ ...current, [activeProvider.id]: '' }))
                    }}
                  >
                    Save key
                  </Button>
                  {activeProvider.secretRef && (
                    <Button color="secondary" size="sm" onPress={() => onProviderSecretDelete(activeProvider.id)}>
                      Remove key
                    </Button>
                  )}
                </>
              )}
              <Button
                color="secondary"
                size="sm"
                isDisabled={providerBusy?.id === activeProvider.id}
                isLoading={providerBusy?.id === activeProvider.id && providerBusy.action === 'test'}
                onPress={() => void handleProviderTest(activeProvider.id)}
              >
                Test
              </Button>
              <Button
                color="tertiary"
                size="sm"
                isDisabled={providerBusy?.id === activeProvider.id}
                isLoading={providerBusy?.id === activeProvider.id && providerBusy.action === 'models'}
                onPress={() => void handleProviderModelsList(activeProvider.id)}
              >
                Models
              </Button>
              {activeProvider.authMode !== 'local' && (
                <Button color="link-destructive" size="sm" className="ml-auto" onPress={() => setPendingDeleteProviderId(activeProvider.id)}>
                  Delete profile
                </Button>
              )}
            </div>

            <div className="flex flex-col gap-3 border-t border-secondary pt-3" aria-label="Default tasks for active provider">
              {aiTaskGroups.map((group) => (
                <div className="flex flex-col gap-1.5" key={group.label}>
                  <span className="text-xs font-semibold text-tertiary uppercase">{group.label}</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {group.tasks.map((task) => (
                      <Checkbox
                        key={task}
                        size="sm"
                        label={aiTaskLabels[task]}
                        isSelected={activeProvider.defaultFor.includes(task)}
                        onChange={() => onProviderTaskToggle(activeProvider.id, task)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-secondary pt-3 text-xs text-tertiary" aria-label="Provider runtime status">
              <span>{activeProvider.authMode === 'local' ? 'Local runtime' : activeProvider.secretRef ? 'Keychain secret' : 'No secret'}</span>
              <span>{activeProvider.lastTestedAt ? `Tested ${formatMetadataTime(activeProvider.lastTestedAt)}` : 'Untested'}</span>
              {activeProvider.lastMessage && <span>{activeProvider.lastMessage}</span>}
            </div>
          </article>
        )}
      </div>

      <DeleteProviderDialog provider={pendingDeleteProvider} onCancel={() => setPendingDeleteProviderId(null)} onConfirm={(id) => {
        onProviderDelete(id)
        setPendingDeleteProviderId(null)
      }} />
    </section>
  )
}
