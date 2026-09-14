/**
 * Pure functions over AiPanelState. No React, no zustand, no DOM — this
 * module is unit-testable on its own (bun test apps/desktop/src/kira) and
 * knows nothing about main.tsx's canvas store. See README.md for how
 * main.tsx should wire these in.
 */

import {
  type AiCanvasOperation,
  type AiChangeItem,
  type AiChangeSet,
  type AiModelResult,
  type AiNodeProvenance,
  type AiPanelState,
  type AiPanelSummary,
  type AiSkillCheckpoint,
  type AiThread,
  type GraphNodeKind,
  provenanceKey,
} from './aiPanelTypes'

export const AI_PANEL_SCHEMA_VERSION = 1

export function createEmptyAiPanelState(): AiPanelState {
  return {
    schemaVersion: AI_PANEL_SCHEMA_VERSION,
    threads: [],
    messages: [],
    runs: [],
    changeSets: [],
    skillCheckpoints: [],
    provenance: {},
  }
}

// ---------------------------------------------------------------------------
// Counting
// ---------------------------------------------------------------------------

function itemNeedsYou(item: AiChangeItem): boolean {
  switch (item.kind) {
    case 'create-node':
      // Applied immediately (DECISIONS.md #2); never counts.
      return false
    case 'edit-text':
    case 'edit-palette':
      return item.status === 'pending' || item.status === 'stale'
    case 'delete-node':
      return item.status === 'pending'
    default:
      return false
  }
}

/** DECISIONS.md #6: ONE global number — pending items + stale items across
 *  every ChangeSet, plus every skill checkpoint currently waiting on the
 *  user. This is the exact number shown on the Kira toggle, the "Cần bạn"
 *  tab, and the dock status line. */
export function needsYouCount(state: AiPanelState): number {
  const itemCount = state.changeSets.reduce(
    (total, changeSet) => total + changeSet.items.filter(itemNeedsYou).length,
    0,
  )
  const checkpointCount = state.skillCheckpoints.filter((checkpoint) => checkpoint.status === 'waiting').length
  return itemCount + checkpointCount
}

/** mockup.js changesView: "cần xử lý" / "đã áp dụng" / "đã nhận". */
export function summaryLine(state: AiPanelState): AiPanelSummary {
  let applied = 0
  let accepted = 0
  for (const changeSet of state.changeSets) {
    for (const item of changeSet.items) {
      if (item.kind === 'create-node' && item.status === 'applied') applied += 1
      if (item.kind !== 'create-node' && item.status === 'accepted') accepted += 1
    }
  }
  return { needsYou: needsYouCount(state), applied, accepted }
}

// ---------------------------------------------------------------------------
// Bulk accept eligibility
// ---------------------------------------------------------------------------

/** mockup.js cs-rule: "Nhận hàng loạt không bao gồm xoá và mục đã cũ" —
 *  bulk accept excludes delete-node items and stale items. Only pending
 *  edit-text / edit-palette items are bulk-acceptable. */
export function bulkAcceptable(changeSet: AiChangeSet): AiChangeItem[] {
  return changeSet.items.filter((item) => item.kind !== 'delete-node' && item.status === 'pending')
}

// ---------------------------------------------------------------------------
// Stale marking
// ---------------------------------------------------------------------------

/** research §A4.4: before applying an update, compare `before` to the
 *  current value; if the user changed the node after the proposal was made,
 *  mark it stale instead of silently overwriting. Called by main.tsx right
 *  after it records a user edit (recordNodeVersion), passing the field that
 *  changed and the edit's timestamp. Immutable: returns a new state. */
