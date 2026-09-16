import { useEffect, useRef } from 'react'

// Shared focus trap for modal dialogs (Settings, confirm/alert dialogs). While `isOpen`:
// moves focus into the container's first focusable descendant (or the container itself,
// which needs tabIndex={-1} for this to work) as soon as it opens, keeps Tab/Shift+Tab
// cycling within the container instead of leaking to whatever sits underneath it, and
// restores focus to whatever was focused right before it opened (normally the trigger
// button) once it closes or unmounts. Esc-to-close stays owned by each dialog's own
// handler; this hook only concerns itself with focus.
//
// Extracted out of main.tsx (PHA 1 Untitled UI migration, 2026-09-16) — pure DOM/React
// hook with no dependency on app state, safe to share as-is.
export function useFocusTrap<T extends HTMLElement>(containerRef: React.RefObject<T | null>, isOpen: boolean) {
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!isOpen) return
    const container = containerRef.current
    if (!container) return

    previouslyFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null

    const focusableSelector =
      'a[href]:not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]):not([tabindex="-1"]), input:not([disabled]):not([tabindex="-1"]), select:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])'
    function getFocusable(): HTMLElement[] {
      return Array.from(container!.querySelectorAll<HTMLElement>(focusableSelector))
    }

    const initialTarget = getFocusable()[0] ?? container
    initialTarget.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Tab') return
      const items = getFocusable()
      if (items.length === 0) {
        event.preventDefault()
        container!.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (event.shiftKey) {
        if (active === first || !container!.contains(active)) {
          event.preventDefault()
          last.focus()
        }
      } else if (active === last || !container!.contains(active)) {
        event.preventDefault()
        first.focus()
      }
    }

    container.addEventListener('keydown', handleKeyDown)
    return () => {
      container.removeEventListener('keydown', handleKeyDown)
      const toRestore = previouslyFocusedRef.current
      previouslyFocusedRef.current = null
      if (toRestore && document.contains(toRestore)) toRestore.focus()
    }
  }, [isOpen, containerRef])
}
