import { create } from 'zustand'
import type { LibraryDensity } from '@/main'

// Library drawer layout constants + the thumbnail-size store — extracted out
// of main.tsx (PHA 2 Untitled UI migration, 2026-09-16) alongside the rest of
// EvidenceInbox. Pure layout math + a zustand store, no dependency on app
// state, safe to share as-is. `LibraryDensity` stays a type-only import from
// main.tsx (erased at build time — no runtime circularity).

// Percent 0-100 along the slider's travel; converted to actual pixel sizes by
// libraryGridMinPxFor/libraryListThumbWidthFor below. App-level, not
// project-level: how big someone likes their reference thumbnails doesn't
// change per project.
export const LIBRARY_THUMB_SIZE_MIN = 0
export const LIBRARY_THUMB_SIZE_MAX = 100
const LIBRARY_THUMB_SIZE_DEFAULT = 60
const LIBRARY_GRID_MIN_PX = 110
const LIBRARY_GRID_MAX_PX = 260
const LIBRARY_LIST_THUMB_MIN_PX = 46
const LIBRARY_LIST_THUMB_MAX_PX = 100

function clampLibraryThumbSize(pct: number) {
  return Math.min(LIBRARY_THUMB_SIZE_MAX, Math.max(LIBRARY_THUMB_SIZE_MIN, Math.round(pct)))
}

function readStoredLibraryThumbSize(): number {
  try {
    const raw = localStorage.getItem('kira:libraryThumbSize')
    // Bug found during this phase's browser verification, fixed here (not
    // just carried over): `Number(null)` is `0`, not `NaN` — so on a first
    // run with nothing stored yet, the old `Number(getItem(...))` read a
    // real, valid-looking 0 and the slider defaulted to its bottom end
    // instead of LIBRARY_THUMB_SIZE_DEFAULT. That's the same failure mode
    // as the "looks like an on/off switch" report this phase is fixing —
    // worth the one extra null check since it was silently defeating the
    // default on every never-touched profile.
    if (raw == null) return LIBRARY_THUMB_SIZE_DEFAULT
    const stored = Number(raw)
    return Number.isFinite(stored) && stored >= 0 ? clampLibraryThumbSize(stored) : LIBRARY_THUMB_SIZE_DEFAULT
  } catch {
    return LIBRARY_THUMB_SIZE_DEFAULT
  }
}

export const useLibraryThumbSizeStore = create<{ pct: number; setPct: (pct: number) => void }>()((set) => ({
  pct: readStoredLibraryThumbSize(),
  setPct: (pct) => {
    const next = clampLibraryThumbSize(pct)
    try {
      localStorage.setItem('kira:libraryThumbSize', String(next))
    } catch {
      // ignore persistence failures (private mode, etc.)
    }
    set({ pct: next })
  },
}))

export function libraryGridMinPxFor(pct: number) {
  return Math.round(LIBRARY_GRID_MIN_PX + (LIBRARY_GRID_MAX_PX - LIBRARY_GRID_MIN_PX) * (pct / 100))
}

export function libraryListThumbWidthFor(pct: number) {
  return Math.round(LIBRARY_LIST_THUMB_MIN_PX + (LIBRARY_LIST_THUMB_MAX_PX - LIBRARY_LIST_THUMB_MIN_PX) * (pct / 100))
}

export const libraryOverscan = 5

// The virtualized list positions rows via `transform: translateY(...)` every
// rowHeight px (thumb height + chrome below + this gutter), so the estimate
// must stay >= the tallest actual row or rows will visually overlap; this is
// a deliberate gutter between rows, not slack to trim.
export const libraryRowGutter = 6

// Everything in a list row besides the thumbnail itself (title/meta text, row
// padding) — density still controls this. The thumbnail's own size now comes
// from the size slider instead of density (libraryListThumbWidthFor above),
// so this is what's left over once the (measured) row box heights of 86px
// compact / 100px relaxed have the old fixed 48px/58px thumb subtracted back
// out.
export const libraryRowChromeHeights: Record<LibraryDensity, number> = {
  compact: 38,
  relaxed: 42,
}

// Same shape as the grid card at rest (thumb aspect-ratio ~1.16 plus title/
// meta/padding below it) — used only to estimate virtualized row height, not
// to size anything directly (the actual card uses CSS aspect-ratio).
export const libraryGridItemChromeHeight = 74
export const libraryGridItemAspect = 1.16
