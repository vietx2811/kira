// Opening a Mermaid diagram: pick a .mmd / .mermaid / Markdown file, or paste
// the text. Replaces a window.prompt that only ever worked in the browser:
// wry's WKUIDelegate implements the file panel but not the text-input panel,
// so in the macOS app prompt() returned null and the button did nothing.
//
// The file is read through a plain <input type="file">, which wry does wire to
// the native open panel, so the same code path runs in the app and the browser
// and no file-system permission is needed on the Rust side.
//
// Mounted as a top-level sibling like RemoveNodeGuardDialog, so it carries its
// own UiKitPortalHost and the passthrough fix; see that file for why.
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/base/buttons/button'
import { TextArea } from '@/components/base/textarea/textarea'
import { Dialog, Modal, ModalOverlay } from '@/components/application/modals/modal'
import { UiKitPortalHost } from '@/kira/uikit/PortalHost'
import { MERMAID_FILE_ACCEPT, extractMermaidSource } from '@/kira/mermaid/parseMermaid'

type TFn = (key: string, vars?: Record<string, string>) => string

export function MermaidImportDialog({
  isOpen,
  t,
  onClose,
  onImport,
}: {
  isOpen: boolean
  t: TFn
  onClose: () => void
  // Resolves to an error to show, or null once the diagram is on the canvas.
  onImport: (source: string, title: string) => Promise<string | null>
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const sourceRef = useRef<HTMLTextAreaElement>(null)
  // Code, not prose: no spellcheck, autocorrect or autocapitalize, so macOS
  // does not rewrite "--" or quotes while the diagram is typed. Pasted text
  // still gets undoSmartPunctuation in extractMermaidSource.
  useEffect(() => {
    const field = sourceRef.current
    if (!isOpen || !field) return
    field.spellcheck = false
    field.setAttribute('autocorrect', 'off')
    field.setAttribute('autocapitalize', 'off')
  }, [isOpen])
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [isImporting, setIsImporting] = useState(false)

  function reset() {
    setText('')
    setFileName('')
    setError('')
    setIsImporting(false)
  }

  function close() {
    reset()
    onClose()
  }

  async function readFile(file: File) {
    const content = await file.text()
    const extracted = extractMermaidSource(content, file.name)
    if (!extracted) {
      setError(t('mermaid.import.noDiagramInFile', { name: file.name }))
      return
    }
    setText(extracted.source)
    setFileName(file.name)
    setError('')
  }

  async function submit() {
    const extracted = extractMermaidSource(text, fileName || undefined)
    if (!extracted) {
      setError(t('mermaid.import.empty'))
      return
    }
    setIsImporting(true)
    const failure = await onImport(extracted.source, extracted.title)
    setIsImporting(false)
    if (failure) {
      setError(failure)
      return
    }
    close()
  }

  return (
    <UiKitPortalHost className="kira-uikit uikit-passthrough-host">
      <ModalOverlay isOpen={isOpen} onOpenChange={(open) => !open && close()} isDismissable>
        <Modal className="w-full max-w-xl">
          <Dialog aria-label={t('mermaid.import.title')} className="mermaid-import-dialog">
            <div className="flex w-full flex-col gap-5 p-6">
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold text-primary">{t('mermaid.import.title')}</h2>
                <p className="text-sm text-tertiary">{t('mermaid.import.description')}</p>
              </div>
              <div className="flex items-center gap-3">
                <Button color="secondary" size="sm" onPress={() => fileInputRef.current?.click()}>
                  {t('mermaid.import.chooseFile')}
                </Button>
                <span className="min-w-0 truncate text-sm text-tertiary">{fileName || t('mermaid.import.orPaste')}</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={MERMAID_FILE_ACCEPT}
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    // Clear it so choosing the same file again still fires onChange.
                    event.target.value = ''
                    if (file) void readFile(file)
                  }}
                />
              </div>
              <TextArea
                aria-label={t('mermaid.import.sourceLabel')}
                rows={10}
                size="sm"
                textAreaRef={sourceRef}
                textAreaClassName="mermaid-source-input"
                placeholder={'flowchart TD\n  A[Ý tưởng] --> B[Phác thảo]'}
                value={text}
                onChange={(value) => {
                  setText(value)
                  setError('')
                }}
                isInvalid={Boolean(error)}
                hint={error || undefined}
              />
              <div className="flex justify-end gap-3">
                <Button color="secondary" size="md" onPress={close}>
                  {t('mermaid.import.cancel')}
                </Button>
                <Button color="primary" size="md" isDisabled={!text.trim() || isImporting} onPress={() => void submit()}>
                  {t('mermaid.import.submit')}
                </Button>
              </div>
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </UiKitPortalHost>
  )
}
