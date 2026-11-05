// Chat tab content: thread messages + composer, on assistant-ui's headless
// primitives (ThreadPrimitive/ComposerPrimitive/MessagePrimitive) driven by
// ExternalStoreRuntime over AiPanelState — the library never touches the
// network itself; `onSend` is the only call-out (spike report §3).
//
// Untitled UI React conversion (PHA 3, 2026-09-16): extracted out of
// main.tsx (was `function KiraChatThreadView` inline, ~2192-2361, plus its
// two module-scope helpers `toKiraThreadMessage`/`RunDetailRow` at
// ~2128/2156 — moved here since neither is used anywhere else). The
// composer itself stays `ComposerPrimitive.Input`/`.Send` (D1 in
// DECISIONS.md: "Tab Chat dựng trên assistant-ui primitives") — assistant-ui
// owns that textarea's value/onChange/submit wiring internally, so swapping
// it for the kit's `TextArea`/`Input` component (which needs to own that
// same state) would fight the runtime instead of restyling it. Only the two
// empty-state actions ("thử ví dụ", "Kết nối model") and the "connect
// model" fallback in the status row are real standalone buttons — those
// moved to kit `Button`.
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useExternalStoreRuntime,
  type AppendMessage,
  type ThreadMessageLike,
} from '@assistant-ui/react'
import { AlertTriangle, ArrowUp, Check, ChevronDown, MessageSquare, Settings, Sparkles, Unplug } from 'lucide-react'
import { Button } from '@/components/base/buttons/button'
import type { AiMessage, AiPanelState, AiRun } from '@/kira/aiPanelTypes'

type TFn = (key: string, vars?: Record<string, string>) => string

function toKiraThreadMessage(message: AiMessage): ThreadMessageLike {
  return {
    role: message.role === 'system-error' ? 'system' : message.role,
    id: message.id,
    createdAt: new Date(message.createdAt),
    content: message.text,
  }
}

function RunDetailRow({ run, t, formatClockTime }: { run: AiRun | undefined; t: TFn; formatClockTime: (iso: string) => string }) {
  const [open, setOpen] = useState(false)
  if (!run) return null
  const elapsedMs = run.finishedAt ? new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime() : null
  return (
    <div className="run-line">
      <span className={run.status === 'error' ? 'state-err' : run.status === 'running' ? 'state-idle' : 'state-ok'}>
        {run.status === 'error' ? <AlertTriangle size={11} /> : run.status === 'running' ? null : <Check size={11} />}
        {run.status === 'error' ? t('kira.run.error') : run.status === 'running' ? t('kira.run.running') : t('kira.run.done')}
      </span>
      <span className="row-sub">
        {run.modelLabel}
        {elapsedMs != null ? ` · ${(elapsedMs / 1000).toFixed(1)}s` : ''}
      </span>
      <Button color="tertiary" size="xs" className="run-disclosure" aria-expanded={open} onPress={() => setOpen((current) => !current)}>
        {t('kira.run.detail')}
        <ChevronDown size={11} />
      </Button>
      {open && (
        <dl className="run-detail">
          <div><dt>{t('kira.run.provider')}</dt><dd>{run.providerType}</dd></div>
          <div><dt>{t('kira.run.model')}</dt><dd className="run-detail-model">{run.modelLabel}</dd></div>
          <div><dt>{t('kira.run.started')}</dt><dd className="num">{formatClockTime(run.startedAt)}</dd></div>
          <div><dt>{t('kira.run.prompt')}</dt><dd className="run-detail-prompt">{run.promptPreview}</dd></div>
        </dl>
      )}
    </div>
  )
}

