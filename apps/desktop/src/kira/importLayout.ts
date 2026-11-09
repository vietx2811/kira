/**
 * Pure logic for the auto-layout "slot" a newly-imported/captured reference
 * node gets (its x/y grid position), split out of createReferenceFromCapture
 * in main.tsx so the bug below is unit-testable
 * (`bun test apps/desktop/src/kira`) without the app.
 *
 * Bug: the original inline formula was `Math.max(0, index - seedCount)`,
 * where `index` is the absolute position among all live images
 * (images.length + i within a batch) and `seedCount` is imagesSeed.length
 * (the hardcoded demo-data array, currently 6 — see main.tsx's
 * `imagesSeed`). On a board with fewer live images than the seed array
 * (e.g. an emptied board), `index` stays below `seedCount` for every item
 * in a batch, and `Math.max(0, negative)` collapses all of them to the
 * same slot 0 — three browser captures pasted in a row all landed on the
 * exact same x/y. Reported live: an empty board, three captures pasted
 * back to back, all three nodes at one coordinate.
 *
 * Fix: only apply the seed-count offset once `index` has actually passed
 * it (the normal case, where it behaves exactly as before — each new
 * import gets slot 0, 1, 2, ... past the seed). Below that point, use
 * `index` itself as the slot — since `index` is strictly increasing both
 * within one batch and across calls (images.length only grows), this
 * guarantees distinct slots instead of clamping to a shared 0. The only
 * change in output is on this previously-broken, below-seedCount path.
 */
export function resolveImportSlot(index: number, seedCount: number): number {
  return index >= seedCount ? index - seedCount : index
}
