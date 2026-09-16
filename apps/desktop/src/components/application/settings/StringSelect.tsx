// Small wrapper around the Untitled UI `Select` for the common case in
// Settings: a flat list of {value,label} strings, controlled like a native
// `<select>` (value + onChange(string)) instead of react-aria's key-based
// selectedKey/onSelectionChange. Settings PHA 1 (2026-09-16) replaces every
// raw `<select>` in this screen with this (or the kit `Select` directly for
// richer cases) — see CLAUDE.md UI kit section and the PHA 1 brief.
import { Select } from '@/components/base/select/select'

export interface StringSelectOption {
  value: string
  label: string
}

export function StringSelect({
  'aria-label': ariaLabel,
  label,
  value,
  onChange,
  options,
  isDisabled,
  className,
  size,
}: {
  'aria-label'?: string
  label?: string
  value: string
  onChange: (value: string) => void
  options: StringSelectOption[]
  isDisabled?: boolean
  className?: string
  size?: 'sm' | 'md'
}) {
  return (
    <Select
      aria-label={ariaLabel}
      label={label}
      selectedKey={value}
      onSelectionChange={(key) => {
        if (key != null) onChange(String(key))
      }}
      items={options.map((option) => ({ id: option.value, label: option.label }))}
      isDisabled={isDisabled}
      className={className}
      size={size}
    >
      {(item) => (
        <Select.Item key={item.id} id={item.id}>
          {item.label}
        </Select.Item>
      )}
    </Select>
  )
}
