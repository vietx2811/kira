// Draws a Mermaid diagram node's source as SVG on the canvas. Until this
// existed the package was only used to validate syntax on import, so a
// diagram node showed its title and nothing else (QA 2026-09-21 §2.4).
//
// securityLevel 'strict' makes mermaid sanitize every label and drop click
// handlers, which is what lets the SVG go in with dangerouslySetInnerHTML:
// diagram files come from wherever the user found them.
import { useEffect, useRef, useState } from 'react'

type ColorMode = 'dark' | 'light'

let renderSequence = 0
let initializedFor = ''

export async function renderMermaidSvg(source: string, mode: ColorMode) {
  const { default: mermaid } = await import('mermaid')
  if (initializedFor !== mode) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      // Without this a failed render leaves mermaid's error graphic in <body>.
      suppressErrorRendering: true,
      theme: mode === 'dark' ? 'dark' : 'neutral',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
    })
    initializedFor = mode
  }
  renderSequence += 1
  const { svg } = await mermaid.render(`kira-mermaid-${renderSequence}`, source)
  return svg
}

// The shell carries the project's resolved mode as data-color-mode
// (buildProjectAppearanceStyle), and it changes when the user flips the theme.
function useShellColorMode(hostRef: React.RefObject<HTMLElement | null>) {
  const [mode, setMode] = useState<ColorMode>('dark')
  useEffect(() => {
    const shell = hostRef.current?.closest<HTMLElement>('[data-color-mode]')
    if (!shell) return
    const read = () => setMode(shell.dataset.colorMode === 'light' ? 'light' : 'dark')
    read()
    const observer = new MutationObserver(read)
    observer.observe(shell, { attributes: true, attributeFilter: ['data-color-mode'] })
    return () => observer.disconnect()
  }, [hostRef])
  return mode
}

export function MermaidPreview({
  source,
  label,
  loadingText,
  errorText,
}: {
  source: string
  label: string
  loadingText: string
  errorText: string
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const mode = useShellColorMode(hostRef)
  const [svg, setSvg] = useState('')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    // Source edits arrive per keystroke from the details panel; wait for a
    // pause so a half-typed line does not flash an error on every key.
    const timer = window.setTimeout(() => {
      renderMermaidSvg(source, mode)
        .then((next) => {
          if (cancelled) return
          setSvg(next)
          setFailed(false)
        })
        .catch(() => {
          // Keep the last diagram that did draw, and say the current text does not.
          if (!cancelled) setFailed(true)
        })
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [source, mode])

  return (
    <div ref={hostRef} className={['mermaid-preview', failed ? 'has-error' : ''].filter(Boolean).join(' ')} role="img" aria-label={label}>
      {svg ? <div className="mermaid-preview-svg" dangerouslySetInnerHTML={{ __html: svg }} /> : !failed && <span className="mermaid-preview-status">{loadingText}</span>}
      {failed && <span className="mermaid-preview-status">{errorText}</span>}
    </div>
  )
}
