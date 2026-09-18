import { useRef } from 'react'
import type React from 'react'
import {
  ArrowDownToLine,
  Box,
  FilePlus2,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Lightbulb,
  ListTree,
  Network,
  Save,
  Settings,
  SlidersHorizontal,
  Workflow,
} from 'lucide-react'
import { Segmented } from '@/components/Segmented'
import { Button } from '@/components/base/buttons/button'
import { Tooltip } from '@/components/base/tooltip/tooltip'
import { UiKitPortalHost } from '@/kira/uikit/PortalHost'

type WorkspaceView = 'Canvas' | '3D' | 'Slides' | 'Outline'
type LibraryPanelMode = 'images' | 'ideas' | 'links'

/**
 * Workspace chrome, PHA 4 Untitled UI migration (2026-09-17).
 *
 * The kit supplies the interaction primitives here: Button owns disabled,
 * keyboard, focus and pressed behavior, while Tooltip replaces the legacy
 * `title` attributes. The slim rail, the native-window drag region and the
 * canvas-relative placement deliberately stay local: Untitled UI does not
 * ship an app-navigation primitive in this checkout, and those constraints
 * are specific to KIRA's desktop canvas shell.
 */
export function WorkspaceChrome({
  activeView,
  isLibraryCollapsed,
  isProjectSettingsOpen,
  isSettingsOpen,
  isTauriRuntime,
  libraryPanelMode,
  saveLabel,
  setActiveView,
  viewLabels,
  onImportProject,
  onNewProject,
  onOpenProject,
  onOpenSettings,
  onSaveProject,
  onLibraryPanelModeChange,
  onToggleLibrary,
  onToggleProjectSettings,
  onWindowDrag,
  onWindowMaximize,
}: {
  activeView: WorkspaceView
  isLibraryCollapsed: boolean
  isProjectSettingsOpen: boolean
  isSettingsOpen: boolean
  isTauriRuntime: boolean
  libraryPanelMode: LibraryPanelMode
  saveLabel: string
  setActiveView: (view: WorkspaceView) => void
  viewLabels: Record<WorkspaceView, string>
  onImportProject: (file: File) => void
  onNewProject: () => void
  onOpenProject: () => void
  onOpenSettings: () => void
  onSaveProject: () => void
  onLibraryPanelModeChange: (mode: LibraryPanelMode) => void
  onToggleLibrary: () => void
  onToggleProjectSettings: () => void
  onWindowDrag: (event: React.PointerEvent<HTMLElement>) => void
  onWindowMaximize: (event: React.MouseEvent<HTMLElement>) => void
}) {
  const importInput = useRef<HTMLInputElement>(null)
  const views: { label: WorkspaceView; icon: typeof Network }[] = [
    { label: 'Canvas', icon: Network },
    { label: '3D', icon: Box },
    { label: 'Slides', icon: FileText },
    { label: 'Outline', icon: ListTree },
  ]
  const sources: { mode: LibraryPanelMode; label: string; icon: typeof ImageIcon }[] = [
    { mode: 'images', label: 'Images', icon: ImageIcon },
    { mode: 'ideas', label: 'Ideas', icon: Lightbulb },
    { mode: 'links', label: 'Links', icon: Workflow },
  ]

  return (
    <UiKitPortalHost className="kira-uikit workspace-chrome-uikit-host">
      <header
        className="topbar"
        data-tauri-drag-region
        onDoubleClick={onWindowMaximize}
        onPointerDown={onWindowDrag}
      >
        {/* This remains a radio picker rather than ARIA Tabs: Canvas/3D/
            Slides/Outline are mutually exclusive modes that unmount their
            content, not persistent panels. The kit has no equivalent radio
            segmented control, so KIRA's shared accessible one stays here. */}
        <Segmented
          className="content-view-switch"
          ariaLabel="View"
          variant="radio"
          value={activeView}
          onChange={setActiveView}
          options={views.map(({ label, icon: Icon }) => ({
            value: label,
            ariaLabel: viewLabels[label],
            tooltip: viewLabels[label],
            label: <Icon size={16} aria-hidden="true" />,
          }))}
        />

        <div className="content-toolbar-actions">
          <Tooltip title={isProjectSettingsOpen ? 'Close project settings' : 'Open project settings'} placement="bottom" delay={200}>
            <Button
              className={[
                'workspace-project-settings-button p-0!',
                isProjectSettingsOpen ? 'bg-primary_hover text-secondary' : '',
              ].filter(Boolean).join(' ')}
              color="tertiary"
              size="xs"
              iconLeading={SlidersHorizontal}
              aria-label={isProjectSettingsOpen ? 'Close project settings' : 'Open project settings'}
              aria-pressed={isProjectSettingsOpen}
              onPress={onToggleProjectSettings}
            />
          </Tooltip>
        </div>
      </header>

      <aside
        className="system-sidebar"
        data-tauri-drag-region
        aria-label="Workspace"
        onDoubleClick={onWindowMaximize}
        onPointerDown={onWindowDrag}
      >
        <div className="system-sidebar-top" data-tauri-drag-region>
          <div className="brand-mark sidebar-brand" data-tauri-drag-region>
            <img src="/kira-icon.png" alt="" />
          </div>
        </div>

        <div className="sidebar-source-group" aria-label="Content sources">
          {sources.map(({ mode, label, icon: Icon }) => {
            const selected = !isLibraryCollapsed && libraryPanelMode === mode
            return (
              <Tooltip key={mode} title={selected ? `Close ${label}` : `Open ${label}`} placement="right" delay={200}>
                <Button
                  className={[
                    'workspace-chrome-button p-0!',
                    selected ? 'is-selected bg-primary_hover text-secondary' : '',
                  ].filter(Boolean).join(' ')}
                  color="tertiary"
                  size="xs"
                  iconLeading={Icon}
                  aria-label={selected ? `Close ${label}` : `Open ${label}`}
                  aria-pressed={selected}
                  onPress={() => {
                    if (selected) {
                      onToggleLibrary()
                      return
                    }
                    onLibraryPanelModeChange(mode)
                    if (isLibraryCollapsed) onToggleLibrary()
                  }}
                />
              </Tooltip>
            )
          })}
        </div>

        <div className="sidebar-app-actions" aria-label="File actions">
          <Tooltip title="Import" placement="right" delay={200}>
            <Button
              className="workspace-file-button p-0!"
              color="tertiary"
              size="xs"
              iconLeading={ArrowDownToLine}
              aria-label="Import project"
              onPress={() => importInput.current?.click()}
            />
          </Tooltip>
          <input
            ref={importInput}
            aria-label="Import project file"
            className="file-input"
            accept="application/json"
            type="file"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) onImportProject(file)
              event.target.value = ''
            }}
          />
          <div className="workspace-file-actions" aria-label="File tools">
            {[
              { label: 'New', icon: FilePlus2, onPress: onNewProject, isDisabled: false },
              { label: 'Open', icon: FolderOpen, onPress: onOpenProject, isDisabled: !isTauriRuntime },
              { label: saveLabel, icon: Save, onPress: onSaveProject, isDisabled: false },
            ].map(({ label, icon, onPress, isDisabled }) => (
              <Tooltip key={label} title={label} placement="right" delay={200} isDisabled={isDisabled}>
                <Button
                  className="workspace-file-button p-0!"
                  color="tertiary"
                  size="xs"
                  iconLeading={icon}
                  aria-label={label}
                  isDisabled={isDisabled}
                  onPress={onPress}
                />
              </Tooltip>
            ))}
          </div>
          <Tooltip title="Settings" placement="right" delay={200}>
            <Button
              className={[
                'workspace-file-button workspace-settings-button p-0!',
                isSettingsOpen ? 'is-selected bg-primary_hover text-secondary' : '',
              ].filter(Boolean).join(' ')}
              color="tertiary"
              size="xs"
              iconLeading={Settings}
              aria-label="Open Settings"
              aria-pressed={isSettingsOpen}
              onPress={onOpenSettings}
            />
          </Tooltip>
        </div>
      </aside>
    </UiKitPortalHost>
  )
}