export function markStaleOnUserEdit(state: AiPanelState, nodeId: string, field: string, at: string): AiPanelState {
  let changed = false
  const changeSets = state.changeSets.map((changeSet) => {
    let changeSetChanged = false
    const items = changeSet.items.map((item) => {
      if (item.status !== 'pending') return item
      if (item.createdAt >= at) return item
      if (item.kind === 'edit-text' && item.targetNodeId === nodeId && item.field === field) {
        changeSetChanged = true
        return { ...item, status: 'stale' as const }
      }
      if (item.kind === 'edit-palette' && item.targetNodeId === nodeId && field === 'colors') {
        changeSetChanged = true
        return { ...item, status: 'stale' as const }
      }
      return item
    })
    if (!changeSetChanged) return changeSet
    changed = true
    return { ...changeSet, items }
  })
  if (!changed) return state
  return { ...state, changeSets }
}

// ---------------------------------------------------------------------------
// Item mutation helpers
// ---------------------------------------------------------------------------

function findItem(
  state: AiPanelState,
  changeSetId: string,
  itemId: string,
): { changeSet: AiChangeSet; item: AiChangeItem } | null {
  const changeSet = state.changeSets.find((candidate) => candidate.id === changeSetId)
  if (!changeSet) return null
  const item = changeSet.items.find((candidate) => candidate.id === itemId)
  if (!item) return null
  return { changeSet, item }
}

function replaceItem(state: AiPanelState, changeSetId: string, itemId: string, next: AiChangeItem): AiPanelState {
  const changeSets = state.changeSets.map((changeSet) => {
    if (changeSet.id !== changeSetId) return changeSet
    return { ...changeSet, items: changeSet.items.map((item) => (item.id === itemId ? next : item)) }
  })
  return { ...state, changeSets }
}

function recordVersionOp(item: { kind: string }, run: { runId: string }, nodeKind: GraphNodeKind, nodeId: string): AiCanvasOperation {
  return {
    type: 'record-node-version',
    nodeKind,
    nodeId,
    runId: run.runId,
    aiGenerated: true,
    note: `ai-${item.kind}-accepted`,
  }
}

/** Accept a pending edit-text, edit-palette, or delete-node item. Refuses
 *  create-node items (already applied — use removeAppliedNode to undo
 *  those instead) and items that are not in a pending state (mockup: a
 *  stale item offers only "Từ chối" / "Đề xuất lại", never "Nhận"). */
export function acceptItem(state: AiPanelState, changeSetId: string, itemId: string): AiModelResult {
  const found = findItem(state, changeSetId, itemId)
  if (!found) return { ok: false, reason: 'not-found' }
  const { changeSet, item } = found

  if (item.kind === 'create-node') return { ok: false, reason: 'wrong-kind' }
  if (item.status !== 'pending') return { ok: false, reason: `not-pending:${item.status}` }

  const runRef = { runId: changeSet.runId }

  if (item.kind === 'edit-text') {
    const next = { ...item, status: 'accepted' as const }
    const operations: AiCanvasOperation[] = [
      { type: 'update-node-text', nodeKind: item.targetNodeKind, nodeId: item.targetNodeId, field: item.field, text: item.after },
      recordVersionOp(item, runRef, item.targetNodeKind, item.targetNodeId),
    ]
    return { ok: true, state: replaceItem(state, changeSetId, itemId, next), operations }
  }

  if (item.kind === 'edit-palette') {
    const next = { ...item, status: 'accepted' as const }
    const operations: AiCanvasOperation[] = [
      { type: 'update-node-palette', nodeId: item.targetNodeId, colors: item.afterColors },
      recordVersionOp(item, runRef, 'palette', item.targetNodeId),
    ]
    return { ok: true, state: replaceItem(state, changeSetId, itemId, next), operations }
  }

  // delete-node
  const next = { ...item, status: 'accepted' as const }
  const operations: AiCanvasOperation[] = [{ type: 'delete-node', nodeKind: item.targetNodeKind, nodeId: item.targetNodeId }]
  return { ok: true, state: replaceItem(state, changeSetId, itemId, next), operations }
}

/** Reject a pending or stale edit-text / edit-palette item. Nothing was
 *  ever applied to the canvas for these (DECISIONS.md #3: edits always
 *  wait for approval), so rejecting is a pure status change — no canvas
 *  operations. delete-node items use keepNode instead; create-node items
 *  use removeAppliedNode instead. */
