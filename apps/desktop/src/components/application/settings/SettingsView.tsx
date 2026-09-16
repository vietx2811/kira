import type { ComponentType } from 'react'
import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { Tab, TabList, TabPanel, Tabs } from '@/components/application/tabs/tabs'
import { Button } from '@/components/base/buttons/button'
import { Badge } from '@/components/base/badges/badges'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { UiKitPortalHost } from '@/kira/uikit/PortalHost'
import type {
  AiProviderProfile,
  AiProviderType,
  AiRoutingMode,
  AiTaskKind,
  AiTaskRoute,
  ExtensionInstallStatus,
} from '@/kira/ai/aiProviderDomain'
import { SettingsGeneralTab } from './SettingsGeneralTab'
import { SettingsCaptureTab } from './SettingsCaptureTab'
import { SettingsAiProvidersTab } from './SettingsAiProvidersTab'
import { SettingsAdvancedTab } from './SettingsAdvancedTab'

type SettingsTabId = 'general' | 'capture' | 'ai' | 'advanced'

const settingsSections: { id: SettingsTabId; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'capture', label: 'Capture' },
  { id: 'ai', label: 'AI Providers' },
  { id: 'advanced', label: 'Advanced' },
]

// aiSettingsStatus is a free-text line shared by secret save/delete, provider
// test, and model-list calls — this keyword sniff is how the status pill
// tells a failure apart from a routine result without each call site having
// to also thread a separate ok/error flag through.
function isLikelySettingsError(status: string): boolean {
  return /fail|error|not signed in/i.test(status)
}

/**
 * Settings dialog — General / Capture / AI Providers / Advanced. Untitled UI
 * React conversion (PHA 1, 2026-09-16): extracted out of main.tsx (was
 * `function SettingsView` inline, ~8600-9300), every raw `<select>`/checkbox/
 * button in scope replaced with the kit's Select/Checkbox/Button/Badge/
 * Tooltip, and the section nav rebuilt on the kit's `Tabs` (vertical, real
 * ARIA tabs instead of `aria-pressed` buttons).
 *
 * Wrapped in `.kira-uikit` (scoped Tailwind preflight reset, see
 * styles/uikit/globals.css) + `UiKitPortalHost` (keeps React Aria's
 * Select/Modal/Tooltip portals inside `.app-shell` so they still see the
 * per-project accent + dark/light token — see PortalHost.tsx) so this is the
 * only part of the app affected; Library/canvas/dock are untouched this
 * phase.
 *
 * The outer shell keeps `useFocusTrap` + its own Escape handler exactly as
 * before (still a plain overlay `<section>`, not a kit Modal — converting
 * the outer dialog chrome was out of scope this phase). Only the delete-
 * provider confirm dialog moved to kit `Modal`/`Dialog`
 * (DeleteProviderDialog.tsx): React Aria's Modal owns its own focus trap and
 * Escape-to-close, so `useFocusTrap` is NOT called for that dialog anymore.
 */
