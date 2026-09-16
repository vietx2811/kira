import type { CSSProperties } from 'react'
import type { EvidenceImage, Lang } from '@/main'
import { ReferenceThumb } from '@/components/ReferenceThumb'
import { Checkbox } from '@/components/base/checkbox/checkbox'
import { ReferenceTags } from './ReferenceTags'

// A row's second line falls back through source -> dimensions -> relative
// added-time so every row keeps the same two-line rhythm; without a
// guaranteed fallback, rows for locally-imported or untagged images render
// with a blank second line and break the list's scan rhythm.
function formatReferenceDetail(image: EvidenceImage, lang: Lang, t: (key: string, vars?: Record<string, string>) => string): string {
  if (image.source) return image.source
  if (image.width && image.height) return `${image.width}×${image.height}`
  const addedAt = image.addedAt ?? image.createdAt
  if (!addedAt) return t('library.detail.untitled')
  const elapsedMs = Date.now() - new Date(addedAt).getTime()
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return t('library.detail.untitled')
  const minutes = Math.floor(elapsedMs / 60_000)
  if (minutes < 1) return t('library.detail.addedJustNow')
  if (minutes < 60) return t('library.detail.addedMinutes', { count: String(minutes) })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('library.detail.addedHours', { count: String(hours) })
  const days = Math.floor(hours / 24)
  if (days < 30) return t('library.detail.addedDays', { count: String(days) })
  const date = new Date(addedAt).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US', { month: 'short', day: 'numeric' })
  return t('library.detail.addedOn', { date })
}

/** Shared markup for one reference in the library — used by both the
    virtualized list row and the grid tile, which previously duplicated this
    ~20-line body verbatim. Tags render as a sibling of the select button
    (not nested inside it) — they're independently interactive filters, and
    an interactive control inside a `<button>` breaks its accessible
    activation semantics.

    Extracted out of main.tsx (PHA 2 Untitled UI migration, 2026-09-16) — the
    hand-rolled `.reference-check` checkbox is now the kit `Checkbox`
    (base/checkbox/checkbox.tsx); everything else (thumb, tags, virtualized
    row/grid positioning via `style`) is unchanged layout, not a kit
    surface. */
export function ReferenceCard({
  image,
  variant,
  isSelected,
  isChecked,
  selectedTag,
  lang,
  t,
  style,
  onSelect,
  onToggle,
  onTagClick,
}: {
  image: EvidenceImage
  variant: 'row' | 'grid'
  isSelected: boolean
  isChecked: boolean
  selectedTag: string | null
  lang: Lang
  t: (key: string, vars?: Record<string, string>) => string
  style?: CSSProperties
  onSelect: (id: string) => void
  onToggle: (id: string) => void
  onTagClick: (tag: string) => void
}) {
  const baseClass = variant === 'row' ? 'image-row' : 'image-grid-card'
  return (
    <div
      className={isSelected ? `${baseClass} is-selected` : baseClass}
      id={`library-reference-${image.id}`}
      role="option"
      aria-selected={isSelected}
      style={style}
    >
      <Checkbox
        className={isChecked ? 'reference-check is-checked' : 'reference-check'}
        aria-label={t('library.aria.selectImage', { title: image.title })}
        isSelected={isChecked}
        onChange={() => onToggle(image.id)}
      />
      <button
        draggable
        type="button"
        title={[image.source, image.tags.join(', ')].filter(Boolean).join(' · ')}
        onClick={() => onSelect(image.id)}
        onDragStart={(event) => {
          event.dataTransfer.setData('application/x-kira-image-id', image.id)
          event.dataTransfer.setData('text/plain', image.id)
        }}
      >
        <ReferenceThumb image={image} />
        <span className="image-row-copy">
          <strong>{image.title}</strong>
          <small>{formatReferenceDetail(image, lang, t)}</small>
        </span>
      </button>
      {image.tags.length > 0 && (
        <ReferenceTags image={image} selectedTag={selectedTag} t={t} onTagClick={onTagClick} />
      )}
    </div>
  )
}
