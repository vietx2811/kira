/**
 * Run with: bun test apps/desktop/src/kira
 *
 * Fixtures mirror docs/design/right-panel/mockup.js scenarios s3 (Cần bạn,
 * NEEDS_DECISION = 4), s6 (a skill checkpoint bumps the count to 5), and s7
 * (after accepting the one pending text edit, the count drops to 3).
 */
import { describe, expect, test } from 'bun:test'
import {
  acceptBulk,
  acceptItem,
  bulkAcceptable,
  createEmptyAiPanelState,
  dismissSkillCheckpoint,
  fromSnapshot,
  markCreateNodeItemEdited,
  markStaleOnUserEdit,
  needsYouCount,
  rejectItem,
  removeAppliedNode,
  revertAcceptedItem,
  threadsForNode,
  toSnapshot,
  visibleCheckpoints,
} from './aiPanelModel'
import type {
  AiChangeSet,
  AiCreateNodeItem,
  AiDeleteNodeItem,
  AiEditPaletteItem,
  AiEditTextItem,
  AiPanelState,
  AiSkillCheckpoint,
  AiThread,
} from './aiPanelTypes'

// ---------------------------------------------------------------------------
// Fixtures: mockup.js s3-changes ("Tách nhánh concept Hanoi noir" +
// collapsed "Palette cho biển hiệu")
// ---------------------------------------------------------------------------

function appliedPlainItem(): AiCreateNodeItem {
  return {
    kind: 'create-node',
    id: 'item-applied-plain',
    createdAt: '2026-09-14T14:32:00.000Z',
    nodeKind: 'idea',
    nodeId: 'idea-brass-bar',
    title: 'Quầy bar ánh đồng',
    status: 'applied',
    editedByUserAfterApply: false,
  }
}

function appliedGuardedItem(): AiCreateNodeItem {
  return {
    kind: 'create-node',
    id: 'item-applied-guarded',
    createdAt: '2026-09-14T14:32:00.000Z',
    nodeKind: 'idea',
    nodeId: 'idea-rain-street',
    title: 'Phố cổ sau mưa',
    status: 'applied',
    editedByUserAfterApply: true,
  }
}

function textItem(status: AiEditTextItem['status'] = 'pending'): AiEditTextItem {
  return {
    kind: 'edit-text',
    id: 'item-text-edit',
    createdAt: '2026-09-14T14:32:00.000Z',
    targetNodeKind: 'idea',
    targetNodeId: 'idea-hanoi-noir',
    field: 'content',
    before: 'Ánh vàng thấp, gỗ tối, kính mờ hơi nước.',
    after: 'Ánh vàng thấp, gỗ tối, kính mờ và đồng xước.',
    status,
  }
}

function paletteItem(status: AiEditPaletteItem['status'] = 'stale'): AiEditPaletteItem {
  return {
    kind: 'edit-palette',
    id: 'item-palette-edit',
    createdAt: '2026-09-14T14:32:00.000Z',
    targetNodeId: 'palette-night-hangbuom',
    beforeColors: ['#1d2a2e', '#3e5b5c', '#b98a52', '#e3c796', '#f3ece0'],
    afterColors: ['#1d2a2e', '#4a3b2f', '#c07a3e', '#e3c796', '#efe4d2'],
    status,
  }
}

function deleteItem(): AiDeleteNodeItem {
  return {
    kind: 'delete-node',
    id: 'item-delete',
    createdAt: '2026-09-14T14:33:00.000Z',
    targetNodeKind: 'idea',
    targetNodeId: 'idea-old-note',
    targetTitle: 'Ghi chú cũ về ánh đèn',
    status: 'pending',
    linkCountAffected: 2,
  }
}

function branchesChangeSet(): AiChangeSet {
  return {
    id: 'cs-branches',
    runId: 'run-branches',
    threadId: 'thread-branches',
    title: 'Tách nhánh concept Hanoi noir',
    createdAt: '2026-09-14T14:32:00.000Z',
    items: [appliedPlainItem(), appliedGuardedItem(), textItem(), paletteItem(), deleteItem()],
  }
}

