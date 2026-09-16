// Confirm-delete dialog for an AI provider profile. Untitled UI Modal +
// Dialog (react-aria-components) replaces the hand-rolled `.confirm-dialog`
// section — the kit's Modal owns focus trap + Escape-to-close itself, so the
// bespoke `useFocusTrap` call this dialog used to get from SettingsView is
// dropped here (see PHA 1 report: "kit dùng React Aria — nếu Modal của kit
// tự lo focus trap thì bỏ useFocusTrap cho riêng dialog này").
import { Button } from '@/components/base/buttons/button'
import { Dialog, Modal, ModalOverlay } from '@/components/application/modals/modal'
import type { AiProviderProfile } from '@/kira/ai/aiProviderDomain'

export function DeleteProviderDialog({
  provider,
  onCancel,
  onConfirm,
}: {
  provider: AiProviderProfile | null
  onCancel: () => void
  onConfirm: (providerId: string) => void
}) {
  return (
    <ModalOverlay isOpen={provider != null} onOpenChange={(isOpen) => !isOpen && onCancel()} isDismissable>
      <Modal>
        <Dialog aria-label={provider ? `Delete ${provider.name}?` : 'Delete provider'} role="alertdialog">
          {provider && (
            <div className="flex flex-col gap-5 p-6">
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold text-primary">Delete {provider.name}?</h2>
                <p className="text-sm text-tertiary">This removes the profile and its stored API key from the macOS Keychain. This can't be undone.</p>
              </div>
              <div className="flex justify-end gap-3">
                <Button color="secondary" size="md" onPress={onCancel}>
                  Cancel
                </Button>
                <Button
                  color="primary-destructive"
                  size="md"
                  onPress={() => onConfirm(provider.id)}
                >
                  Delete profile
                </Button>
              </div>
            </div>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  )
}
