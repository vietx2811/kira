import { useRef } from 'react'
import type React from 'react'

export type SegmentedOption<T extends string> = { value: T; label: React.ReactNode; ariaLabel?: string; title?: string; tooltip?: string }

/**
 * One shared segmented control for every "pick one of N" picker in the app —
 * replaces nine hand-rolled variants (view tabs, List/Grid, density, Edit/
 * Discover, outline filter, 3D scope, the language toggle, settings nav) that
 * each reinvented radius, active fill, and transitions differently, and none
 * of which animated the selection. `variant="tabs"` renders a real
 * `role="tablist"`/`role="tab"` group (mutually exclusive *views*);
 * `variant="radio"` renders `role="radiogroup"`/`role="radio"` (mutually
 * exclusive *settings*) — the app previously used `aria-pressed` toggle-button
 * semantics for both, which announces "pressed/not pressed" instead of
 * "2 of 4, selected".
 *
 * Extracted out of main.tsx (PHA 1 Untitled UI migration, 2026-09-16) — pure
 * presentational component, no dependency on app state.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  variant = 'tabs',
  className,
}: {
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel: string
  variant?: 'tabs' | 'radio'
  className?: string
}): React.ReactElement {
  const groupRole = variant === 'tabs' ? 'tablist' : 'radiogroup'
  const itemRole = variant === 'tabs' ? 'tab' : 'radio'
  const activeIndex = Math.max(0, options.findIndex((option) => option.value === value))
  const rootRef = useRef<HTMLDivElement | null>(null)

  function focusOption(index: number) {
    const buttons = rootRef.current?.querySelectorAll<HTMLButtonElement>('.segmented-option')
    buttons?.[index]?.focus()
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    // radiogroup also expects vertical arrows to move the selection, per the
    // WAI-ARIA radio-group pattern; Home/End are the expected shortcuts for
    // both variants to jump to the first/last option.
    let nextIndex: number
    if (event.key === 'ArrowRight' || (variant === 'radio' && event.key === 'ArrowDown')) {
      nextIndex = (activeIndex + 1) % options.length
    } else if (event.key === 'ArrowLeft' || (variant === 'radio' && event.key === 'ArrowUp')) {
      nextIndex = (activeIndex - 1 + options.length) % options.length
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = options.length - 1
    } else {
      return
    }
    event.preventDefault()
    onChange(options[nextIndex].value)
    focusOption(nextIndex)
  }

  return (
    <div
      ref={rootRef}
      className={className ? `segmented ${className}` : 'segmented'}
      role={groupRole}
      aria-label={ariaLabel}
      style={{ '--seg-count': options.length, '--seg-index': activeIndex } as React.CSSProperties}
      onKeyDown={handleKeyDown}
    >
      <span className="segmented-thumb" aria-hidden="true" />
      {options.map((option, index) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role={itemRole}
            className={selected ? 'segmented-option is-active' : 'segmented-option'}
            aria-label={option.ariaLabel}
            title={option.title}
            data-tooltip={option.tooltip}
            aria-selected={variant === 'tabs' ? selected : undefined}
            aria-checked={variant === 'radio' ? selected : undefined}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
