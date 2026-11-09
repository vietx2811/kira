// Pure decision logic for the merged Link/Expand handle (canvas-node-ux
// spec §2.1 decision 1a — React Flow's ButtonHandle / ComfyUI's
// drag-to-empty-canvas pattern): dragging the handle onto an existing node
// links to it; dragging onto empty canvas opens the create-linked-node menu
// at the drop point; dropping back onto the source node itself does
// nothing. Kept separate from the DOM hit-testing
// (`document.elementFromPoint`, main.tsx's finishDirectLink) so this
// decision is unit-testable without a real browser or pointer events.

export type LinkOrExpandNodeRef = { kind: string; id: string }

export type LinkOrExpandResult =
  | { type: 'link'; target: LinkOrExpandNodeRef }
  | { type: 'open-create-menu' }
  | { type: 'noop' }

export function decideLinkOrExpand(
  source: LinkOrExpandNodeRef,
  target: LinkOrExpandNodeRef | null,
): LinkOrExpandResult {
  if (!target) return { type: 'open-create-menu' }
  if (target.kind === source.kind && target.id === source.id) return { type: 'noop' }
  return { type: 'link', target }
}
