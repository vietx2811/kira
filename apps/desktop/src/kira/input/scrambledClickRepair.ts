// Restores clicks that a system-wide input method turns inside out.
//
// Vietnamese input methods on macOS such as VietTelex work through an event
// tap: they watch keys and mouse clicks for the whole system, and on a click
// they reset their word buffer and post the mouse events again. In KIRA's
// WKWebView the first click after typing then arrives as a stray mouseup
// (detail 0, no mousedown before it) followed by a mousedown that never gets
// its mouseup, so no click event fires and the button does nothing; a second
// click works. Measured 2026-11-06 by logging pointer and mouse events in
// capture phase on the zero state's Draft board: no composition events at all,
// just that order. Every button right after a text field was affected.
//
// The repair is narrow: a pointerdown that lands on the same element within a
// few ms after an orphan pointerup is that inverted click, so it is completed
// with element.click(), and any late real click on that element is dropped so
// the action does not run twice. Ordinary clicks never produce an orphan up and
// are not touched. Installed in the macOS app only.

const INVERTED_CLICK_WINDOW_MS = 80
const LATE_CLICK_GUARD_MS = 600

export function installScrambledClickRepair(doc: Document = document) {
  let pointerIsDown = false
  let orphanUp: { target: EventTarget | null; at: number } | null = null
  let repaired: { target: Element; at: number } | null = null

  const clickable = (target: EventTarget | null) =>
    target instanceof Element ? target.closest('button, [role="button"], a[href], [role="option"], [role="menuitem"]') : null

  const onPointerUp = (event: PointerEvent) => {
    if (event.button !== 0) return
    if (!pointerIsDown) orphanUp = { target: event.target, at: performance.now() }
    pointerIsDown = false
  }

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return
    pointerIsDown = true
    const orphan = orphanUp
    orphanUp = null
    if (!orphan || performance.now() - orphan.at > INVERTED_CLICK_WINDOW_MS) return
    const element = clickable(event.target)
    if (!element || element !== clickable(orphan.target)) return
    if ((element as HTMLButtonElement).disabled || element.getAttribute('aria-disabled') === 'true') return
    // The mouseup for this down already happened (it was the orphan); there
    // is no button still held.
    pointerIsDown = false
    repaired = { target: element, at: performance.now() }
    // After this event finishes, so React handles the pointerdown first and
    // the element is focused the way a real click would leave it.
    window.setTimeout(() => (element as HTMLElement).click(), 0)
  }

  const onClick = (event: MouseEvent) => {
    if (!repaired) return
    const element = clickable(event.target)
    const isLate = performance.now() - repaired.at > 0 && event.isTrusted
    if (element === repaired.target && isLate && performance.now() - repaired.at < LATE_CLICK_GUARD_MS) {
      event.stopImmediatePropagation()
      event.preventDefault()
      repaired = null
    }
  }

  doc.addEventListener('pointerup', onPointerUp, true)
  doc.addEventListener('pointerdown', onPointerDown, true)
  doc.addEventListener('click', onClick, true)
  return () => {
    doc.removeEventListener('pointerup', onPointerUp, true)
    doc.removeEventListener('pointerdown', onPointerDown, true)
    doc.removeEventListener('click', onClick, true)
  }
}