export function rejectItem(state: AiPanelState, changeSetId: string, itemId: string): AiModelResult {
  const found = findItem(state, changeSetId, itemId)
  if (!found) return { ok: false, reason: 'not-found' }
  const { item } = found

  if (item.kind !== 'edit-text' && item.kind !== 'edit-palette') return { ok: false, reason: 'wrong-kind' }
  if (item.status !== 'pending' && item.status !== 'stale') return { ok: false, reason: `not-rejectable:${item.status}` }

  const next = { ...item, status: 'rejected' as const }
  return { ok: true, state: replaceItem(state, changeSetId, itemId, next), operations: [] }
}

/** Keep a node a delete-node item proposed removing. Only valid while the
 *  item is still pending. */
export function keepNode(state: AiPanelState, changeSetId: string, itemId: string): AiModelResult {
  const found = findItem(state, changeSetId, itemId)
  if (!found) return { ok: false, reason: 'not-found' }
  const { item } = found

  if (item.kind !== 'delete-node') return { ok: false, reason: 'wrong-kind' }
  if (item.status !== 'pending') return { ok: false, reason: `not-pending:${item.status}` }

  const next = { ...item, status: 'kept' as const }
  return { ok: true, state: replaceItem(state, changeSetId, itemId, next), operations: [] }
}

/** Undo an applied create-node item ("Gỡ node" in mockup). Refuses when the
 *  node was hand-edited after Kira created it unless `force` is passed —
 *  the caller (UI) is expected to show the "Bạn đã sửa nội dung node này…"
 *  guard and let the user confirm before retrying with force: true. */
export function removeAppliedNode(
  state: AiPanelState,
  nodeKind: GraphNodeKind,
  nodeId: string,
  options: { force?: boolean } = {},
): AiModelResult {
  let target: { changeSetId: string; itemId: string } | null = null
  for (const changeSet of state.changeSets) {
    for (const item of changeSet.items) {
      if (item.kind === 'create-node' && item.nodeKind === nodeKind && item.nodeId === nodeId && item.status === 'applied') {
        target = { changeSetId: changeSet.id, itemId: item.id }
        break
      }
    }
    if (target) break
  }
  if (!target) return { ok: false, reason: 'not-found' }

  const found = findItem(state, target.changeSetId, target.itemId)
  if (!found || found.item.kind !== 'create-node') return { ok: false, reason: 'not-found' }
  const item = found.item

  if (item.editedByUserAfterApply && !options.force) return { ok: false, reason: 'needs-force' }

  const next = { ...item, status: 'removed' as const }
  const nextState = replaceItem(state, target.changeSetId, target.itemId, next)
  const key = provenanceKey(nodeKind, nodeId)
  const { [key]: _removed, ...provenance } = nextState.provenance
  const operations: AiCanvasOperation[] = [
    { type: 'remove-node', nodeKind, nodeId },
    { type: 'clear-node-provenance', nodeKind, nodeId },
  ]
  return { ok: true, state: { ...nextState, provenance }, operations }
}

/** Convenience wrapper: accept every bulk-acceptable item in a ChangeSet.
 *  Skips (does not throw on) items that fail between selection and accept —
 *  none should in practice since bulkAcceptable and acceptItem use the same
 *  pending-status rule, but this keeps the function total. */
export function acceptBulk(
  state: AiPanelState,
  changeSetId: string,
): { state: AiPanelState; operations: AiCanvasOperation[]; acceptedItemIds: string[] } {
  const changeSet = state.changeSets.find((candidate) => candidate.id === changeSetId)
  if (!changeSet) return { state, operations: [], acceptedItemIds: [] }

  let nextState = state
  const operations: AiCanvasOperation[] = []
  const acceptedItemIds: string[] = []
  for (const item of bulkAcceptable(changeSet)) {
    const result = acceptItem(nextState, changeSetId, item.id)
    if (!result.ok) continue
    nextState = result.state
    operations.push(...result.operations)
    acceptedItemIds.push(item.id)
  }
  return { state: nextState, operations, acceptedItemIds }
}

