/**
 * Run with: bun test apps/desktop/src/kira
 */
import { describe, expect, test } from 'bun:test'
import {
  DISCOVERY_ANCHOR_TTL_MS,
  type DiscoveryAnchor,
  getPendingCaptures,
  isDiscoveryAnchorActive,
  type PendingCaptureQueue,
  pendingCaptureKey,
  pushPendingCapture,
  removePendingCapture,
  resolveCaptureTargetNode,
  resolveDiscoveryAnchorTarget,
} from './discoveryAnchor'

const NOW = 1_700_000_000_000

function anchor(overrides: Partial<DiscoveryAnchor> = {}): DiscoveryAnchor {
  return { kind: 'image', id: 'node-1', expiresAt: NOW + DISCOVERY_ANCHOR_TTL_MS, ...overrides }
}

describe('isDiscoveryAnchorActive', () => {
  test('still within its TTL', () => {
    expect(isDiscoveryAnchorActive(anchor(), NOW)).toBe(true)
  })

  test('expired', () => {
    expect(isDiscoveryAnchorActive(anchor({ expiresAt: NOW - 1 }), NOW)).toBe(false)
  })

  test('expires exactly at the boundary (not inclusive)', () => {
    expect(isDiscoveryAnchorActive(anchor({ expiresAt: NOW }), NOW)).toBe(false)
  })

  test('no anchor', () => {
    expect(isDiscoveryAnchorActive(null, NOW)).toBe(false)
  })
})

describe('resolveDiscoveryAnchorTarget', () => {
  const existingNode = { id: 'node-1', title: 'Ritual interface' }
  const resolveExisting = (_kind: string, id: string) => (id === 'node-1' ? existingNode : null)
  const resolveNothing = () => null

  test('active anchor resolves to the node', () => {
    expect(resolveDiscoveryAnchorTarget(anchor(), NOW, resolveExisting)).toBe(existingNode)
  })

  test('expired anchor resolves to nothing, even if the node still exists', () => {
    expect(resolveDiscoveryAnchorTarget(anchor({ expiresAt: NOW - 1 }), NOW, resolveExisting)).toBe(null)
  })

  test('anchor pointing at a deleted node is ignored', () => {
    expect(resolveDiscoveryAnchorTarget(anchor(), NOW, resolveNothing)).toBe(null)
  })

  test('no anchor at all', () => {
    expect(resolveDiscoveryAnchorTarget(null, NOW, resolveExisting)).toBe(null)
  })
})

describe('resolveCaptureTargetNode', () => {
  const anchoredNode = { id: 'node-1', title: 'Anchored node' }
  const resolveAnchored = (_kind: string, id: string) => (id === 'node-1' ? anchoredNode : null)

  test('an explicit target always wins over a valid anchor', () => {
    const explicitTarget = { id: 'node-2', title: 'Drop-pad target' }
    expect(resolveCaptureTargetNode(explicitTarget, anchor(), NOW, resolveAnchored)).toBe(explicitTarget)
  })

  test('falls back to the anchor when there is no explicit target', () => {
    expect(resolveCaptureTargetNode(null, anchor(), NOW, resolveAnchored)).toBe(anchoredNode)
  })

  test('no explicit target and an expired anchor resolves to nothing', () => {
    expect(resolveCaptureTargetNode(null, anchor({ expiresAt: NOW - 1 }), NOW, resolveAnchored)).toBe(null)
  })

  test('no explicit target and the anchor points to a deleted node resolves to nothing', () => {
    expect(resolveCaptureTargetNode(null, anchor({ id: 'deleted-node' }), NOW, resolveAnchored)).toBe(null)
  })

  test('no explicit target and no anchor resolves to nothing', () => {
    expect(resolveCaptureTargetNode(null, null, NOW, resolveAnchored)).toBe(null)
  })
})

type Capture = { id: string; title: string }

function capture(id: string, title = id): Capture {
  return { id, title }
}

describe('pendingCaptureKey', () => {
  test('combines kind and id, distinguishing same id across kinds', () => {
    expect(pendingCaptureKey('image', 'node-1')).toBe('image:node-1')
    expect(pendingCaptureKey('image', 'node-1')).not.toBe(pendingCaptureKey('idea', 'node-1'))
  })
})

describe('pushPendingCapture', () => {
  test('starts a new list for a node with no queue yet', () => {
    const queue = pushPendingCapture<Capture>({}, 'image', 'node-1', capture('a'))
    expect(getPendingCaptures(queue, 'image', 'node-1')).toEqual([capture('a')])
  })

  test('appends to an existing list, oldest first', () => {
    let queue = pushPendingCapture<Capture>({}, 'image', 'node-1', capture('a'))
    queue = pushPendingCapture(queue, 'image', 'node-1', capture('b'))
    expect(getPendingCaptures(queue, 'image', 'node-1')).toEqual([capture('a'), capture('b')])
  })

  test('does not mutate the queue passed in', () => {
    const original: PendingCaptureQueue<Capture> = {}
    pushPendingCapture(original, 'image', 'node-1', capture('a'))
    expect(original).toEqual({})
  })

  test('keeps separate queues per node', () => {
    let queue = pushPendingCapture<Capture>({}, 'image', 'node-1', capture('a'))
    queue = pushPendingCapture(queue, 'image', 'node-2', capture('b'))
    expect(getPendingCaptures(queue, 'image', 'node-1')).toEqual([capture('a')])
    expect(getPendingCaptures(queue, 'image', 'node-2')).toEqual([capture('b')])
  })
})

describe('removePendingCapture', () => {
  test('removes the one capture matching the predicate', () => {
    let queue = pushPendingCapture<Capture>({}, 'image', 'node-1', capture('a'))
    queue = pushPendingCapture(queue, 'image', 'node-1', capture('b'))
    queue = removePendingCapture(queue, 'image', 'node-1', (item) => item.id === 'a')
    expect(getPendingCaptures(queue, 'image', 'node-1')).toEqual([capture('b')])
  })

  test('drops the key entirely once its last capture is removed', () => {
    const queue = pushPendingCapture<Capture>({}, 'image', 'node-1', capture('a'))
    const next = removePendingCapture(queue, 'image', 'node-1', (item) => item.id === 'a')
    expect(next).toEqual({})
    expect(Object.keys(next)).toHaveLength(0)
  })

  test('a node with no queue is a no-op, not an error', () => {
    const queue: PendingCaptureQueue<Capture> = {}
    expect(removePendingCapture(queue, 'image', 'node-1', () => true)).toBe(queue)
  })

  test('a predicate matching nothing leaves the queue untouched', () => {
    const queue = pushPendingCapture<Capture>({}, 'image', 'node-1', capture('a'))
    expect(removePendingCapture(queue, 'image', 'node-1', (item) => item.id === 'z')).toBe(queue)
  })

  test('does not touch another node\'s queue', () => {
    let queue = pushPendingCapture<Capture>({}, 'image', 'node-1', capture('a'))
    queue = pushPendingCapture(queue, 'image', 'node-2', capture('b'))
    queue = removePendingCapture(queue, 'image', 'node-1', (item) => item.id === 'a')
    expect(getPendingCaptures(queue, 'image', 'node-2')).toEqual([capture('b')])
  })
})

describe('getPendingCaptures', () => {
  test('a node with no queue returns an empty array, not undefined', () => {
    expect(getPendingCaptures<Capture>({}, 'image', 'node-1')).toEqual([])
  })
})