function signagePaletteChangeSet(): AiChangeSet {
  // mockup.js: collapsed changeset "Palette cho biển hiệu · 1 cần xử lý".
  return {
    id: 'cs-signage',
    runId: 'run-signage',
    threadId: 'thread-signage',
    title: 'Palette cho biển hiệu',
    createdAt: '2026-09-13T10:00:00.000Z',
    items: [
      {
        kind: 'edit-text',
        id: 'item-signage-text',
        createdAt: '2026-09-13T10:00:00.000Z',
        targetNodeKind: 'idea',
        targetNodeId: 'idea-signage',
        field: 'content',
        before: 'Biển hiệu cũ.',
        after: 'Biển hiệu cũ, chữ tay, ánh đỏ thấp.',
        status: 'pending',
      },
    ],
  }
}

function skillCheckpoint(status: AiSkillCheckpoint['status'] = 'waiting'): AiSkillCheckpoint {
  return {
    id: 'checkpoint-concept',
    runId: 'run-branches',
    threadId: 'thread-branches',
    skill: 'image-pipeline',
    stepLabel: 'Duyệt nhánh concept',
    status,
    createdAt: '2026-09-14T14:50:00.000Z',
  }
}

function s3State(): AiPanelState {
  return {
    ...createEmptyAiPanelState(),
    changeSets: [branchesChangeSet(), signagePaletteChangeSet()],
  }
}

// ---------------------------------------------------------------------------
// needsYouCount — mockup.js scenario counts
// ---------------------------------------------------------------------------