// ---------------------------------------------------------------------------
// Provenance
// ---------------------------------------------------------------------------

/** Merge (or insert) a node's provenance record. Pure — main.tsx calls this
 *  right after recordNodeVersion(..., { aiGenerated: true }) so the two
 *  stay consistent. */
export function setNodeProvenance(
  state: AiPanelState,
  nodeKind: GraphNodeKind,
  nodeId: string,
  provenance: AiNodeProvenance,
): AiPanelState {
  const key = provenanceKey(nodeKind, nodeId)
  return { ...state, provenance: { ...state.provenance, [key]: provenance } }
}

/** Mark a node's provenance as user-edited after generation (badge flips
 *  "AI" -> "AI, đã sửa"). No-op if the node has no provenance record (a
 *  human-created node was never AI-generated in the first place). */
export function markNodeEditedAfterGeneration(state: AiPanelState, nodeKind: GraphNodeKind, nodeId: string): AiPanelState {
  const key = provenanceKey(nodeKind, nodeId)
  const existing = state.provenance[key]
  if (!existing || existing.editedAfterGeneration) return state
  return { ...state, provenance: { ...state.provenance, [key]: { ...existing, editedAfterGeneration: true } } }
}

// ---------------------------------------------------------------------------
// Thread filtering
// ---------------------------------------------------------------------------

