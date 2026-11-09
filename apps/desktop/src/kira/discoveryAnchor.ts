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
