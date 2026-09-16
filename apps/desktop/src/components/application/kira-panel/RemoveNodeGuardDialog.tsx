// Confirm-remove dialog for a Kira-created node edited by the user after
// apply — Untitled UI React conversion (PHA 3, 2026-09-16). Same pattern as
// DeleteProviderDialog.tsx (PHA 1): kit Modal + Dialog (react-aria-components)
// owns its own focus trap and Escape-to-close, so the bespoke `useFocusTrap`
// + manual `keydown` listener FileWorkspace used to run for this dialog in
// main.tsx are dropped when this component is wired in — see PHA 3 report.
//
// Unlike DeleteProviderDialog.tsx (which renders inside SettingsView's own
// `UiKitPortalHost`), this dialog is mounted as a top-level sibling in
// FileWorkspace's JSX with no kit ancestor — so it carries its own
// `UiKitPortalHost` here, otherwise its Modal would portal straight to
// `document.body` and miss the per-project accent + dark/light tokens
// (PortalHost.tsx, CLAUDE.md "phần tử portal ra document.body cũng không
// thấy token theme").
//
// Because this wrapper's only positioned ancestor at all is the viewport
// (this sibling sits directly under `.app-shell`, alongside `.workspace`),
// it needs `.uikit-passthrough-host`'s `display: contents` fix too (see that
// rule's comment in styles.css and KiraPanel.tsx's copy of the same note):
// `UiKitPortalHost`'s div is `position: static` with `isolation: isolate`,
// which traps this dialog's `fixed; z-index: 50` scrim+card inside its own
// stacking context instead of letting them compete with `.content-region`
// (the canvas) — and a static box always paints below a positioned sibling
// regardless of DOM order. Without the fix the dialog opens (React state
// flips) but renders fully behind the canvas: invisible and unclickable.
// Confirmed live in the browser preview by inserting a `position: fixed;
// z-index: 9999` test scrim into this exact wrapper div and reading
// `elementFromPoint` over the canvas — before the fix it hit the canvas's
// own `svg`, not the scrim.
import { Button } from '@/components/base/buttons/button'
import { Dialog, Modal, ModalOverlay } from '@/components/application/modals/modal'
import { UiKitPortalHost } from '@/kira/uikit/PortalHost'
import type { GraphNodeKind } from '@/kira/aiPanelTypes'

type TFn = (key: string, vars?: Record<string, string>) => string

export function RemoveNodeGuardDialog({
  guard,
  t,
  onCancel,
  onConfirm,
}: {
  guard: { nodeKind: GraphNodeKind; nodeId: string } | null
  t: TFn
  onCancel: () => void
  onConfirm: (nodeKind: GraphNodeKind, nodeId: string) => void
}) {
  return (
    <UiKitPortalHost className="kira-uikit uikit-passthrough-host">
      <ModalOverlay isOpen={guard != null} onOpenChange={(isOpen) => !isOpen && onCancel()} isDismissable>
        <Modal>
          <Dialog aria-label={t('kira.change.removeNode')} role="alertdialog">
            {guard && (
              <div className="flex flex-col gap-5 p-6">
                <div className="flex flex-col gap-1">
                  <h2 className="text-lg font-semibold text-primary">{t('kira.change.removeNode')}</h2>
                  <p className="text-sm text-tertiary">{t('kira.change.editedGuard')}</p>
                </div>
                <div className="flex justify-end gap-3">
                  <Button color="secondary" size="md" onPress={onCancel}>
                    {t('kira.change.editedGuardCancel')}
                  </Button>
                  <Button color="primary-destructive" size="md" onPress={() => onConfirm(guard.nodeKind, guard.nodeId)}>
                    {t('kira.change.editedGuardConfirm')}
                  </Button>
                </div>
              </div>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </UiKitPortalHost>
  )
}
