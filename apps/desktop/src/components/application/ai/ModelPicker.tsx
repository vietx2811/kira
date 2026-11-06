// The one model picker every AI surface uses (topbar, Kira dock, the zero
// state's composer, Settings). It lists models, each led by a small tag for
// the provider it runs on, never providers; see kira/ai/modelCatalog.ts.
//
// The trigger is compact on purpose: it sits in a toolbar or a composer bar,
// where the kit Select's full form-field trigger would be too heavy. The list
// itself is the kit's Popover and SelectItem, so it looks like every other
// kit menu. With nothing connected it is a single "connect" action instead
// of an empty menu.
import { ChevronDown } from 'lucide-react'
import { Button as AriaButton, ListBox as AriaListBox, Select as AriaSelect } from 'react-aria-components'
import { Popover } from '@/components/base/select/popover'
import { SelectItem } from '@/components/base/select/select-item'
import { SelectContext } from '@/components/base/select/select-shared'
import { UiKitPortalHost } from '@/kira/uikit/PortalHost'
import { modelKey, providerMark, type AiModelOption, type AiModelRef } from '@/kira/ai/modelCatalog'
import { providerMarkPaths } from '@/kira/ai/providerMarks'
import type { AiProviderType } from '@/kira/ai/aiProviderDomain'

const CONNECT_KEY = '__connect__'

// Provider tag: the provider's mark (when it has one) and its short name.
// Both, because two services can share a mark (Anthropic API and Claude Code).
export function ModelTag({ type, tag }: { type: AiProviderType; tag: string }) {
  const mark = providerMark(type)
  return (
    <span className="model-tag">
      {mark && (
        <svg className="model-tag-mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d={providerMarkPaths[mark]} fill="currentColor" />
        </svg>
      )}
      {tag}
    </span>
  )
}

export function ModelPicker({
  options,
  value,
  onChange,
  onConnect,
  labels,
  className,
  placement = 'bottom end',
}: {
  options: AiModelOption[]
  // The model in effect, already resolved (a feature choice or the default).
  value: AiModelRef | null
  onChange: (ref: AiModelRef) => void
  onConnect: () => void
  labels: { pick: string; notConnected: string; connectMore: string }
  className?: string
  placement?: 'bottom end' | 'bottom start' | 'top end' | 'top start'
}) {
  const selectedKey = value ? modelKey(value) : null
  const selected = options.find((option) => option.key === selectedKey) ?? null

  if (options.length === 0) {
    return (
      <button type="button" className={['model-picker-trigger is-empty', className].filter(Boolean).join(' ')} onClick={onConnect}>
        <span className="model-picker-dot" aria-hidden="true" />
        <span className="model-picker-label">{labels.notConnected}</span>
      </button>
    )
  }

  return (
    <UiKitPortalHost className="kira-uikit uikit-passthrough-host">
      <AriaSelect
        aria-label={labels.pick}
        selectedKey={selectedKey}
        onSelectionChange={(key) => {
          if (key === CONNECT_KEY) {
            onConnect()
            return
          }
          const option = options.find((candidate) => candidate.key === key)
          if (option) onChange({ providerId: option.providerId, model: option.model })
        }}
      >
        <AriaButton className={['model-picker-trigger', className].filter(Boolean).join(' ')}>
          <span className="model-picker-dot is-ready" aria-hidden="true" />
          {selected && <ModelTag type={selected.providerType} tag={selected.providerTag} />}
          <span className="model-picker-label">{selected ? selected.label : labels.pick}</span>
          <ChevronDown size={12} aria-hidden="true" className="model-picker-chevron" />
        </AriaButton>
        <SelectContext.Provider value={{ size: 'sm' }}>
          <Popover size="sm" placement={placement} className="w-72!">
            <AriaListBox className="outline-hidden">
              {options.map((option) => (
                <SelectItem key={option.key} id={option.key} label={option.label} icon={<ModelTag type={option.providerType} tag={option.providerTag} />} />
              ))}
              <SelectItem id={CONNECT_KEY} label={labels.connectMore} selectionIndicator="none" className="model-picker-connect" />
            </AriaListBox>
          </Popover>
        </SelectContext.Provider>
      </AriaSelect>
    </UiKitPortalHost>
  )
}
