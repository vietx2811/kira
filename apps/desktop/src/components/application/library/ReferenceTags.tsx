import { useId, useLayoutEffect, useRef, useState } from 'react'
import type { EvidenceImage } from '@/main'

// Extracted out of main.tsx (PHA 2 Untitled UI migration, 2026-09-16) as part
// of the Library drawer split. `fitReferenceTagCount`/`positionReferenceTagPopover`
// are private layout helpers used only by this component. Not converted to a
// kit component: the native Popover API (`popover="auto"`) already gives
// correct top-layer stacking + light-dismiss for free, and the kit's
// Dropdown is built around react-aria's Menu semantics (single-select action
// list), which doesn't fit a strip of independently-clickable tag filters.

function fitReferenceTagCount(
  availableWidth: number,
  tagWidths: number[],
  moreWidths: Map<number, number>,
  gap: number,
): number {
  const totalTagWidth = tagWidths.reduce((total, width) => total + width, 0) + gap * Math.max(0, tagWidths.length - 1)
  if (totalTagWidth <= availableWidth) return tagWidths.length

  let bestFit = 0
  let visibleWidth = 0
  for (let visibleCount = 0; visibleCount < tagWidths.length; visibleCount += 1) {
    if (visibleCount > 0) visibleWidth += gap
    visibleWidth += tagWidths[visibleCount] ?? 0
    const hiddenCount = tagWidths.length - visibleCount - 1
    if (hiddenCount <= 0) break
    const moreWidth = moreWidths.get(hiddenCount) ?? 0
    if (visibleWidth + gap + moreWidth <= availableWidth) bestFit = visibleCount + 1
  }
  return bestFit
}

// Exported (not just used locally): `ProjectDiagnostics` in main.tsx reuses
// this exact positioning routine for its own "+N" overflow popover (outline
// diagnostics chips) — same top-layer `popover="auto"` + clamp-to-viewport
// pattern, no library-specific logic, so it stays a plain shared export
// rather than being duplicated.
export function positionReferenceTagPopover(trigger: HTMLElement, popover: HTMLElement) {
  const viewportPadding = 8
  const popoverGap = 6
  const triggerRect = trigger.getBoundingClientRect()

  // Give the top-layer popover a stable first position before it opens. A
  // second call from `onToggle` sees its real dimensions and clamps it to the
  // viewport, including flipping above the chip near the bottom edge.
  popover.style.left = `${Math.max(viewportPadding, triggerRect.left)}px`
  popover.style.top = `${triggerRect.bottom + popoverGap}px`
  const popoverRect = popover.getBoundingClientRect()
  if (popoverRect.width === 0 || popoverRect.height === 0) return

  const left = Math.min(
    Math.max(viewportPadding, triggerRect.left),
    Math.max(viewportPadding, window.innerWidth - popoverRect.width - viewportPadding),
  )
  const spaceBelow = window.innerHeight - triggerRect.bottom - popoverGap - viewportPadding
  const top = spaceBelow >= popoverRect.height
    ? triggerRect.bottom + popoverGap
    : Math.max(viewportPadding, triggerRect.top - popoverRect.height - popoverGap)
  popover.style.left = `${left}px`
  popover.style.top = `${top}px`
}

export function ReferenceTags({
  image,
  selectedTag,
  t,
  onTagClick,
}: {
  image: EvidenceImage
  selectedTag: string | null
  t: (key: string, vars?: Record<string, string>) => string
  onTagClick: (tag: string) => void
}) {
  const stripRef = useRef<HTMLSpanElement>(null)
  const moreTriggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const popoverId = useId()
  const [visibleTagCount, setVisibleTagCount] = useState(image.tags.length)
  const [isPopoverOpen, setIsPopoverOpen] = useState(false)
  const visibleTags = image.tags.slice(0, visibleTagCount)
  const hiddenTags = image.tags.slice(visibleTagCount)

  useLayoutEffect(() => {
    const strip = stripRef.current
    if (!strip) return

    function updateVisibleTagCount() {
      if (!strip) return
      const tagWidths = [...strip.querySelectorAll<HTMLElement>('[data-tag-measure]')]
        .map((element) => element.getBoundingClientRect().width)
      const moreWidths = new Map(
        [...strip.querySelectorAll<HTMLElement>('[data-more-measure]')]
          .map((element) => [Number(element.dataset.moreMeasure), element.getBoundingClientRect().width]),
      )
      const gap = Number.parseFloat(getComputedStyle(strip).columnGap) || 0
      const nextCount = fitReferenceTagCount(strip.clientWidth, tagWidths, moreWidths, gap)
      setVisibleTagCount((currentCount) => currentCount === nextCount ? currentCount : nextCount)
    }

    updateVisibleTagCount()
    const observer = new ResizeObserver(updateVisibleTagCount)
    observer.observe(strip)
    return () => observer.disconnect()
  }, [image.tags])

  return (
    <span
      ref={stripRef}
      className="mini-tags"
      role="group"
      aria-label={t('library.tags.label', { title: image.title })}
    >
      {visibleTags.map((tag, index) => (
        <button
          key={`${tag}-${index}`}
          className={selectedTag === tag ? 'mini-tag-chip is-active' : 'mini-tag-chip'}
          type="button"
          title={tag}
          aria-pressed={selectedTag === tag}
          onClick={() => onTagClick(tag)}
        >
          {tag}
        </button>
      ))}
      {hiddenTags.length > 0 && (
        <>
          <button
            ref={moreTriggerRef}
            className="mini-tags-more"
            type="button"
            aria-expanded={isPopoverOpen}
            aria-label={t('library.tags.more', { count: String(hiddenTags.length) })}
            popoverTarget={popoverId}
          >
            +{hiddenTags.length}
          </button>
          <div
            ref={popoverRef}
            id={popoverId}
            className="mini-tags-popover"
            popover="auto"
            aria-label={t('library.tags.more', { count: String(hiddenTags.length) })}
            onBeforeToggle={(event) => {
              if (event.newState !== 'open' || !moreTriggerRef.current) return
              positionReferenceTagPopover(moreTriggerRef.current, event.currentTarget)
            }}
            onToggle={(event) => {
              const isOpen = event.newState === 'open'
              setIsPopoverOpen(isOpen)
              if (isOpen && moreTriggerRef.current) {
                positionReferenceTagPopover(moreTriggerRef.current, event.currentTarget)
              }
            }}
          >
            <strong>{t('library.tags.more', { count: String(hiddenTags.length) })}</strong>
            <span className="mini-tags-popover-list">
              {hiddenTags.map((tag, index) => (
                <button
                  key={`${tag}-${index}`}
                  className={selectedTag === tag ? 'mini-tag-chip is-active' : 'mini-tag-chip'}
                  type="button"
                  title={tag}
                  aria-pressed={selectedTag === tag}
                  onClick={() => {
                    popoverRef.current?.hidePopover()
                    onTagClick(tag)
                  }}
                >
                  {tag}
                </button>
              ))}
            </span>
          </div>
        </>
      )}
      <span className="mini-tags-measure" aria-hidden="true">
        {image.tags.map((tag, index) => (
          <span key={`tag-${tag}-${index}`} className="mini-tag-chip" data-tag-measure>{tag}</span>
        ))}
        {image.tags.map((_, index) => {
          const hiddenCount = image.tags.length - index
          return <span key={`more-${hiddenCount}`} className="mini-tags-more" data-more-measure={hiddenCount}>+{hiddenCount}</span>
        })}
      </span>
    </span>
  )
}
