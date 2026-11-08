// "Cần bạn" tab rows — Untitled UI React conversion (PHA 3, 2026-09-16).
// Extracted out of main.tsx (was `renderChangeItem`/`renderSkillCheckpoint`
// inline in FileWorkspace, ~6567-6764). Pure presentational: every mutation
// (accept/reject/keep/remove/dismiss) stays a callback prop owned by
// FileWorkspace in main.tsx, same convention as KiraChangesTab.tsx.
//
// Status labels (chờ duyệt / đã áp dụng / đã cũ / ...) now render as kit
// `Badge` instead of the old `<span className="item-status state-*">` — the
// state-ok/state-wait/state-attn CSS classes are gone from styles.css for
// this surface (see PHA 3 report for the full list of removed selectors).
// Row actions (Xem trên canvas / Nhận / Từ chối / Giữ node / Xoá node) are
// kit `Button` (tertiary sm for quiet actions, primary sm for the
// committing "Nhận", primary-destructive sm for the one destructive action).
import { Fragment, useMemo } from 'react'
import { AlertTriangle, Check, Layers, LocateFixed, Palette as PaletteIcon, Pause, Pencil, Plus, Trash2 } from 'lucide-react'
import { Badge } from '@/components/base/badges/badges'
import { Button } from '@/components/base/buttons/button'
import type { AiChangeItem, AiChangeSet, AiSkillCheckpoint, GraphNodeKind } from '@/kira/aiPanelTypes'

type TFn = (key: string, vars?: Record<string, string>) => string

/** Word-level diff for the "Cần bạn" tab's edit-text preview (mockup.js
 *  .diff — <del>/<ins> spans). Standard LCS-on-words DP; short node text
 *  keeps this well within a trivial cost. Moved out of main.tsx alongside
 *  `renderChangeItem` (PHA 3, 2026-09-16) — was module-scope `diffWords` at
 *  ~main.tsx:2086, only ever called from this one place. */
function diffWords(before: string, after: string): Array<{ type: 'same' | 'del' | 'ins'; text: string }> {
  const a = before.split(/(\s+)/)
  const b = after.split(/(\s+)/)
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const segments: Array<{ type: 'same' | 'del' | 'ins'; text: string }> = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      segments.push({ type: 'same', text: a[i] })
      i += 1
      j += 1
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      segments.push({ type: 'del', text: a[i] })
      i += 1
    } else {
      segments.push({ type: 'ins', text: b[j] })
      j += 1
    }
  }
  while (i < a.length) {
    segments.push({ type: 'del', text: a[i] })
    i += 1
  }
  while (j < b.length) {
    segments.push({ type: 'ins', text: b[j] })
    j += 1
  }
  const merged: typeof segments = []
  for (const segment of segments) {
    const last = merged[merged.length - 1]
    if (last && last.type === segment.type) last.text += segment.text
    else merged.push({ ...segment })
  }
  return merged
}

function DiffText({ before, after }: { before: string; after: string }) {
  const segments = useMemo(() => diffWords(before, after), [before, after])
  return (
    <p className="diff">
      {segments.map((segment, index) => {
        if (segment.type === 'del') return <del key={index}>{segment.text}</del>
        if (segment.type === 'ins') return <ins key={index}>{segment.text}</ins>
        return <Fragment key={index}>{segment.text}</Fragment>
      })}
    </p>
  )
}

function StatusBadge({ tone, children }: { tone: 'pending' | 'ok' | 'attn'; children: React.ReactNode }) {
  const color = tone === 'pending' ? 'warning' : tone === 'attn' ? 'error' : 'success'
  return (
    <Badge color={color} size="sm" className="item-status-badge">
      {children}
    </Badge>
  )
}

export function KiraSkillCheckpointRow({
  checkpoint,
  t,
  onDismiss,
}: {
  checkpoint: AiSkillCheckpoint
  t: TFn
  onDismiss: (checkpointId: string) => void
}) {
  return (
    <li className="item is-focused" key={checkpoint.id} aria-current="true">
      <span className="op"><Pause size={11} /></span>
      <div className="item-line">
        <div>
          <span className="item-kind">{checkpoint.skill}</span>
          <span className="item-target">{checkpoint.stepLabel}</span>
        </div>
        <StatusBadge tone="pending">{t('kira.checkpoint.statusWaiting')}</StatusBadge>
      </div>
      <div className="item-body">
        <div className="item-foot">
          <div className="acts">
            <Button color="tertiary" size="sm" onPress={() => onDismiss(checkpoint.id)}>
              {t('kira.checkpoint.dismiss')}
            </Button>
          </div>
        </div>
      </div>
    </li>
  )
}

