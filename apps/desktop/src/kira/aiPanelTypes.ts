/**
 * Data-layer types for the Kira right panel (Chat + "Cần bạn").
 *
 * Deliberately self-contained: does NOT import anything from main.tsx.
 * main.tsx is an 18k-line hot file claimed by other threads while this
 * module was written, and the panel's data model needs to build and unit
 * test on its own regardless of who holds main.tsx. `GraphNodeKind` and
 * `AiProviderType` below are copies of the unions already declared in
 * main.tsx (see README.md "Kept in sync manually" note) — when main.tsx
 * changes those unions, mirror the change here.
 *
 * Spec sources: docs/design/right-panel/DECISIONS.md,
 * docs/research/2026-09-13-right-panel-and-research-harness.md (§A2-A6),
 * docs/research/2026-09-13-right-panel-harness-oss.md (§2.2),
 * docs/design/right-panel/mockup.js.
 */

// ---------------------------------------------------------------------------
// Shared primitives (mirrors of main.tsx unions — keep in sync manually)
// ---------------------------------------------------------------------------

export type GraphNodeKind = 'idea' | 'image' | 'palette' | 'diagram' | 'placeholder'

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

export interface AiNodeRef {
  kind: GraphNodeKind
  id: string
}

// ---------------------------------------------------------------------------
// Thread / message / run (research §A2)
// ---------------------------------------------------------------------------

export interface AiThread {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  /** Nodes this thread is anchored to. Empty = whole-board thread. */
  anchorNodeIds: string[]
  archived?: boolean
}

export type AiMessageRole = 'user' | 'assistant' | 'system-error'

export interface AiMessage {
  id: string
  threadId: string
  role: AiMessageRole
  text: string
  createdAt: string
  /** Set when this message is the assistant reply produced by a run. */
  runId?: string
  /** Node refs shown as "context chips" under a user message (DECISIONS.md
   *  chat context), or the nodes an assistant answer drew from. */
  contextNodes: AiNodeRef[]
}

export type AiRunStatus = 'queued' | 'running' | 'done' | 'error' | 'cancelled'

export interface AiRun {
  id: string
  threadId: string
  providerType: AiProviderType
  /** Human-facing model label, e.g. "claude-sonnet-5" or "Claude Code (CLI)". */
  modelLabel: string
  startedAt: string
  finishedAt?: string
  status: AiRunStatus
  errorMessage?: string
  /** Short preview of the prompt sent (full prompt lives in AiRun consumers
   *  outside this module — this module only needs enough to render "Chi
   *  tiết run"). */
  promptPreview: string
  resultSummary?: string
  /** Set once the run produced a ChangeSet. */
  changeSetId?: string
  /** Name of the pipeline skill this run belongs to, if any (mockup §6). */
  skill?: string
}

// ---------------------------------------------------------------------------
// Changes ("Cần bạn" tab) — research §A4, OSS report §2.2
// ---------------------------------------------------------------------------

export type CreateNodeItemStatus = 'applied' | 'removed'
export type EditItemStatus = 'pending' | 'accepted' | 'rejected' | 'stale'
export type DeleteItemStatus = 'pending' | 'accepted' | 'kept'

interface AiChangeItemBase {
  id: string
  createdAt: string
}

/** create-node: applied immediately per DECISIONS.md #2. Kept in the
 *  ChangeSet so it can still be undone ("bỏ được") from the "Cần bạn" tab. */
export interface AiCreateNodeItem extends AiChangeItemBase {
  kind: 'create-node'
  status: CreateNodeItemStatus
  nodeKind: GraphNodeKind
  nodeId: string
  title: string
  /** True once the user has edited this node's content after Kira created
   *  it. Gates removeAppliedNode (mockup "appliedGuarded" item). */
  editedByUserAfterApply: boolean
}

/** edit-text: AI proposes editing an existing node's text field. Always
 *  held for review (DECISIONS.md #3) — never applied until accepted. */
export interface AiEditTextItem extends AiChangeItemBase {
  kind: 'edit-text'
  status: EditItemStatus
  targetNodeKind: GraphNodeKind
  targetNodeId: string
  /** Which field of the node this edits, e.g. 'content' | 'title'. Used by
   *  markStaleOnUserEdit to match a user edit to a pending proposal. */
  field: string
  before: string
  after: string
}

/** edit-palette: AI proposes replacing a palette's colors. Always held for
 *  review (DECISIONS.md #3). */
