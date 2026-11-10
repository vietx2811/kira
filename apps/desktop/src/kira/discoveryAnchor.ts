/**
 * Pure logic for the "discovery anchor" (docs/research/
 * 2026-11-09-pinterest-similar-flow.md §3.2): remembers which canvas node a
 * Pinterest "find similar" trip started from, so a browser capture made
 * during that trip (hover-Save, Alt+Shift+K — neither one carries an
 * explicit target, content.ts:139-150) attaches back to that node instead
 * of landing unlinked in the library.
 *
 * No React, no DOM, no import from main.tsx — unit-testable on its own
 * (`bun test apps/desktop/src/kira`), same reasoning as the rest of this
 * directory (see README.md). `GraphNodeKind` is reused from aiPanelTypes.ts
 * rather than copied a third time.
 */

import type { GraphNodeKind } from './aiPanelTypes'

export type DiscoveryAnchor = {
  kind: GraphNodeKind
  id: string
  expiresAt: number
}

/** A Pinterest browsing session's worth of slack — long enough to cover a
    search-and-save trip, short enough that a capture from an unrelated
    later task doesn't silently attach to a node from an hour ago (report
    §3.2's own proposed figure). */
export const DISCOVERY_ANCHOR_TTL_MS = 15 * 60 * 1000

export function isDiscoveryAnchorActive(anchor: DiscoveryAnchor | null, now: number): anchor is DiscoveryAnchor {
  return anchor !== null && anchor.expiresAt > now
}

/**
 * Which node (if any) an anchor resolves to right now. `resolveNode` is the
 * caller's own lookup (e.g. resolveGraphNodeRef against current ideas/
 * images/... state) — returning null from it covers both "a node with this
 * id never existed" and "it existed but was deleted while the anchor was
 * still live": either way, the anchor is ignored rather than attaching a
 * capture to nothing.
 */
export function resolveDiscoveryAnchorTarget<TNode>(
  anchor: DiscoveryAnchor | null,
  now: number,
  resolveNode: (kind: GraphNodeKind, id: string) => TNode | null,
): TNode | null {
  if (!isDiscoveryAnchorActive(anchor, now)) return null
  return resolveNode(anchor.kind, anchor.id)
}

/**
 * The capture-attachment decision handleKiraCapture's fallback branch
 * needs: an explicit target (capture.targetNode, already resolved by the
 * caller) always wins over the anchor — this is only ever consulted when
 * there's no explicit choice, never used to override one.
 */
export function resolveCaptureTargetNode<TNode>(
  explicitTarget: TNode | null,
  anchor: DiscoveryAnchor | null,
  now: number,
  resolveNode: (kind: GraphNodeKind, id: string) => TNode | null,
): TNode | null {
  if (explicitTarget) return explicitTarget
  return resolveDiscoveryAnchorTarget(anchor, now, resolveNode)
}

/**
 * Side-peek "Explore" tray (docs/research/2026-11-09-pinterest-similar-flow.md,
 * Cập nhật 2026-11-10 §C): a browser capture made while an anchor is active
 * no longer attaches to the canvas immediately — it waits here for the user
 * to Keep or Discard it, keyed by the anchor's node (not the anchor object
 * itself, which is short-lived and expires on its own TTL independent of
 * this queue). A node keeps its queue even after the anchor that filled it
 * expires or is dismissed: those are real "the user clicked Save" captures,
 * not something a 15-minute timeout should silently drop.
 */
export type PendingCaptureQueue<TNode> = Record<string, TNode[]>

export function pendingCaptureKey(kind: GraphNodeKind, id: string): string {
  return `${kind}:${id}`
}

export function pushPendingCapture<TNode>(
  queue: PendingCaptureQueue<TNode>,
  kind: GraphNodeKind,
  id: string,
  capture: TNode,
): PendingCaptureQueue<TNode> {
  const key = pendingCaptureKey(kind, id)
  return { ...queue, [key]: [...(queue[key] ?? []), capture] }
}

/** `predicate` identifies the one capture to drop from this node's queue
    (Keep and Discard both remove exactly one, by whatever TNode's own id
    looks like — the caller's concern, not this module's). Removes the key
    entirely once its list empties, so an unrelated caller iterating queue
    keys never has to filter out empty arrays. */
export function removePendingCapture<TNode>(
  queue: PendingCaptureQueue<TNode>,
  kind: GraphNodeKind,
  id: string,
  predicate: (capture: TNode) => boolean,
): PendingCaptureQueue<TNode> {
  const key = pendingCaptureKey(kind, id)
  const existing = queue[key]
  if (!existing) return queue
  const next = existing.filter((item) => !predicate(item))
  if (next.length === existing.length) return queue
  if (next.length === 0) {
    const { [key]: _removed, ...rest } = queue
    return rest
  }
  return { ...queue, [key]: next }
}

export function getPendingCaptures<TNode>(
  queue: PendingCaptureQueue<TNode>,
  kind: GraphNodeKind,
  id: string,
): TNode[] {
  return queue[pendingCaptureKey(kind, id)] ?? []
}