export function KiraChatThreadView({
  aiPanelState,
  threadId,
  modelControl,
  hasProvider,
  t,
  formatClockTime,
  emptyExamples,
  onSend,
  onOpenAiSettings,
}: {
  aiPanelState: AiPanelState
  threadId: string
  // The model picker for this chat (ModelPicker), shown under the composer.
  modelControl: ReactNode
  // No routed provider means nothing this panel sends can ever get an
  // answer. The whole empty state, the placeholder and the status row below
  // the composer change together so the panel never invites a message it
  // cannot deliver (DESIGN.md §5 Plain-Language Rule).
  hasProvider: boolean
  t: TFn
  formatClockTime: (iso: string) => string
  // Two real board prompts, reused verbatim from the dock's suggestion tray
  // so the empty state never advertises a capability the app does not have.
  // Two, not the full set, per DESIGN.md §5 One Density Rule. Computed by
  // the caller (main.tsx, from `kiraSuggestions.board`) since that table
  // stays module-scope in main.tsx.
  emptyExamples: { id: string; label: string; prompt: string }[]
  onSend: (text: string) => void | Promise<void>
  onOpenAiSettings: () => void
}) {
  const messages = useMemo(
    () => aiPanelState.messages.filter((message) => message.threadId === threadId),
    [aiPanelState.messages, threadId],
  )
  const runsById = useMemo(
    () => new Map(aiPanelState.runs.filter((run) => run.threadId === threadId).map((run) => [run.id, run] as const)),
    [aiPanelState.runs, threadId],
  )
  const isRunning = useMemo(
    () => aiPanelState.runs.some((run) => run.threadId === threadId && run.status === 'running'),
    [aiPanelState.runs, threadId],
  )
  const messagesRef = useRef(messages)
  messagesRef.current = messages
  const convertedMessages = useMemo(() => messages.map(toKiraThreadMessage), [messages])
  const isThreadEmpty = convertedMessages.length === 0

  const onNew = useCallback(
    async (appended: AppendMessage) => {
      const text = appended.content
        .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
        .map((part) => part.text)
        .join('')
      await onSend(text)
    },
    [onSend],
  )

  const runtime = useExternalStoreRuntime({
    messages: convertedMessages,
    isRunning,
    onNew,
    convertMessage: (message) => message,
  })

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadPrimitive.Root className="kira-thread">
        <ThreadPrimitive.Viewport className="kira-thread-viewport" role="log" aria-live="polite" aria-label={t('kira.panel.tabChat')}>
          <ThreadPrimitive.Empty>
            {hasProvider ? (
              <div className="kp-empty">
                <MessageSquare size={22} />
                <h4>{t('kira.panel.emptyTitle')}</h4>
                <p>{t('kira.panel.emptyBody')}</p>
                <div className="kp-empty-examples">
                  <span className="kp-empty-examples-label">{t('kira.panel.emptyTryLabel')}</span>
                  {emptyExamples.map((example) => (
                    <Button
                      key={example.id}
                      color="tertiary"
                      size="sm"
                      iconLeading={Sparkles}
                      className="kp-empty-example"
                      onPress={() => void onSend(example.prompt)}
                    >
                      {example.label}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="kp-empty">
                <Unplug size={22} />
                <h4>{t('kira.panel.emptyNoProviderTitle')}</h4>
                <p>{t('kira.panel.emptyNoProviderBody')}</p>
                <Button color="secondary" size="sm" iconLeading={Settings} className="kp-empty-action" onPress={onOpenAiSettings}>
                  {t('kira.panel.connectModel')}
                </Button>
              </div>
            )}
          </ThreadPrimitive.Empty>
          <ThreadPrimitive.Messages>
            {({ message }) => {
              const source = messagesRef.current.find((candidate) => candidate.id === message.id)
              const createdAt = source?.createdAt ?? new Date().toISOString()
              const run = source?.runId ? runsById.get(source.runId) : undefined
              if (message.role === 'user') {
                return (
                  <MessagePrimitive.Root className="msg">
                    <div className="msg-head"><b>{t('kira.panel.you')}</b><span className="num">{formatClockTime(createdAt)}</span></div>
                    <div className="msg-user"><MessagePrimitive.Content /></div>
                  </MessagePrimitive.Root>
                )
              }
              if (message.role === 'system') {
                return (
                  <MessagePrimitive.Root className="msg">
                    <div className="msg-head"><b>Kira</b><span className="num">{formatClockTime(createdAt)}</span></div>
                    <div className="run-error" role="status">
                      <span className="state-err"><AlertTriangle size={11} />{t('kira.run.error')}</span>{' '}
                      <MessagePrimitive.Content />
                    </div>
                  </MessagePrimitive.Root>
                )
              }
              return (
                <MessagePrimitive.Root className="msg">
                  <div className="msg-head"><b>Kira</b><span className="num">{formatClockTime(createdAt)}</span></div>
                  <div className="msg-ai"><MessagePrimitive.Content /></div>
                  <RunDetailRow run={run} t={t} formatClockTime={formatClockTime} />
                </MessagePrimitive.Root>
              )
            }}
          </ThreadPrimitive.Messages>
        </ThreadPrimitive.Viewport>
        <ComposerPrimitive.Root className="composer">
          <ComposerPrimitive.Input
            className="composer-input"
            placeholder={hasProvider
              ? t('kira.panel.composerPlaceholder')
              : t('kira.panel.composerPlaceholderNoProvider')}
            aria-label={t('kira.panel.send')}
            rows={1}
          />
          <ComposerPrimitive.Send className="send" aria-label={t('kira.panel.send')}>
            <ArrowUp size={14} />
          </ComposerPrimitive.Send>
        </ComposerPrimitive.Root>
        <div className={hasProvider ? 'composer-meta' : 'composer-meta is-blocked'}>
          {hasProvider ? (
            modelControl
          ) : (
            <>
              <span>{t('kira.panel.noModelStatus')}</span>
              {/* The empty state already carries this action, so the row only
                  repeats it once the thread has content and the empty state is
                  gone: a user who typed and got the "not connected" reply still
                  has a way out, without two identical buttons on one screen. */}
              {!isThreadEmpty && (
                <Button color="tertiary" size="sm" onPress={onOpenAiSettings}>
                  {t('kira.panel.connectModel')}
                </Button>
              )}
            </>
          )}
        </div>
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  )
}
