/**
 * Run with: bun test apps/desktop/src/kira
 */
import { describe, expect, test } from 'bun:test'
import {
  DISCOVERY_ANCHOR_TTL_MS,
  type DiscoveryAnchor,
  isDiscoveryAnchorActive,
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
