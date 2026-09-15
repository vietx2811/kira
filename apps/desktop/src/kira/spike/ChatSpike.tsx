/**
 * SPIKE — not wired into the app. Answers D11 (docs/research/2026-09-15-spike-assistant-ui.md):
 * can assistant-ui's headless primitives drive the Kira right panel's Chat tab, styled with
 * KIRA's own CSS only (no Tailwind, no shadcn), fed by our own state via ExternalStoreRuntime?
 *
 * State shape reuses the real data-layer types from ../aiPanelTypes (AiThread/AiMessage/AiRun),
 * so this is a faithful stand-in for how main.tsx would wire the panel later — just with a
 * useState in place of the app's zustand store, and a setTimeout in place of
 * invoke('generate_ai_text'). Neither assistant-ui nor this component ever touches the network,
 * a vendor backend, or an API key: onSend below is the only place a future call would go.
 *
 * Fixture content mirrors docs/design/right-panel/mockup.js `chatThread()` (Hanoi noir branch
 * scenario) so the rendered spike is comparable to the approved mockup screenshots.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useExternalStoreRuntime,
  type AppendMessage,
  type ThreadMessageLike,
} from '@assistant-ui/react'
import type { AiMessage, AiNodeRef, AiRun, AiThread } from '../aiPanelTypes'

let idCounter = 0
function spikeId(prefix: string): string {
  idCounter += 1
  return `${prefix}-${idCounter}`
}
function nowIso(): string {
  return new Date().toISOString()
}
function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

// ---------------------------------------------------------------------------
// Fixture data — shape mirrors mockup.js chatThread(); real usage would come
// from the app's AiPanelState (aiPanelModel.ts) instead of local useState.
// ---------------------------------------------------------------------------

const THREAD: AiThread = {
  id: 'thread-hanoi-noir',
  title: 'Tách nhánh concept Hanoi noir',
  createdAt: nowIso(),
  updatedAt: nowIso(),
  anchorNodeIds: ['idea:hanoi-noir-cafe'],
}

const CONTEXT_CHIPS: AiNodeRef[] = [{ kind: 'idea', id: 'idea:hanoi-noir-cafe' }]

function initialMessages(): AiMessage[] {
  return [
    {
      id: 'm-1',
      threadId: THREAD.id,
      role: 'user',
      text: 'Tách node này thành 3 nhánh concept có thể dựng moodboard riêng. Mỗi nhánh một câu định hướng.',
      createdAt: nowIso(),
      contextNodes: CONTEXT_CHIPS,
    },
    {
      id: 'm-2',
      threadId: THREAD.id,
      role: 'assistant',
      text: [
        'Ba nhánh, xếp theo độ khác biệt so với node gốc:',
        '- Quầy bar ánh đồng. Kim loại ấm, ánh sáng chỉ từ quầy.',
        '- Phố cổ sau mưa. Phản chiếu biển hiệu, tương phản thấp.',
        '- Hơi nước và kính mờ. Chi tiết cận, gần như đơn sắc.',
      ].join('\n'),
      createdAt: nowIso(),
      runId: 'run-1',
      contextNodes: [],
    },
  ]
}

function initialRuns(): AiRun[] {
  return [
    {
      id: 'run-1',
      threadId: THREAD.id,
      providerType: 'claude_code',
      modelLabel: 'claude-sonnet-5',
      startedAt: nowIso(),
      finishedAt: nowIso(),
      status: 'done',
      promptPreview:
        'You are assisting an art director. Split the selected idea "Hanoi noir: quán cà phê đêm" into 3 concept branches…',
      resultSummary: 'Tạo 2 node, đề xuất 3 thay đổi',
    },
  ]
}

// ---------------------------------------------------------------------------
// convertMessage: AiMessage -> ThreadMessageLike (assistant-ui's own shape).
// 'system-error' maps to role "system" so ThreadPrimitive.Messages can route
// it to a distinct SystemMessage component (mockup .run-error block).
// ---------------------------------------------------------------------------

function toThreadMessageLike(message: AiMessage): ThreadMessageLike {
  const role = message.role === 'system-error' ? 'system' : message.role
  return {
    role,
    id: message.id,
    createdAt: new Date(message.createdAt),
    content: message.text,
  }
}

// ---------------------------------------------------------------------------
// simulateGenerate stands in for invoke('generate_ai_text', {...}) — the
// one-shot native call main.tsx would make. Typing a message containing
// "error" / "lỗi" exercises the in-thread error path (mockup run-error /
// dockStatus 'error' copy: Codex timeout).
// ---------------------------------------------------------------------------

function simulateGenerate(promptText: string): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const triggersError = /error|lỗi/i.test(promptText)
  return new Promise((resolve) => {
    setTimeout(() => {
      if (triggersError) {
        resolve({ ok: false, error: 'Codex không trả lời trong 60 giây. Chưa có gì thay đổi trên canvas.' })
      } else {
        resolve({
          ok: true,
          text: [
            `Đã nhận: "${promptText.trim()}".`,
            '- Hướng 1. Giữ tông tối, thêm một điểm sáng duy nhất.',
            '- Hướng 2. Đổi chất liệu chính sang gỗ và kính mờ.',
          ].join('\n'),
        })
      }
    }, 700)
  })
}

interface RunDetailRowProps {
  run: AiRun | undefined
}

function RunDetailRow({ run }: RunDetailRowProps) {
  const [open, setOpen] = useState(false)
  if (!run) return null
  const elapsedMs =
    run.finishedAt != null ? new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime() : null
  return (
    <div className="spike-run-line">
      <span className={run.status === 'error' ? 'spike-state-err' : 'spike-state-ok'}>
        {run.status === 'error' ? 'Lỗi' : run.status === 'running' ? 'Đang chạy' : 'Xong'}
      </span>
      <span className="spike-run-meta">
        {run.modelLabel}
        {elapsedMs != null ? ` · ${(elapsedMs / 1000).toFixed(1)} giây` : ''}
      </span>
      <button type="button" className="spike-disclosure" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        Chi tiết run
      </button>
      {open ? (
        <dl className="spike-run-detail">
          <div>
            <dt>Provider</dt>
            <dd>{run.providerType}</dd>
          </div>
          <div>
            <dt>Model</dt>
            <dd className="spike-mono">{run.modelLabel}</dd>
          </div>
          {run.resultSummary ? (
            <div>
              <dt>Kết quả</dt>
              <dd>{run.resultSummary}</dd>
            </div>
          ) : null}
          <div>
            <dt>Prompt</dt>
            <dd className="spike-mono spike-prompt">{run.promptPreview}</dd>
          </div>
        </dl>
      ) : null}
    </div>
  )
}

export default function ChatSpike() {
  const [messages, setMessages] = useState<AiMessage[]>(initialMessages)
  const [runs, setRuns] = useState<AiRun[]>(initialRuns)
  const [isRunning, setIsRunning] = useState(false)
  const messagesRef = useRef(messages)
  messagesRef.current = messages
  const runsByIdRef = useRef(new Map(runs.map((r) => [r.id, r])))
  runsByIdRef.current = new Map(runs.map((r) => [r.id, r]))

  const sendProgrammatic = useCallback(async (text: string) => {
    if (!text.trim()) return

    const userMessage: AiMessage = {
      id: spikeId('m'),
      threadId: THREAD.id,
      role: 'user',
      text,
      createdAt: nowIso(),
      contextNodes: CONTEXT_CHIPS,
    }
    const runId = spikeId('run')
    const run: AiRun = {
      id: runId,
      threadId: THREAD.id,
      providerType: 'claude_code',
      modelLabel: 'claude-sonnet-5',
      startedAt: nowIso(),
      status: 'running',
      promptPreview: text,
    }
    setMessages((prev) => [...prev, userMessage])
    setRuns((prev) => [...prev, run])
    setIsRunning(true)

    // Stand-in for: const result = await invoke('generate_ai_text', { prompt, provider, ... })
    const result = await simulateGenerate(text)

    setRuns((prev) =>
      prev.map((r) =>
        r.id === runId
          ? {
              ...r,
              finishedAt: nowIso(),
              status: result.ok ? 'done' : 'error',
              errorMessage: result.ok ? undefined : result.error,
              resultSummary: result.ok ? 'Trả lời trực tiếp, không tạo node' : undefined,
            }
          : r,
      ),
    )
    if (result.ok) {
      const assistantMessage: AiMessage = {
        id: spikeId('m'),
        threadId: THREAD.id,
        role: 'assistant',
        text: result.text,
        createdAt: nowIso(),
        runId,
        contextNodes: [],
      }
      setMessages((prev) => [...prev, assistantMessage])
    } else {
      const errorMessage: AiMessage = {
        id: spikeId('m'),
        threadId: THREAD.id,
        role: 'system-error',
        text: result.error,
        createdAt: nowIso(),
        runId,
        contextNodes: [],
      }
      setMessages((prev) => [...prev, errorMessage])
    }
    setIsRunning(false)
  }, [])

  const onNew = useCallback(
    async (appended: AppendMessage) => {
      const text = appended.content
        .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
        .map((part) => part.text)
        .join('')
      await sendProgrammatic(text)
    },
    [sendProgrammatic],
  )

  // Spike-only instrumentation: ?scenario=error replays the error path on
  // mount so headless-Chrome screenshots (no synthetic-input access) can
  // capture the in-thread error state for the decision doc.
  const scenarioFiredRef = useRef(false)
  useEffect(() => {
    const scenario = new URLSearchParams(window.location.search).get('scenario')
    // Guard against React 18/19 StrictMode's dev-only double-invoke of
    // effects (mount -> cleanup -> mount), which would otherwise replay
    // this fire-once scenario twice and duplicate the error exchange.
    if (scenario === 'error' && !scenarioFiredRef.current) {
      scenarioFiredRef.current = true
      void sendProgrammatic('Giả lập lỗi provider để chụp màn hình (scenario=error)')
    }
  }, [sendProgrammatic])

  const convertedMessages = useMemo(() => messages.map(toThreadMessageLike), [messages])

  const runtime = useExternalStoreRuntime({
    messages: convertedMessages,
    isRunning,
    onNew,
    convertMessage: (m) => m,
  })

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="spike-panel" aria-label="Kira (spike)">
        <div className="spike-head">
          <h3>Kira · Chat (spike)</h3>
          <span className="spike-thread-name">{THREAD.title}</span>
        </div>
        <ThreadPrimitive.Root className="spike-thread">
          <ThreadPrimitive.Viewport className="spike-viewport" role="log" aria-live="polite" aria-label="Tin nhắn">
            <ThreadPrimitive.Empty>
              <p className="spike-empty">Chưa có tin nhắn nào.</p>
            </ThreadPrimitive.Empty>
            <ThreadPrimitive.Messages>
              {({ message }) => {
                const source = messagesRef.current.find((m) => m.id === message.id)
                const run = source?.runId ? runsByIdRef.current.get(source.runId) : undefined
                if (message.role === 'user') {
                  return (
                    <MessagePrimitive.Root className="spike-msg">
                      <div className="spike-msg-head">
                        <b>Bạn</b>
                        <span className="spike-num">{formatClock(source?.createdAt ?? nowIso())}</span>
                      </div>
                      <div className="spike-msg-user">
                        <MessagePrimitive.Content />
                        {source && source.contextNodes.length > 0 ? (
                          <div className="spike-ctx">
                            {source.contextNodes.map((ref) => (
                              <span key={`${ref.kind}:${ref.id}`}>{ref.id}</span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </MessagePrimitive.Root>
                  )
                }
                if (message.role === 'system') {
                  return (
                    <MessagePrimitive.Root className="spike-msg">
                      <div className="spike-msg-head">
                        <b>Kira</b>
                        <span className="spike-num">{formatClock(source?.createdAt ?? nowIso())}</span>
                      </div>
                      <div className="spike-run-error" role="status">
                        <div className="spike-run-error-text">
                          <span className="spike-state-err">Lỗi</span> <MessagePrimitive.Content />
                        </div>
                        <div className="spike-acts">
                          <button type="button" className="spike-quiet-button">
                            Thử lại
                          </button>
                        </div>
                      </div>
                    </MessagePrimitive.Root>
                  )
                }
                return (
                  <MessagePrimitive.Root className="spike-msg">
                    <div className="spike-msg-head">
                      <b>Kira</b>
                      <span className="spike-num">{formatClock(source?.createdAt ?? nowIso())}</span>
                    </div>
                    <div className="spike-msg-ai">
                      <MessagePrimitive.Content />
                    </div>
                    <RunDetailRow run={run} />
                  </MessagePrimitive.Root>
                )
              }}
            </ThreadPrimitive.Messages>
          </ThreadPrimitive.Viewport>
          <ComposerPrimitive.Root className="spike-composer">
            <ComposerPrimitive.Input
              className="spike-composer-input"
              placeholder="Hỏi tiếp trong thread này"
              aria-label="Hỏi Kira"
              rows={1}
            />
            <ComposerPrimitive.Send className="spike-send" aria-label="Gửi">
              Gửi
            </ComposerPrimitive.Send>
          </ComposerPrimitive.Root>
          <div className="spike-composer-meta">
            <span>Ngữ cảnh: {CONTEXT_CHIPS.length} node</span>
            <span>Claude Code</span>
          </div>
        </ThreadPrimitive.Root>
      </div>
    </AssistantRuntimeProvider>
  )
}