export function KiraChangeItemRow({
  changeSet,
  item,
  t,
  targetTitle,
  onViewOnCanvas,
  onAccept,
  onReject,
  onKeepNode,
  onRemoveNode,
}: {
  changeSet: AiChangeSet
  item: AiChangeItem
  t: TFn
  targetTitle: (nodeKind: GraphNodeKind, nodeId: string) => string
  onViewOnCanvas: (nodeKind: GraphNodeKind, nodeId: string) => void
  onAccept: (changeSetId: string, itemId: string) => void
  onReject: (changeSetId: string, itemId: string) => void
  onKeepNode: (changeSetId: string, itemId: string) => void
  onRemoveNode: (nodeKind: GraphNodeKind, nodeId: string) => void
}) {
  if (item.kind === 'create-node') {
    return (
      <li className="item" key={item.id}>
        <span className="op"><Plus size={11} /></span>
        <div className="item-line">
          <div>
            <span className="item-kind">{t('kira.change.itemCreateNode')}</span>
            <span className="item-target">{item.title}</span>
          </div>
          <StatusBadge tone="ok">
            <Check size={11} />
            {item.status === 'applied' ? t('kira.change.statusApplied') : t('kira.change.statusRemoved')}
          </StatusBadge>
        </div>
        {item.status === 'applied' && (
          <div className="item-body">
            {item.editedByUserAfterApply && (
              <p className="stale-note"><AlertTriangle size={11} className="ic" /><span>{t('kira.change.editedGuard')}</span></p>
            )}
            <div className="item-foot">
              <Button color="tertiary" size="sm" iconLeading={LocateFixed} onPress={() => onViewOnCanvas(item.nodeKind, item.nodeId)}>
                {t('kira.change.viewOnCanvas')}
              </Button>
              <div className="acts">
                <Button color="tertiary" size="sm" onPress={() => onRemoveNode(item.nodeKind, item.nodeId)}>
                  {t('kira.change.removeNode')}
                </Button>
              </div>
            </div>
          </div>
        )}
      </li>
    )
  }

  if (item.kind === 'create-nodes-batch') {
    const isPending = item.status === 'pending'
    return (
      <li className={isPending ? 'item is-focused' : 'item'} key={item.id} aria-current={isPending ? 'true' : undefined}>
        <span className="op"><Layers size={11} /></span>
        <div className="item-line">
          <div>
            <span className="item-kind">{t('kira.change.itemCreateNodesBatch')}</span>
            <span className="item-target">{t('kira.change.nodesBatchSummary', { count: String(item.nodes.length), linkCount: String(item.links.length) })}</span>
          </div>
          <StatusBadge tone={isPending ? 'pending' : 'ok'}>
            {isPending ? t('kira.change.statusPending') : t(`kira.change.status${item.status === 'accepted' ? 'Accepted' : 'Rejected'}`)}
          </StatusBadge>
        </div>
        {isPending && (
          <div className="item-body">
            <ul className="batch-node-preview">
              {item.nodes.map((node) => (
                <li key={node.draftId}>{node.title}</li>
              ))}
            </ul>
            <div className="item-foot">
              {item.sourceNodeId && item.sourceNodeKind && (
                <Button color="tertiary" size="sm" iconLeading={LocateFixed} onPress={() => onViewOnCanvas(item.sourceNodeKind!, item.sourceNodeId!)}>
                  {t('kira.change.viewOnCanvas')}
                </Button>
              )}
              <div className="acts">
                <Button color="tertiary" size="sm" onPress={() => onReject(changeSet.id, item.id)}>
                  {t('kira.change.reject')}
                </Button>
                <Button color="primary" size="sm" onPress={() => onAccept(changeSet.id, item.id)}>
                  {t('kira.change.accept')}
                </Button>
              </div>
            </div>
          </div>
        )}
      </li>
    )
  }

  if (item.kind === 'edit-text') {
    const isPending = item.status === 'pending'
    const isStale = item.status === 'stale'
    return (
      <li className={isPending || isStale ? 'item is-focused' : 'item'} key={item.id} aria-current={isPending ? 'true' : undefined}>
        <span className="op"><Pencil size={11} /></span>
        <div className="item-line">
          <div>
            <span className="item-kind">{t('kira.change.itemEditText')}</span>
            <span className="item-target">{targetTitle(item.targetNodeKind, item.targetNodeId)}</span>
          </div>
          <StatusBadge tone={isStale ? 'attn' : isPending ? 'pending' : 'ok'}>
            {isStale && <AlertTriangle size={11} />}
            {isStale ? t('kira.change.statusStale') : isPending ? t('kira.change.statusPending') : t(`kira.change.status${item.status === 'accepted' ? 'Accepted' : 'Rejected'}`)}
          </StatusBadge>
        </div>
        {(isPending || isStale) && (
          <div className="item-body">
            {isStale && <p className="item-summary-line"><AlertTriangle size={11} className="ic" />{t('kira.change.staleNote')}</p>}
            {isPending && <DiffText before={item.before} after={item.after} />}
            <div className="item-foot">
              <Button color="tertiary" size="sm" iconLeading={LocateFixed} onPress={() => onViewOnCanvas(item.targetNodeKind, item.targetNodeId)}>
                {t('kira.change.viewOnCanvas')}
              </Button>
              <div className="acts">
                <Button color="tertiary" size="sm" onPress={() => onReject(changeSet.id, item.id)}>
                  {t('kira.change.reject')}
                </Button>
                {isPending && (
                  <Button color="primary" size="sm" onPress={() => onAccept(changeSet.id, item.id)}>
                    {t('kira.change.accept')}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </li>
    )
  }

  if (item.kind === 'edit-palette') {
    const isPending = item.status === 'pending'
    const isStale = item.status === 'stale'
    return (
      <li className={isPending || isStale ? 'item is-focused' : 'item'} key={item.id}>
        <span className="op"><PaletteIcon size={11} /></span>
        <div className="item-line">
          <div>
            <span className="item-kind">{t('kira.change.itemEditPalette')}</span>
            <span className="item-target">{targetTitle('palette', item.targetNodeId)}</span>
          </div>
          <StatusBadge tone={isStale ? 'attn' : isPending ? 'pending' : 'ok'}>
            {isStale && <AlertTriangle size={11} />}
            {isStale ? t('kira.change.statusStale') : isPending ? t('kira.change.statusPending') : t(`kira.change.status${item.status === 'accepted' ? 'Accepted' : 'Rejected'}`)}
          </StatusBadge>
        </div>
        {(isPending || isStale) && (
          <div className="item-body">
            {isStale && <p className="item-summary-line"><AlertTriangle size={11} className="ic" />{t('kira.change.staleNote')}</p>}
            {isPending && (
              <div className="pal-compare">
                <span className="lbl">{t('kira.change.before')}</span>
                <span className="swatches">{item.beforeColors.map((color, index) => <i key={index} style={{ background: color }} />)}</span>
                <span className="lbl">{t('kira.change.after')}</span>
                <span className="swatches">{item.afterColors.map((color, index) => <i key={index} style={{ background: color }} />)}</span>
              </div>
            )}
            <div className="item-foot">
              <Button color="tertiary" size="sm" iconLeading={LocateFixed} onPress={() => onViewOnCanvas('palette', item.targetNodeId)}>
                {t('kira.change.viewOnCanvas')}
              </Button>
              <div className="acts">
                <Button color="tertiary" size="sm" onPress={() => onReject(changeSet.id, item.id)}>
                  {t('kira.change.reject')}
                </Button>
                {isPending && (
                  <Button color="primary" size="sm" onPress={() => onAccept(changeSet.id, item.id)}>
                    {t('kira.change.accept')}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </li>
    )
  }

  // delete-node
  const isPending = item.status === 'pending'
  return (
    <li className={isPending ? 'item is-focused' : 'item'} key={item.id}>
      <span className="op is-delete"><Trash2 size={11} /></span>
      <div className="item-line">
        <div>
          <span className="item-kind is-delete">{t('kira.change.itemDeleteNode')}</span>
          <span className="item-target">{item.targetTitle}</span>
        </div>
        <StatusBadge tone={isPending ? 'pending' : 'ok'}>
          {isPending ? t('kira.change.statusPending') : t(`kira.change.status${item.status === 'accepted' ? 'Accepted' : 'Kept'}`)}
        </StatusBadge>
      </div>
      {isPending && (
        <div className="item-body">
          {typeof item.linkCountAffected === 'number' && item.linkCountAffected > 0 && (
            <p className="item-summary-line">{t('kira.change.linksAffected', { count: String(item.linkCountAffected) })}</p>
          )}
          <div className="item-foot">
            <Button color="tertiary" size="sm" iconLeading={LocateFixed} onPress={() => onViewOnCanvas(item.targetNodeKind, item.targetNodeId)}>
              {t('kira.change.viewOnCanvas')}
            </Button>
            <div className="acts">
              <Button color="tertiary" size="sm" onPress={() => onKeepNode(changeSet.id, item.id)}>
                {t('kira.change.keepNode')}
              </Button>
              <Button color="primary-destructive" size="sm" onPress={() => onAccept(changeSet.id, item.id)}>
                {t('kira.change.deleteNode')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </li>
  )
}
