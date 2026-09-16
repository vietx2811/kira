// Chat-tab thread list — Untitled UI React conversion (PHA 3, 2026-09-16).
// Extracted out of main.tsx (was `renderKiraThreadList` inline in
// FileWorkspace, ~6510-6549). The "+ New thread" action is now a kit
// `Button`; the row list itself stays the existing hairline `.thread-row`
// pattern (DESIGN.md §5 No-Nested-Card Rule) — it is a navigation list, not
// one of the named controls in the brief, so it was left as-is.
import { Plus } from 'lucide-react'
import { Button } from '@/components/base/buttons/button'
import type { AiThread } from '@/kira/aiPanelTypes'

type TFn = (key: string, vars?: Record<string, string>) => string

export function KiraThreadList({
  threads,
  activeThreadId,
  t,
  formatClockTime,
  onNewThread,
  onSelectThread,
}: {
  threads: AiThread[]
  activeThreadId: string | null
  t: TFn
  formatClockTime: (iso: string) => string
  onNewThread: () => void
  onSelectThread: (threadId: string) => void
}) {
  const sorted = [...threads].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return (
    <>
      <div className="list-tools">
        <Button color="tertiary" size="sm" iconLeading={Plus} onPress={onNewThread}>
          {t('kira.panel.newThread')}
        </Button>
      </div>
      {sorted.length > 0 && (
        <ul className="list">
          {sorted.map((thread) => (
            <li key={thread.id}>
              <button
                type="button"
                className={thread.id === activeThreadId ? 'thread-row is-current' : 'thread-row'}
                aria-current={thread.id === activeThreadId ? 'true' : undefined}
                onClick={() => onSelectThread(thread.id)}
              >
                <strong>{thread.title}</strong>
                <span className="when">{formatClockTime(thread.updatedAt)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
