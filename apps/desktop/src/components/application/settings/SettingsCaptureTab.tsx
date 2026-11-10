import type { ComponentType } from 'react'
import { Clipboard, ExternalLink, LogIn, RotateCcw } from 'lucide-react'
import { Button } from '@/components/base/buttons/button'
import { Badge } from '@/components/base/badges/badges'
import { Tooltip } from '@/components/base/tooltip/tooltip'
import type { ExtensionInstallStatus } from '@/kira/ai/aiProviderDomain'
import { extensionInstallTargets, extensionStatusForTarget } from '@/kira/ai/aiProviderDomain'
import type { PinterestConnectionKnowledge } from '@/kira/pinterestConnection'
import { classifyPinterestConnectionStatus, formatConnectionLastSeen } from '@/kira/pinterestConnection'

export function SettingsCaptureTab({
  extensionInstallStatus,
  onExtensionAction,
  onExtensionRefresh,
  onCopyChromeDistPath,
  pinterestConnectionStatus,
  onOpenPinterestLogin,
  lang,
  T,
}: {
  extensionInstallStatus: ExtensionInstallStatus
  onExtensionAction: (targetId: string) => void
  onExtensionRefresh: () => void
  onCopyChromeDistPath: () => void | Promise<void>
  pinterestConnectionStatus: PinterestConnectionKnowledge | null
  onOpenPinterestLogin: () => void
  lang: 'en' | 'vi'
  T: ComponentType<{ k: string }>
}) {
  const connectionKind = classifyPinterestConnectionStatus(pinterestConnectionStatus)
  const connectionBadgeColor = connectionKind === 'logged_in' ? 'success' : connectionKind === 'logged_out' ? 'warning' : 'gray'
  const connectionStatusKey =
    connectionKind === 'logged_in'
      ? 'settings.connections.status.loggedIn'
      : connectionKind === 'logged_out'
        ? 'settings.connections.status.loggedOut'
        : 'settings.connections.status.unknown'
  const lastSeenLabel =
    pinterestConnectionStatus && connectionKind !== 'unknown'
      ? formatConnectionLastSeen(pinterestConnectionStatus.lastSeenAt, lang)
      : null
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4" aria-label="Connections">
        <article className="flex flex-col gap-1 border-b border-secondary pb-4">
          <h3 className="text-md font-semibold text-primary">
            <T k="settings.connections.title" />
          </h3>
          <p className="text-sm text-tertiary">
            <T k="settings.connections.description" />
          </p>
        </article>
        <div className="flex items-center justify-between gap-3 border-y border-secondary py-4" role="list">
          <div className="flex flex-col gap-1" role="listitem">
            <div className="flex items-center gap-2">
              <strong className="text-sm font-semibold text-primary">
                <T k="settings.connections.pinterest.name" />
              </strong>
              <Badge color={connectionBadgeColor} size="sm">
                <T k={connectionStatusKey} />
              </Badge>
            </div>
            <p className="text-sm text-tertiary">
              {lastSeenLabel ? (
                <>
                  <T k="settings.connections.lastSeen.prefix" /> {lastSeenLabel}
                </>
              ) : (
                <T k="settings.connections.lastSeen.unknown" />
              )}
            </p>
          </div>
          <Button color="secondary" size="sm" iconLeading={LogIn} onPress={onOpenPinterestLogin}>
            <T k="settings.connections.openLogin" />
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-4" aria-label="Extensions">
      <article className="flex items-start justify-between gap-4 border-b border-secondary pb-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-md font-semibold text-primary">Extensions</h3>
          <p className="text-sm text-tertiary">
            The fastest way material enters a project: drag an image off any page straight into a node, no upload step. Install the bundled helper into
            Chrome/Chromium or Safari to turn it on.
          </p>
        </div>
        <Tooltip title="Detect installed extensions">
          <Button color="tertiary" size="sm" iconLeading={RotateCcw} onPress={onExtensionRefresh} aria-label="Detect installed extensions" />
        </Tooltip>
      </article>

      <div className="flex flex-col gap-3" role="list">
        {extensionInstallTargets.map((target) => {
          const status = extensionStatusForTarget(extensionInstallStatus, target.id)
          const installed = status.installed && !status.disabled
          if (target.id === 'chrome') {
            return (
              <div className="flex flex-col gap-3 border-y border-secondary py-4" role="listitem" key={target.id}>
                <div className="flex items-center justify-between gap-3">
                  <strong className="text-sm font-semibold text-primary">{target.title}</strong>
                  <Badge color={installed ? 'success' : 'gray'} size="sm">
                    {installed ? 'Installed' : status.detail}
                  </Badge>
                </div>
                <details className="group">
                  <summary className="cursor-pointer text-sm font-medium text-brand-secondary">Install steps</summary>
                  <ol className="mt-3 flex flex-col gap-2.5 text-sm text-tertiary">
                    <li className="flex items-center justify-between gap-3">
                      <span>Copy the install folder path</span>
                      <Button color="secondary" size="sm" iconLeading={Clipboard} onPress={() => void onCopyChromeDistPath()}>
                        Copy path
                      </Button>
                    </li>
                    <li className="flex items-center justify-between gap-3">
                      <span>Open chrome://extensions</span>
                      <Tooltip title="Open chrome://extensions">
                        <Button
                          color="tertiary"
                          size="sm"
                          iconLeading={ExternalLink}
                          onPress={() => onExtensionAction(target.settingsActionId)}
                          aria-label="Open chrome://extensions"
                        />
                      </Tooltip>
                    </li>
                    <li>Turn on Developer mode (top right of that page)</li>
                    <li>Click &quot;Load unpacked&quot; and paste the copied path</li>
                  </ol>
                </details>
              </div>
            )
          }
          return (
            <div className="flex items-center justify-between gap-3 border-y border-secondary py-4" role="listitem" key={target.id}>
              <div className="flex flex-col gap-1">
                <strong className="text-sm font-semibold text-primary">{target.title}</strong>
                <Badge color={installed ? 'success' : 'gray'} size="sm" className="w-max">
                  {installed ? 'Installed' : status.detail}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button color="secondary" size="sm" onPress={() => onExtensionAction(target.installActionId)}>
                  {target.primary}
                </Button>
                <Tooltip title={target.secondary}>
                  <Button
                    color="tertiary"
                    size="sm"
                    iconLeading={ExternalLink}
                    onPress={() => onExtensionAction(target.settingsActionId)}
                    aria-label={target.secondary}
                  />
                </Tooltip>
              </div>
            </div>
          )
        })}
      </div>
      </section>
    </div>
  )
}