export interface AiEditPaletteItem extends AiChangeItemBase {
  kind: 'edit-palette'
  status: EditItemStatus
  targetNodeId: string
  beforeColors: string[]
  afterColors: string[]
}

/** delete-node: always held for separate review, never bulk-acceptable
 *  (mockup "Nhận hàng loạt không bao gồm xoá và mục đã cũ"). */
export interface AiDeleteNodeItem extends AiChangeItemBase {
  kind: 'delete-node'
  status: DeleteItemStatus
  targetNodeKind: GraphNodeKind
  targetNodeId: string
  targetTitle: string
  /** How many links would be lost if the delete is accepted, shown in the
   *  mockup as "2 liên kết sẽ mất". */
  linkCountAffected?: number
}

export type AiChangeItem = AiCreateNodeItem | AiEditTextItem | AiEditPaletteItem | AiDeleteNodeItem
export type AiChangeItemKind = AiChangeItem['kind']

export interface AiChangeSet {
  id: string
  runId: string
  threadId: string
  title: string
  createdAt: string
  items: AiChangeItem[]
}

// ---------------------------------------------------------------------------
// Skill pipeline checkpoints (mockup §6, DECISIONS.md #6)
// ---------------------------------------------------------------------------

export type AiSkillCheckpointStatus = 'waiting' | 'resolved' | 'cancelled'

export interface AiSkillCheckpoint {
  id: string
  runId: string
  threadId: string
  /** Skill id, e.g. 'color-expert' | 'folder-brief'. */
  skill: string
  /** Label of the step paused at, e.g. "Duyệt nhánh concept". */
  stepLabel: string
  status: AiSkillCheckpointStatus
  createdAt: string
  resolvedAt?: string
}

// ---------------------------------------------------------------------------
// Provenance (research §A5)
// ---------------------------------------------------------------------------

export interface AiNodeProvenance {
  aiGenerated: boolean
  runId: string
  threadId: string
  /** True once the user has edited the node's content after Kira produced
   *  it. Badge switches "AI" -> "AI, đã sửa" (mockup provBadge). */
  editedAfterGeneration: boolean
}

/** Key used for AiPanelState.provenance, since a node is identified by
 *  (kind, id) rather than id alone. */
export function provenanceKey(kind: GraphNodeKind, id: string): string {
  return `${kind}:${id}`
}

// ---------------------------------------------------------------------------
// Canvas operations returned by mutating model functions. main.tsx applies
// these through its existing zundo history (pushCanvasHistory + setters)
// without this module knowing the store shape.
// ---------------------------------------------------------------------------

export type AiCanvasOperation =
  | { type: 'update-node-text'; nodeKind: GraphNodeKind; nodeId: string; field: string; text: string }
  | { type: 'update-node-palette'; nodeId: string; colors: string[] }
  | { type: 'delete-node'; nodeKind: GraphNodeKind; nodeId: string }
  | { type: 'remove-node'; nodeKind: GraphNodeKind; nodeId: string }
  | { type: 'clear-node-provenance'; nodeKind: GraphNodeKind; nodeId: string }
  | {
      type: 'record-node-version'
      nodeKind: GraphNodeKind
      nodeId: string
      runId: string
      aiGenerated: boolean
      note?: string
    }

// ---------------------------------------------------------------------------
// Aggregate state this module's pure functions operate over
// ---------------------------------------------------------------------------

export interface AiPanelState {
  schemaVersion: number
  threads: AiThread[]
  messages: AiMessage[]
  runs: AiRun[]
  changeSets: AiChangeSet[]
  skillCheckpoints: AiSkillCheckpoint[]
  provenance: Record<string, AiNodeProvenance>
}

export interface AiPanelSummary {
  /** DECISIONS.md #6: the single "cần xử lý" count — pending + stale items
   *  plus waiting skill checkpoints. Same number as needsYouCount(state). */
  needsYou: number
  /** Applied create-node items across all ChangeSets. */
  applied: number
  /** Accepted edit-text / edit-palette / delete-node items across all
   *  ChangeSets. */
  accepted: number
}

/** Uniform result for mutating model functions: domain refusals (wrong
 *  status, missing force, not found) are returned, not thrown, so callers
 *  render a guard dialog instead of catching exceptions. */
export type AiModelResult =
  | { ok: true; state: AiPanelState; operations: AiCanvasOperation[] }
  | { ok: false; reason: string }
