// "Cần bạn" tab body — Untitled UI React conversion (PHA 3, 2026-09-16).
// Extracted out of main.tsx (was `renderKiraChangesTab`/`renderChangeSetSection`
// inline in FileWorkspace, ~6770-6841). Pure domain math (bulkAcceptable,
// summaryLine, visibleCheckpoints) is imported straight from
// `@/kira/aiPanelModel`, same module main.tsx itself pulls it from — no need
// to prop-drill those, only the state they read and the mutation callbacks.
import { Check } from 'lucide-react'
import { Button } from '@/components/base/buttons/button'
import { bulkAcceptable, summaryLine, visibleCheckpoints } from '@/kira/aiPanelModel'
import type { AiChangeSet, AiPanelState, GraphNodeKind } from '@/kira/aiPanelTypes'
import { KiraChangeItemRow, KiraSkillCheckpointRow } from './KiraChangeItem'

type TFn = (key: string, vars?: Record<string, string>) => string

function ChangeSetSection({
  changeSet,
  aiPanelState,
  t,
  formatClockTime,
  targetTitle,
  onViewOnCanvas,
  onAccept,
  onReject,
  onKeepNode,
  onRemoveNode,
  onAcceptBulk,
}: {
  changeSet: AiChangeSet
  aiPanelState: AiPanelState
  t: TFn
  formatClockTime: (iso: string) => string
  targetTitle: (nodeKind: GraphNodeKind, nodeId: string) => string
  onViewOnCanvas: (nodeKind: GraphNodeKind, nodeId: string) => void
  onAccept: (changeSetId: string, itemId: string) => void
  onReject: (changeSetId: string, itemId: string) => void
  onKeepNode: (changeSetId: string, itemId: string) => void
  onRemoveNode: (nodeKind: GraphNodeKind, nodeId: string) => void
  onAcceptBulk: (changeSetId: string) => void
}) {
  const run = aiPanelState.runs.find((candidate) => candidate.id === changeSet.runId)
  const deleteItems = changeSet.items.filter((item) => item.kind === 'delete-node')
  const mainItems = changeSet.items.filter((item) => item.kind !== 'delete-node')
  const bulk = bulkAcceptable(changeSet)
  return (
    <section className="changeset" aria-label={changeSet.title} key={changeSet.id}>
      <div className="cs-head">
        <h4>{changeSet.title}</h4>
        <span className="row-sub">{run ? `${run.modelLabel} · ${formatClockTime(run.startedAt)}` : formatClockTime(changeSet.createdAt)}</span>
      </div>
      {bulk.length > 0 && (
        <div className="cs-actions">
          <Button color="tertiary" size="sm" iconLeading={Check} onPress={() => onAcceptBulk(changeSet.id)}>
            {t('kira.change.acceptAll', { count: String(bulk.length) })}
          </Button>
        </div>
      )}
      {mainItems.some((item) => item.kind === 'edit-text' || item.kind === 'edit-palette') && (
        <p className="cs-rule">{t('kira.change.bulkRule')}</p>
      )}
      {mainItems.length > 0 && (
        <ul className="list">
          {mainItems.map((item) => (
            <KiraChangeItemRow
              key={item.id}
              changeSet={changeSet}
              item={item}
              t={t}
              targetTitle={targetTitle}
              onViewOnCanvas={onViewOnCanvas}
              onAccept={onAccept}
              onReject={onReject}
              onKeepNode={onKeepNode}
              onRemoveNode={onRemoveNode}
            />
          ))}
        </ul>
      )}
      {deleteItems.length > 0 && (
        <>
          <div className="group-label"><span>{t('kira.change.deleteRule')}</span><span className="num">{deleteItems.length}</span></div>
          <ul className="list">
            {deleteItems.map((item) => (
              <KiraChangeItemRow
                key={item.id}
                changeSet={changeSet}
                item={item}
                t={t}
                targetTitle={targetTitle}
                onViewOnCanvas={onViewOnCanvas}
                onAccept={onAccept}
                onReject={onReject}
                onKeepNode={onKeepNode}
                onRemoveNode={onRemoveNode}
              />
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

export function KiraChangesTab({
  aiPanelState,
  t,
  formatClockTime,
  targetTitle,
  onViewOnCanvas,
  onAccept,
  onReject,
  onKeepNode,
  onRemoveNode,
  onAcceptBulk,
  onDismissCheckpoint,
}: {
  aiPanelState: AiPanelState
  t: TFn
  formatClockTime: (iso: string) => string
  targetTitle: (nodeKind: GraphNodeKind, nodeId: string) => string
  onViewOnCanvas: (nodeKind: GraphNodeKind, nodeId: string) => void
  onAccept: (changeSetId: string, itemId: string) => void
  onReject: (changeSetId: string, itemId: string) => void
  onKeepNode: (changeSetId: string, itemId: string) => void
  onRemoveNode: (nodeKind: GraphNodeKind, nodeId: string) => void
  onAcceptBulk: (changeSetId: string) => void
  onDismissCheckpoint: (checkpointId: string) => void
}) {
  const checkpoints = visibleCheckpoints(aiPanelState)
  if (aiPanelState.changeSets.length === 0 && checkpoints.length === 0) {
    return (
      <div className="kp-empty">
        <Check size={22} />
        <h4>{t('kira.panel.tabNeedsYou')}</h4>
        <p>{t('kira.panel.needsYouEmpty')}</p>
      </div>
    )
  }
  const summary = summaryLine(aiPanelState)
  const sortedChangeSets = [...aiPanelState.changeSets].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return (
    <>
      <p className="cs-summary">
        <span><b>{summary.needsYou}</b> {t('kira.change.needsYou')}</span>
        <span className="muted">·</span>
        <span><b>{summary.applied}</b> {t('kira.change.applied')}</span>
        {summary.accepted > 0 && (
          <>
            <span className="muted">·</span>
            <span><b>{summary.accepted}</b> {t('kira.change.accepted')}</span>
          </>
        )}
      </p>
      {checkpoints.length > 0 && (
        <section className="changeset" aria-label={t('kira.checkpoint.groupLabel')}>
          <div className="group-label">
            <span>{t('kira.checkpoint.groupLabel')}</span>
            <span className="num">{checkpoints.length}</span>
          </div>
          <ul className="list">
            {checkpoints.map((checkpoint) => (
              <KiraSkillCheckpointRow key={checkpoint.id} checkpoint={checkpoint} t={t} onDismiss={onDismissCheckpoint} />
            ))}
          </ul>
        </section>
      )}
      {sortedChangeSets.map((changeSet) => (
        <ChangeSetSection
          key={changeSet.id}
          changeSet={changeSet}
          aiPanelState={aiPanelState}
          t={t}
          formatClockTime={formatClockTime}
          targetTitle={targetTitle}
          onViewOnCanvas={onViewOnCanvas}
          onAccept={onAccept}
          onReject={onReject}
          onKeepNode={onKeepNode}
          onRemoveNode={onRemoveNode}
          onAcceptBulk={onAcceptBulk}
        />
      ))}
    </>
  )
}
