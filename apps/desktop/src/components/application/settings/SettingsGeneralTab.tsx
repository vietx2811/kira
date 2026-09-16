import type { ComponentType } from 'react'
import { Segmented } from '@/components/Segmented'
import { Badge } from '@/components/base/badges/badges'
import { StringSelect } from './StringSelect'
import type { AiProviderProfile, AiRoutingMode } from '@/kira/ai/aiProviderDomain'
import { aiRoutingLabels } from '@/kira/ai/aiProviderDomain'

export function SettingsGeneralTab({
  routingMode,
  onRoutingModeChange,
  remoteProviders,
  selectedProviderId,
  onSelectedProviderChange,
  connectedProviderCount,
  totalProviderCount,
  localModelAvailable,
  localModelStatus,
  lang,
  setLang,
  railIconMode,
  setRailIconMode,
  T,
}: {
  routingMode: AiRoutingMode
  onRoutingModeChange: (mode: AiRoutingMode) => void
  remoteProviders: AiProviderProfile[]
  selectedProviderId: string
  onSelectedProviderChange: (providerId: string) => void
  connectedProviderCount: number
  totalProviderCount: number
  localModelAvailable: boolean
  localModelStatus: string
  lang: 'en' | 'vi'
  setLang: (lang: 'en' | 'vi') => void
  railIconMode: 'color' | 'mono'
  setRailIconMode: (mode: 'color' | 'mono') => void
  T: ComponentType<{ k: string }>
}) {
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-wrap items-end gap-3 border-b border-secondary pb-5" aria-label="AI defaults">
        <StringSelect
          aria-label="Routing"
          label="Routing"
          value={routingMode}
          onChange={(value) => onRoutingModeChange(value as AiRoutingMode)}
          options={Object.keys(aiRoutingLabels).map((mode) => ({ value: mode, label: aiRoutingLabels[mode as AiRoutingMode] }))}
          className="min-w-40"
          size="sm"
        />
        <StringSelect
          aria-label="Remote"
          label="Remote"
          value={selectedProviderId}
          onChange={onSelectedProviderChange}
          options={remoteProviders.map((provider) => ({ value: provider.id, label: provider.name }))}
          isDisabled={remoteProviders.length === 0}
          className="min-w-40"
          size="sm"
        />
        <div className="ml-auto flex items-center gap-2">
          <Badge color="gray" size="md">
            Providers {connectedProviderCount}/{totalProviderCount}
          </Badge>
          <Badge color={localModelAvailable ? 'success' : 'gray'} size="md">
            Local {localModelAvailable ? 'available' : 'unavailable'}
          </Badge>
        </div>
      </section>

      <section className="flex flex-col gap-2" aria-label="Language">
        <h3 className="text-md font-semibold text-primary">
          <T k="lang.label" />
        </h3>
        <p className="text-sm text-tertiary">
          <T k="lang.hint" />
        </p>
        <Segmented
          ariaLabel="Language"
          variant="radio"
          value={lang}
          onChange={setLang}
          options={[
            { value: 'en', label: 'English' },
            { value: 'vi', label: 'Tiếng Việt' },
          ]}
        />
      </section>

      <section className="flex flex-col gap-2" aria-label="Rail icons">
        <h3 className="text-md font-semibold text-primary">Rail icons</h3>
        <p className="text-sm text-tertiary">Color identifies each tool by node kind. Monochrome keeps the same drawings in a single ink tone.</p>
        <Segmented
          ariaLabel="Rail icons"
          variant="radio"
          value={railIconMode}
          onChange={setRailIconMode}
          options={[
            { value: 'color', label: 'Color' },
            { value: 'mono', label: 'Monochrome' },
          ]}
        />
      </section>

      <section className="flex flex-col gap-2" aria-label="Local model">
        <h3 className="text-md font-semibold text-primary">Local</h3>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-tertiary">Apple Foundation Models</dt>
          <dd className="text-primary">{localModelAvailable ? 'available' : 'unavailable'}</dd>
          <dt className="text-tertiary">Status</dt>
          <dd className="text-primary">{localModelStatus}</dd>
          <dt className="text-tertiary">Default use</dt>
          <dd className="text-primary">Tagging, classification</dd>
        </dl>
      </section>
    </div>
  )
}