export function SettingsView({
  providers,
  taskRoutes,
  routingMode,
  selectedProviderId,
  activeProviderId,
  focusNonce,
  localModelAvailable,
  localModelStatus,
  extensionInstallStatus,
  status,
  lang,
  setLang,
  railIconMode,
  setRailIconMode,
  T,
  onActiveProviderChange,
  onProviderAdd,
  onProviderChange,
  onProviderDelete,
  onProviderSecretSave,
  onProviderSecretDelete,
  onProviderTest,
  onProviderModelsList,
  onProviderTaskToggle,
  onRoutingModeChange,
  onSelectedProviderChange,
  onOnboardingReset,
  onWelcomeOpen,
  onExtensionAction,
  onExtensionRefresh,
  onCopyChromeDistPath,
  onClose,
}: {
  providers: AiProviderProfile[]
  taskRoutes: AiTaskRoute[]
  routingMode: AiRoutingMode
  selectedProviderId: string
  activeProviderId: string
  focusNonce: number
  localModelAvailable: boolean
  localModelStatus: string
  extensionInstallStatus: ExtensionInstallStatus
  status: string
  lang: 'en' | 'vi'
  setLang: (lang: 'en' | 'vi') => void
  railIconMode: 'color' | 'mono'
  setRailIconMode: (mode: 'color' | 'mono') => void
  T: ComponentType<{ k: string }>
  onActiveProviderChange: (providerId: string) => void
  onProviderAdd: (type: Exclude<AiProviderType, 'apple_foundation'>) => void
  onProviderChange: (providerId: string, patch: Partial<Pick<AiProviderProfile, 'name' | 'baseUrl' | 'model' | 'authMode'>>) => void
  onProviderDelete: (providerId: string) => void
  onProviderSecretSave: (providerId: string, secret: string) => void
  onProviderSecretDelete: (providerId: string) => void
  onProviderTest: (providerId: string) => void | Promise<void>
  onProviderModelsList: (providerId: string) => void | Promise<void>
  onProviderTaskToggle: (providerId: string, task: AiTaskKind) => void
  onRoutingModeChange: (mode: AiRoutingMode) => void
  onSelectedProviderChange: (providerId: string) => void
  onOnboardingReset: () => void
  onWelcomeOpen: () => void
  onExtensionAction: (targetId: string) => void
  onExtensionRefresh: () => void
  onCopyChromeDistPath: () => void | Promise<void>
  onClose: () => void
}) {
  const settingsShellRef = useRef<HTMLElement>(null)
  // SettingsView only exists in the tree while the dialog is open (the parent conditionally
  // mounts it), so the trap is simply "always on" from this component's own perspective —
  // its cleanup runs on unmount, i.e. exactly when the dialog closes.
  useFocusTrap(settingsShellRef, true)

  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTabId>('general')
  // When a provider is focused from elsewhere (onboarding, logged-out prompt), jump to the AI tab.
  useEffect(() => {
    if (focusNonce > 0) setActiveSettingsTab('ai')
  }, [focusNonce])

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [onClose])

  const remoteProviders = providers.filter((provider) => provider.authMode !== 'local')
  const connectedProviderCount = providers.filter((provider) => provider.status === 'connected').length
  const storedSecretCount = providers.filter((provider) => provider.secretRef).length
  const billingSeparatedCount = remoteProviders.filter((provider) => provider.status === 'billing_separate').length

  return (
    <UiKitPortalHost className="kira-uikit">
      <section
          ref={settingsShellRef}
          tabIndex={-1}
          aria-label="Settings"
          aria-modal="true"
          role="dialog"
          className="flex h-[min(720px,calc(100vh-64px))] w-[min(980px,100%)] min-h-0 min-w-0 overflow-hidden rounded-2xl border border-secondary bg-primary shadow-xl"
        >
          <Tabs
            selectedKey={activeSettingsTab}
            onSelectionChange={(key) => setActiveSettingsTab(key as SettingsTabId)}
            orientation="vertical"
            style={{ display: 'contents' }}
          >
            <TabList
              orientation="vertical"
              type="line"
              aria-label="Settings sections"
              className="w-44 shrink-0 gap-0.5 overflow-y-auto border-r border-secondary p-2"
            >
              {settingsSections.map((section) => (
                <Tab key={section.id} id={section.id} label={section.label} className="w-full justify-start" />
              ))}
            </TabList>

            <div className="min-w-0 flex-1 overflow-y-auto p-4">
              <div className="mb-4 flex items-start justify-between gap-4">
                <h2 className="text-lg font-semibold text-primary">{settingsSections.find((section) => section.id === activeSettingsTab)?.label}</h2>
                <div className="flex items-center gap-2">
                  <Badge color={isLikelySettingsError(status) ? 'error' : 'gray'} size="sm" className="max-w-70 truncate">
                    {status}
                  </Badge>
                  <Button color="tertiary" size="sm" iconLeading={X} onPress={onClose} aria-label="Close settings" />
                </div>
              </div>

              <TabPanel id="general">
                <SettingsGeneralTab
                  routingMode={routingMode}
                  onRoutingModeChange={onRoutingModeChange}
                  remoteProviders={remoteProviders}
                  selectedProviderId={selectedProviderId}
                  onSelectedProviderChange={onSelectedProviderChange}
                  connectedProviderCount={connectedProviderCount}
                  totalProviderCount={providers.length}
                  localModelAvailable={localModelAvailable}
                  localModelStatus={localModelStatus}
                  lang={lang}
                  setLang={setLang}
                  railIconMode={railIconMode}
                  setRailIconMode={setRailIconMode}
                  T={T}
                />
              </TabPanel>

              <TabPanel id="capture">
                <SettingsCaptureTab
                  extensionInstallStatus={extensionInstallStatus}
                  onExtensionAction={onExtensionAction}
                  onExtensionRefresh={onExtensionRefresh}
                  onCopyChromeDistPath={onCopyChromeDistPath}
                />
              </TabPanel>

              <TabPanel id="ai">
                <SettingsAiProvidersTab
                  providers={providers}
                  activeProviderId={activeProviderId}
                  onActiveProviderChange={onActiveProviderChange}
                  onProviderAdd={onProviderAdd}
                  onProviderChange={onProviderChange}
                  onProviderDelete={onProviderDelete}
                  onProviderSecretSave={onProviderSecretSave}
                  onProviderSecretDelete={onProviderSecretDelete}
                  onProviderTest={onProviderTest}
                  onProviderModelsList={onProviderModelsList}
                  onProviderTaskToggle={onProviderTaskToggle}
                />
              </TabPanel>

              <TabPanel id="advanced">
                <SettingsAdvancedTab
                  taskRoutes={taskRoutes}
                  storedSecretCount={storedSecretCount}
                  remoteProviderCount={remoteProviders.length}
                  billingSeparatedCount={billingSeparatedCount}
                  onWelcomeOpen={onWelcomeOpen}
                  onOnboardingReset={onOnboardingReset}
                />
              </TabPanel>
            </div>
          </Tabs>
      </section>
    </UiKitPortalHost>
  )
}
