import { useRef, useState } from 'react'
import type React from 'react'
import { ImagePlus } from 'lucide-react'
import type { EvidenceImage } from '@/main'

// Extracted out of main.tsx (PHA 2 Untitled UI migration, 2026-09-16) —
// reused by canvas nodes, slides and the Library drawer (components/
// application/library/), so it lives as its own shared component rather than
// inside the library folder. Pure presentational component; the small
// `clamp` below is a private copy (main.tsx's own `clamp` is used 80+ times
// elsewhere and stays put — not worth wiring an import for one call).
function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

// Reference nodes render at their real aspect ratio instead of a fixed crop
// box.
export function referenceAspect(image: Pick<EvidenceImage, 'width' | 'height'> & Partial<Pick<EvidenceImage, 'cropRect'>>) {
  if (!image.width || !image.height) return 4 / 3
  // Everything that lays out or sizes a reference (canvas nodes, shelf-pack,
  // cluster-force collision radius, library thumbnails) already funnels
  // through this one function, so a crop just needs to change what it
  // reports here — nothing downstream needs to know cropping exists.
  if (image.cropRect && image.cropRect.width > 0 && image.cropRect.height > 0) {
    const croppedWidthPx = image.width * image.cropRect.width
    const croppedHeightPx = image.height * image.cropRect.height
    return clamp(croppedWidthPx / croppedHeightPx, 0.3, 3.5)
  }
  return clamp(image.width / image.height, 0.3, 3.5)
}

export function ReferenceThumb({
  image,
  className = '',
}: {
  image: Pick<EvidenceImage, 'thumb' | 'title' | 'width' | 'height' | 'cropRect'>
  className?: string
}) {
  const [isMissing, setIsMissing] = useState(false)
  const hostRef = useRef<HTMLSpanElement>(null)
  const classes = ['reference-thumb', className, isMissing ? 'is-missing' : ''].filter(Boolean).join(' ')
  const storedAspect = image.width && image.height ? referenceAspect(image) : null
  const crop = image.cropRect

  // The non-destructive crop trick: blow the <img> up past its container by
  // exactly 1/cropWidth and shift it so the crop rect's corner lands at the
  // container's corner, then let overflow:hidden do the clipping. The file on
  // disk never changes — only what fraction of it this element shows.
  const cropStyle: React.CSSProperties | undefined =
    crop && crop.width > 0 && crop.height > 0
      ? {
          position: 'absolute',
          width: `${100 / crop.width}%`,
          height: `${100 / crop.height}%`,
          maxWidth: 'none',
          left: `${(-crop.x / crop.width) * 100}%`,
          top: `${(-crop.y / crop.height) * 100}%`,
        }
      : undefined

  return (
    <span
      ref={hostRef}
      className={classes}
      aria-label={isMissing ? `${image.title} missing` : undefined}
      style={storedAspect ? { '--thumb-aspect': storedAspect } as React.CSSProperties : undefined}
    >
      {isMissing ? (
        <ImagePlus size={16} aria-hidden="true" />
      ) : (
        <img
          src={image.thumb}
          alt=""
          draggable={false}
          style={cropStyle}
          onError={() => setIsMissing(true)}
          // Captures from the web usually arrive without stored dimensions, so
          // the true ratio is read off the decoded image rather than guessed.
          onLoad={(event) => {
            if (storedAspect) return
            const { naturalWidth, naturalHeight } = event.currentTarget
            if (!naturalWidth || !naturalHeight) return
            hostRef.current?.style.setProperty('--thumb-aspect', String(referenceAspect({ width: naturalWidth, height: naturalHeight })))
          }}
        />
      )}
    </span>
  )
}