describe('needsYouCount', () => {
  test('s3: two changesets, no skill checkpoint -> 4 (matches mockup NEEDS_DECISION)', () => {
    expect(needsYouCount(s3State())).toBe(4)
  })

  test('applied create-node items never count, even when hand-edited after apply', () => {
    const state: AiPanelState = { ...createEmptyAiPanelState(), changeSets: [branchesChangeSet()] }
    // Only textItem(pending) + paletteItem(stale) + deleteItem(pending) = 3;
    // the two create-node items (one hand-edited) contribute 0.
    expect(needsYouCount(state)).toBe(3)
  })

  test('s6: a waiting skill checkpoint adds SKILL_CHECKPOINT_BUMP (1) on top -> 5', () => {
    const state: AiPanelState = { ...s3State(), skillCheckpoints: [skillCheckpoint('waiting')] }
    expect(needsYouCount(state)).toBe(5)
  })

  test('a resolved or cancelled skill checkpoint does not count', () => {
    const state: AiPanelState = { ...s3State(), skillCheckpoints: [skillCheckpoint('resolved'), skillCheckpoint('cancelled')] }
    expect(needsYouCount(state)).toBe(4)
  })

  test('s7: accepting the one pending text edit drops the count from 4 to 3', () => {
    const before = s3State()
    expect(needsYouCount(before)).toBe(4)
    const result = acceptItem(before, 'cs-branches', 'item-text-edit')
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('unreachable')
    expect(needsYouCount(result.state)).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// bulkAcceptable
// ---------------------------------------------------------------------------

describe('bulkAcceptable', () => {
  test('excludes delete-node and stale items, keeping only pending text/palette edits', () => {
    const eligible = bulkAcceptable(branchesChangeSet())
    expect(eligible).toHaveLength(1)
    expect(eligible[0]?.id).toBe('item-text-edit')
  })

  test('excludes applied create-node items too', () => {
    const eligible = bulkAcceptable(branchesChangeSet())
    expect(eligible.some((item) => item.kind === 'create-node')).toBe(false)
  })

  test('acceptBulk applies every bulk-acceptable item and reports which ones', () => {
    const state = s3State()
    const result = acceptBulk(state, 'cs-branches')
    expect(result.acceptedItemIds).toEqual(['item-text-edit'])
    expect(result.operations.some((op) => op.type === 'update-node-text')).toBe(true)
    // Count only drops by 1 — the stale and delete items in this changeset,
    // and the pending item in the other changeset, are untouched.
    expect(needsYouCount(result.state)).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// markStaleOnUserEdit
// ---------------------------------------------------------------------------

describe('markStaleOnUserEdit', () => {
  test('marks a pending edit-text item stale when the user edited the node after the proposal', () => {
    const state: AiPanelState = { ...createEmptyAiPanelState(), changeSets: [{ ...branchesChangeSet(), items: [textItem('pending')] }] }
    const editedAt = '2026-09-14T14:40:00.000Z' // after item.createdAt (14:32)
    const next = markStaleOnUserEdit(state, 'idea-hanoi-noir', 'content', editedAt)
    const item = next.changeSets[0]?.items[0] as AiEditTextItem
    expect(item.status).toBe('stale')
  })

  test('marks a pending edit-palette item stale on field "colors"', () => {
    const state: AiPanelState = { ...createEmptyAiPanelState(), changeSets: [{ ...branchesChangeSet(), items: [paletteItem('pending')] }] }
    const editedAt = '2026-09-14T14:40:00.000Z'
    const next = markStaleOnUserEdit(state, 'palette-night-hangbuom', 'colors', editedAt)
    const item = next.changeSets[0]?.items[0] as AiEditPaletteItem
    expect(item.status).toBe('stale')
  })

  test('leaves the proposal pending when the user edit predates it', () => {
    const state: AiPanelState = { ...createEmptyAiPanelState(), changeSets: [{ ...branchesChangeSet(), items: [textItem('pending')] }] }
    const editedAt = '2026-09-14T14:00:00.000Z' // before item.createdAt (14:32)
    const next = markStaleOnUserEdit(state, 'idea-hanoi-noir', 'content', editedAt)
    const item = next.changeSets[0]?.items[0] as AiEditTextItem
    expect(item.status).toBe('pending')
  })

  test('ignores a different node id or field', () => {
    const state: AiPanelState = { ...createEmptyAiPanelState(), changeSets: [{ ...branchesChangeSet(), items: [textItem('pending')] }] }
    const editedAt = '2026-09-14T14:40:00.000Z'
    const wrongNode = markStaleOnUserEdit(state, 'idea-someone-else', 'content', editedAt)
    expect((wrongNode.changeSets[0]?.items[0] as AiEditTextItem).status).toBe('pending')
    const wrongField = markStaleOnUserEdit(state, 'idea-hanoi-noir', 'title', editedAt)
    expect((wrongField.changeSets[0]?.items[0] as AiEditTextItem).status).toBe('pending')
  })

  test('does not touch an already-accepted or already-rejected item', () => {
    const state: AiPanelState = { ...createEmptyAiPanelState(), changeSets: [{ ...branchesChangeSet(), items: [textItem('accepted')] }] }
    const next = markStaleOnUserEdit(state, 'idea-hanoi-noir', 'content', '2026-09-14T14:40:00.000Z')
    expect((next.changeSets[0]?.items[0] as AiEditTextItem).status).toBe('accepted')
  })
})

// ---------------------------------------------------------------------------
// acceptItem / rejectItem / keepNode status rules
// ---------------------------------------------------------------------------

describe('acceptItem', () => {
  test('refuses a stale item (mockup: stale offers only reject / re-propose, never accept)', () => {
    const state: AiPanelState = { ...createEmptyAiPanelState(), changeSets: [branchesChangeSet()] }
    const result = acceptItem(state, 'cs-branches', 'item-palette-edit')
    expect(result.ok).toBe(false)
  })

  test('refuses a create-node item (already applied — use removeAppliedNode)', () => {
    const state: AiPanelState = { ...createEmptyAiPanelState(), changeSets: [branchesChangeSet()] }
    const result = acceptItem(state, 'cs-branches', 'item-applied-plain')
    expect(result.ok).toBe(false)
  })

  test('accepting delete-node returns a delete-node canvas operation', () => {
    const state: AiPanelState = { ...createEmptyAiPanelState(), changeSets: [branchesChangeSet()] }
    const result = acceptItem(state, 'cs-branches', 'item-delete')
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('unreachable')
    expect(result.operations.some((op) => op.type === 'delete-node')).toBe(true)
  })
})

describe('rejectItem', () => {
  test('rejects a stale palette item (allowed per mockup)', () => {
    const state: AiPanelState = { ...createEmptyAiPanelState(), changeSets: [branchesChangeSet()] }
    const result = rejectItem(state, 'cs-branches', 'item-palette-edit')
    expect(result.ok).toBe(true)
  })

  test('refuses a delete-node item (use keepNode instead)', () => {
    const state: AiPanelState = { ...createEmptyAiPanelState(), changeSets: [branchesChangeSet()] }
    const result = rejectItem(state, 'cs-branches', 'item-delete')
    expect(result.ok).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// removeAppliedNode guard
// ---------------------------------------------------------------------------

describe('removeAppliedNode', () => {
  test('removes a plain applied node with no guard needed', () => {
    const state: AiPanelState = { ...createEmptyAiPanelState(), changeSets: [branchesChangeSet()] }
    const result = removeAppliedNode(state, 'idea', 'idea-brass-bar')
    expect(result.ok).toBe(true)
  })

  test('refuses to remove a hand-edited AI node without force', () => {
    const state: AiPanelState = { ...createEmptyAiPanelState(), changeSets: [branchesChangeSet()] }
    const result = removeAppliedNode(state, 'idea', 'idea-rain-street')
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.reason).toBe('needs-force')
  })

  test('removes a hand-edited AI node when force is passed', () => {
    const state: AiPanelState = { ...createEmptyAiPanelState(), changeSets: [branchesChangeSet()] }
    const result = removeAppliedNode(state, 'idea', 'idea-rain-street', { force: true })
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('unreachable')
    const item = result.state.changeSets[0]?.items.find((candidate) => candidate.id === 'item-applied-guarded')
    expect(item?.status).toBe('removed')
    expect(result.operations.some((op) => op.type === 'remove-node')).toBe(true)
  })
})

describe('markCreateNodeItemEdited', () => {
  test('flips editedByUserAfterApply on the matching applied create-node item', () => {
    const state: AiPanelState = { ...createEmptyAiPanelState(), changeSets: [branchesChangeSet()] }
    const next = markCreateNodeItemEdited(state, 'idea', 'idea-brass-bar')
    const item = next.changeSets[0]?.items.find((candidate) => candidate.id === 'item-applied-plain')
    expect(item?.kind === 'create-node' && item.editedByUserAfterApply).toBe(true)
  })

  test('is a no-op for a node with no matching applied item', () => {
    const state: AiPanelState = { ...createEmptyAiPanelState(), changeSets: [branchesChangeSet()] }
    const next = markCreateNodeItemEdited(state, 'idea', 'idea-does-not-exist')
    expect(next).toBe(state)
  })

  test('removeAppliedNode then refuses without force after the edit is marked', () => {
    const state: AiPanelState = { ...createEmptyAiPanelState(), changeSets: [branchesChangeSet()] }
    const edited = markCreateNodeItemEdited(state, 'idea', 'idea-brass-bar')
    const result = removeAppliedNode(edited, 'idea', 'idea-brass-bar')
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.reason).toBe('needs-force')
  })
})

// ---------------------------------------------------------------------------
// revertAcceptedItem — P1 fix: Cmd+Z after accepting an AI proposal was
// leaving the "Cần bạn" item stuck on "Accepted" with no action row.
// ---------------------------------------------------------------------------

describe('revertAcceptedItem', () => {
  test('reverts an accepted edit-text item back to stale, not pending', () => {
    const state: AiPanelState = { ...createEmptyAiPanelState(), changeSets: [{ ...branchesChangeSet(), items: [textItem('accepted')] }] }
    const result = revertAcceptedItem(state, 'cs-branches', 'item-text-edit')
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('unreachable')
    const item = result.state.changeSets[0]?.items[0] as AiEditTextItem
    expect(item.status).toBe('stale')
    // Pure status change — the canvas side was already restored by the
    // caller's own undo, so no operations are returned here.
    expect(result.operations).toEqual([])
  })

  test('reverts an accepted edit-palette item back to stale', () => {
    const state: AiPanelState = { ...createEmptyAiPanelState(), changeSets: [{ ...branchesChangeSet(), items: [paletteItem('accepted')] }] }
    const result = revertAcceptedItem(state, 'cs-branches', 'item-palette-edit')
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('unreachable')
    expect((result.state.changeSets[0]?.items[0] as AiEditPaletteItem).status).toBe('stale')
  })

  test('reverts an accepted delete-node item back to pending, not stale (no stale in DeleteItemStatus)', () => {
    const state: AiPanelState = {
      ...createEmptyAiPanelState(),
      changeSets: [{ ...branchesChangeSet(), items: [{ ...deleteItem(), status: 'accepted' }] }],
    }
    const result = revertAcceptedItem(state, 'cs-branches', 'item-delete')
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('unreachable')
    expect((result.state.changeSets[0]?.items[0] as AiDeleteNodeItem).status).toBe('pending')
  })

  test('reverting a stale item brings it back into needsYouCount (undo actually un-orphans it)', () => {
    const state: AiPanelState = { ...createEmptyAiPanelState(), changeSets: [{ ...branchesChangeSet(), items: [textItem('accepted')] }] }
    expect(needsYouCount(state)).toBe(0)
    const result = revertAcceptedItem(state, 'cs-branches', 'item-text-edit')
    if (!result.ok) throw new Error('unreachable')
    expect(needsYouCount(result.state)).toBe(1)
  })

  test('refuses a create-node item (acceptItem never mutates those; use removeAppliedNode)', () => {
    const state: AiPanelState = { ...createEmptyAiPanelState(), changeSets: [branchesChangeSet()] }
    const result = revertAcceptedItem(state, 'cs-branches', 'item-applied-plain')
    expect(result.ok).toBe(false)
  })

  test('refuses an item that is not currently accepted', () => {
    const state: AiPanelState = { ...createEmptyAiPanelState(), changeSets: [branchesChangeSet()] }
    const result = revertAcceptedItem(state, 'cs-branches', 'item-text-edit') // pending, not accepted
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.reason).toBe('not-accepted:pending')
  })

  test('refuses an unknown item id', () => {
    const state: AiPanelState = { ...createEmptyAiPanelState(), changeSets: [branchesChangeSet()] }
    const result = revertAcceptedItem(state, 'cs-branches', 'item-does-not-exist')
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.reason).toBe('not-found')
  })
})

// ---------------------------------------------------------------------------
// visibleCheckpoints / dismissSkillCheckpoint — P1 fix: needsYouCount folded
// waiting skill checkpoints into the badge total, but nothing rendered them
// in the "Cần bạn" tab.
// ---------------------------------------------------------------------------

describe('visibleCheckpoints', () => {
  test('returns only waiting checkpoints, oldest first', () => {
    const older: AiSkillCheckpoint = { ...skillCheckpoint('waiting'), id: 'checkpoint-older', createdAt: '2026-09-14T10:00:00.000Z' }
    const newer: AiSkillCheckpoint = { ...skillCheckpoint('waiting'), id: 'checkpoint-newer', createdAt: '2026-09-14T15:00:00.000Z' }
    const resolved: AiSkillCheckpoint = { ...skillCheckpoint('resolved'), id: 'checkpoint-resolved' }
    const cancelled: AiSkillCheckpoint = { ...skillCheckpoint('cancelled'), id: 'checkpoint-cancelled' }
    const state: AiPanelState = { ...createEmptyAiPanelState(), skillCheckpoints: [newer, resolved, older, cancelled] }
    expect(visibleCheckpoints(state).map((checkpoint) => checkpoint.id)).toEqual(['checkpoint-older', 'checkpoint-newer'])
  })

  test('empty when there are no checkpoints at all', () => {
    expect(visibleCheckpoints(createEmptyAiPanelState())).toEqual([])
  })
})

describe('dismissSkillCheckpoint', () => {
  test('moves a waiting checkpoint to cancelled, dropping it out of visibleCheckpoints and needsYouCount', () => {
    const state: AiPanelState = { ...createEmptyAiPanelState(), skillCheckpoints: [skillCheckpoint('waiting')] }
    expect(needsYouCount(state)).toBe(1)
    const next = dismissSkillCheckpoint(state, 'checkpoint-concept')
    expect(visibleCheckpoints(next)).toEqual([])
    expect(needsYouCount(next)).toBe(0)
    expect(next.skillCheckpoints[0]?.status).toBe('cancelled')
  })

  test('is a no-op (same state reference) for an unknown checkpoint id', () => {
    const state: AiPanelState = { ...createEmptyAiPanelState(), skillCheckpoints: [skillCheckpoint('waiting')] }
    expect(dismissSkillCheckpoint(state, 'checkpoint-does-not-exist')).toBe(state)
  })

  test('is a no-op for a checkpoint that is already resolved or cancelled', () => {
    const state: AiPanelState = { ...createEmptyAiPanelState(), skillCheckpoints: [skillCheckpoint('resolved')] }
    expect(dismissSkillCheckpoint(state, 'checkpoint-concept')).toBe(state)
  })
})

// ---------------------------------------------------------------------------
// threadsForNode
// ---------------------------------------------------------------------------

describe('threadsForNode', () => {
  test('filters threads anchored to the given node', () => {
    const anchored: AiThread = {
      id: 'thread-a',
      title: 'Tách nhánh concept Hanoi noir',
      createdAt: '2026-09-14T14:30:00.000Z',
      updatedAt: '2026-09-14T14:32:00.000Z',
      anchorNodeIds: ['idea-hanoi-noir'],
    }
    const unrelated: AiThread = {
      id: 'thread-b',
      title: 'Tìm ảnh mặt tiền phố cổ',
      createdAt: '2026-09-11T00:00:00.000Z',
      updatedAt: '2026-09-11T00:00:00.000Z',
      anchorNodeIds: [],
    }
    const state: AiPanelState = { ...createEmptyAiPanelState(), threads: [anchored, unrelated] }
    expect(threadsForNode(state, 'idea-hanoi-noir')).toEqual([anchored])
  })
})

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

describe('serialization', () => {
  test('round-trips through JSON without loss', () => {
    const original = s3State()
    const json = JSON.stringify(toSnapshot(original))
    const restored = fromSnapshot(JSON.parse(json))
    expect(restored.changeSets).toEqual(original.changeSets)
    expect(restored.threads).toEqual(original.threads)
    expect(restored.messages).toEqual(original.messages)
    expect(restored.runs).toEqual(original.runs)
    expect(restored.skillCheckpoints).toEqual(original.skillCheckpoints)
    expect(restored.provenance).toEqual(original.provenance)
  })

  test('round-trips provenance records', () => {
    const original: AiPanelState = {
      ...createEmptyAiPanelState(),
      provenance: {
        'idea:idea-brass-bar': { aiGenerated: true, runId: 'run-branches', threadId: 'thread-branches', editedAfterGeneration: false },
      },
    }
    const restored = fromSnapshot(JSON.parse(JSON.stringify(toSnapshot(original))))
    expect(restored.provenance).toEqual(original.provenance)
  })

  test('fromSnapshot never throws on garbage input', () => {
    const garbageInputs: unknown[] = [null, undefined, 42, 'not an object', [], true, { threads: 'not-an-array' }]
    for (const garbage of garbageInputs) {
      const result = fromSnapshot(garbage)
      expect(result.changeSets).toEqual([])
      expect(result.threads).toEqual([])
    }
  })

  test('drops unknown top-level fields', () => {
    const restored = fromSnapshot({ threads: [], messages: [], runs: [], changeSets: [], skillCheckpoints: [], provenance: {}, mysteryField: 'x' })
    expect((restored as unknown as Record<string, unknown>).mysteryField).toBe(undefined)
  })

  test('skips malformed changeset items but keeps the valid ones in the same changeset', () => {
    const raw = {
      threads: [],
      messages: [],
      runs: [],
      skillCheckpoints: [],
      provenance: {},
      changeSets: [
        {
          id: 'cs-mixed',
          runId: 'run-1',
          threadId: 'thread-1',
          title: 'Mixed',
          createdAt: '2026-09-14T00:00:00.000Z',
          items: [
            { kind: 'not-a-real-kind', id: 'bad-1' },
            { kind: 'edit-text', id: 'missing-fields' }, // missing required fields
            textItem('pending'),
          ],
        },
      ],
    }
    const restored = fromSnapshot(raw)
    expect(restored.changeSets).toHaveLength(1)
    expect(restored.changeSets[0]?.items).toHaveLength(1)
    expect(restored.changeSets[0]?.items[0]?.id).toBe('item-text-edit')
  })

  test('skips a malformed changeset entirely but keeps sibling changesets', () => {
    const raw = {
      threads: [],
      messages: [],
      runs: [],
      skillCheckpoints: [],
      provenance: {},
      changeSets: [{ id: 'cs-broken' /* missing runId/threadId/title/createdAt */ }, branchesChangeSet()],
    }
    const restored = fromSnapshot(raw)
    expect(restored.changeSets).toHaveLength(1)
    expect(restored.changeSets[0]?.id).toBe('cs-branches')
  })
})