/** DECISIONS.md "lọc theo node đang chọn" — threads anchored to nodeId. */
export function threadsForNode(state: AiPanelState, nodeId: string): AiThread[] {
  return state.threads.filter((thread) => thread.anchorNodeIds.includes(nodeId))
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

export interface AiPanelSnapshot {
  schemaVersion: number
  threads: AiThread[]
  messages: AiPanelState['messages']
  runs: AiPanelState['runs']
  changeSets: AiChangeSet[]
  skillCheckpoints: AiSkillCheckpoint[]
  provenance: Record<string, AiNodeProvenance>
}

export function toSnapshot(state: AiPanelState): AiPanelSnapshot {
  return {
    schemaVersion: AI_PANEL_SCHEMA_VERSION,
    threads: state.threads,
    messages: state.messages,
    runs: state.runs,
    changeSets: state.changeSets,
    skillCheckpoints: state.skillCheckpoints,
    provenance: state.provenance,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString)
}

function isOneOf<T extends string>(value: unknown, options: readonly T[]): value is T {
  return isString(value) && (options as readonly string[]).includes(value)
}

function parseArray<T>(value: unknown, parseOne: (entry: unknown) => T | null): T[] {
  if (!Array.isArray(value)) return []
  const result: T[] = []
  for (const entry of value) {
    const parsed = parseOne(entry)
    if (parsed !== null) result.push(parsed)
  }
  return result
}

const GRAPH_NODE_KINDS = ['idea', 'image', 'palette', 'diagram', 'placeholder'] as const
const MESSAGE_ROLES = ['user', 'assistant', 'system-error'] as const
const RUN_STATUSES = ['queued', 'running', 'done', 'error', 'cancelled'] as const
const CHECKPOINT_STATUSES = ['waiting', 'resolved', 'cancelled'] as const
const CREATE_STATUSES = ['applied', 'removed'] as const
const EDIT_STATUSES = ['pending', 'accepted', 'rejected', 'stale'] as const
const DELETE_STATUSES = ['pending', 'accepted', 'kept'] as const

function parseNodeRef(value: unknown): { kind: GraphNodeKind; id: string } | null {
  if (!isRecord(value)) return null
  if (!isOneOf(value.kind, GRAPH_NODE_KINDS) || !isString(value.id)) return null
  return { kind: value.kind, id: value.id }
}

function parseThread(value: unknown): AiThread | null {
  if (!isRecord(value)) return null
  if (!isString(value.id) || !isString(value.title) || !isString(value.createdAt) || !isString(value.updatedAt)) return null
  if (!isStringArray(value.anchorNodeIds)) return null
  const thread: AiThread = {
    id: value.id,
    title: value.title,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    anchorNodeIds: value.anchorNodeIds,
  }
  if (isBoolean(value.archived)) thread.archived = value.archived
  return thread
}

function parseMessage(value: unknown): AiPanelState['messages'][number] | null {
  if (!isRecord(value)) return null
  if (!isString(value.id) || !isString(value.threadId) || !isString(value.text) || !isString(value.createdAt)) return null
  if (!isOneOf(value.role, MESSAGE_ROLES)) return null
  const contextNodes = Array.isArray(value.contextNodes)
    ? value.contextNodes.map(parseNodeRef).filter((ref): ref is { kind: GraphNodeKind; id: string } => ref !== null)
    : []
  const message: AiPanelState['messages'][number] = {
    id: value.id,
    threadId: value.threadId,
    role: value.role,
    text: value.text,
    createdAt: value.createdAt,
    contextNodes,
  }
  if (isString(value.runId)) message.runId = value.runId
  return message
}

const PROVIDER_TYPES = [
  'apple_foundation',
  'openai',
  'anthropic',
  'gemini',
  'openrouter',
  'ollama',
  'lm_studio',
  'custom_openai_compatible',
  'codex',
  'claude_code',
] as const

function parseRun(value: unknown): AiPanelState['runs'][number] | null {
  if (!isRecord(value)) return null
  if (
    !isString(value.id) ||
    !isString(value.threadId) ||
    !isOneOf(value.providerType, PROVIDER_TYPES) ||
    !isString(value.modelLabel) ||
    !isString(value.startedAt) ||
    !isOneOf(value.status, RUN_STATUSES) ||
    !isString(value.promptPreview)
  ) {
    return null
  }
  const run: AiPanelState['runs'][number] = {
    id: value.id,
    threadId: value.threadId,
    providerType: value.providerType,
    modelLabel: value.modelLabel,
    startedAt: value.startedAt,
    status: value.status,
    promptPreview: value.promptPreview,
  }
  if (isString(value.finishedAt)) run.finishedAt = value.finishedAt
  if (isString(value.errorMessage)) run.errorMessage = value.errorMessage
  if (isString(value.resultSummary)) run.resultSummary = value.resultSummary
  if (isString(value.changeSetId)) run.changeSetId = value.changeSetId
  if (isString(value.skill)) run.skill = value.skill
  return run
}

function parseChangeItem(value: unknown): AiChangeItem | null {
  if (!isRecord(value)) return null
  if (!isString(value.id) || !isString(value.createdAt)) return null

  if (value.kind === 'create-node') {
    if (
      !isOneOf(value.nodeKind, GRAPH_NODE_KINDS) ||
      !isString(value.nodeId) ||
      !isString(value.title) ||
      !isOneOf(value.status, CREATE_STATUSES) ||
      !isBoolean(value.editedByUserAfterApply)
    ) {
      return null
    }
    return {
      kind: 'create-node',
      id: value.id,
      createdAt: value.createdAt,
      nodeKind: value.nodeKind,
      nodeId: value.nodeId,
      title: value.title,
      status: value.status,
      editedByUserAfterApply: value.editedByUserAfterApply,
    }
  }

  if (value.kind === 'edit-text') {
    if (
      !isOneOf(value.targetNodeKind, GRAPH_NODE_KINDS) ||
      !isString(value.targetNodeId) ||
      !isString(value.field) ||
      !isString(value.before) ||
      !isString(value.after) ||
      !isOneOf(value.status, EDIT_STATUSES)
    ) {
      return null
    }
    return {
      kind: 'edit-text',
      id: value.id,
      createdAt: value.createdAt,
      targetNodeKind: value.targetNodeKind,
      targetNodeId: value.targetNodeId,
      field: value.field,
      before: value.before,
      after: value.after,
      status: value.status,
    }
  }

  if (value.kind === 'edit-palette') {
    if (
      !isString(value.targetNodeId) ||
      !isStringArray(value.beforeColors) ||
      !isStringArray(value.afterColors) ||
      !isOneOf(value.status, EDIT_STATUSES)
    ) {
      return null
    }
    return {
      kind: 'edit-palette',
      id: value.id,
      createdAt: value.createdAt,
      targetNodeId: value.targetNodeId,
      beforeColors: value.beforeColors,
      afterColors: value.afterColors,
      status: value.status,
    }
  }

  if (value.kind === 'delete-node') {
    if (
      !isOneOf(value.targetNodeKind, GRAPH_NODE_KINDS) ||
      !isString(value.targetNodeId) ||
      !isString(value.targetTitle) ||
      !isOneOf(value.status, DELETE_STATUSES)
    ) {
      return null
    }
    const item: AiChangeItem = {
      kind: 'delete-node',
      id: value.id,
      createdAt: value.createdAt,
      targetNodeKind: value.targetNodeKind,
      targetNodeId: value.targetNodeId,
      targetTitle: value.targetTitle,
      status: value.status,
    }
    if (typeof value.linkCountAffected === 'number') item.linkCountAffected = value.linkCountAffected
    return item
  }

  return null
}

function parseChangeSet(value: unknown): AiChangeSet | null {
  if (!isRecord(value)) return null
  if (!isString(value.id) || !isString(value.runId) || !isString(value.threadId) || !isString(value.title) || !isString(value.createdAt)) {
    return null
  }
  return {
    id: value.id,
    runId: value.runId,
    threadId: value.threadId,
    title: value.title,
    createdAt: value.createdAt,
    items: parseArray(value.items, parseChangeItem),
  }
}

function parseSkillCheckpoint(value: unknown): AiSkillCheckpoint | null {
  if (!isRecord(value)) return null
  if (
    !isString(value.id) ||
    !isString(value.runId) ||
    !isString(value.threadId) ||
    !isString(value.skill) ||
    !isString(value.stepLabel) ||
    !isString(value.createdAt) ||
    !isOneOf(value.status, CHECKPOINT_STATUSES)
  ) {
    return null
  }
  const checkpoint: AiSkillCheckpoint = {
    id: value.id,
    runId: value.runId,
    threadId: value.threadId,
    skill: value.skill,
    stepLabel: value.stepLabel,
    status: value.status,
    createdAt: value.createdAt,
  }
  if (isString(value.resolvedAt)) checkpoint.resolvedAt = value.resolvedAt
  return checkpoint
}

function parseProvenanceEntry(value: unknown): AiNodeProvenance | null {
  if (!isRecord(value)) return null
  if (!isBoolean(value.aiGenerated) || !isString(value.runId) || !isString(value.threadId) || !isBoolean(value.editedAfterGeneration)) {
    return null
  }
  return {
    aiGenerated: value.aiGenerated,
    runId: value.runId,
    threadId: value.threadId,
    editedAfterGeneration: value.editedAfterGeneration,
  }
}

function parseProvenanceMap(value: unknown): Record<string, AiNodeProvenance> {
  if (!isRecord(value)) return {}
  const result: Record<string, AiNodeProvenance> = {}
  for (const [key, entry] of Object.entries(value)) {
    const parsed = parseProvenanceEntry(entry)
    if (parsed !== null) result[key] = parsed
  }
  return result
}

/** Tolerant parsing: unknown top-level fields are dropped, malformed array
 *  entries are skipped, and any unexpected shape (null, a string, a number,
 *  missing fields entirely) falls back to an empty state instead of
 *  throwing. Never throws. */
export function fromSnapshot(input: unknown): AiPanelState {
  const base = createEmptyAiPanelState()
  if (!isRecord(input)) return base
  return {
    schemaVersion: AI_PANEL_SCHEMA_VERSION,
    threads: parseArray(input.threads, parseThread),
    messages: parseArray(input.messages, parseMessage),
    runs: parseArray(input.runs, parseRun),
    changeSets: parseArray(input.changeSets, parseChangeSet),
    skillCheckpoints: parseArray(input.skillCheckpoints, parseSkillCheckpoint),
    provenance: parseProvenanceMap(input.provenance),
  }
}
