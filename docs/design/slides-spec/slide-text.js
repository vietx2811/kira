/* Reference implementation for docs/design/slides-spec.md (§3-§5).
   Pure functions, no DOM, so Worker can lift them into main.tsx (or a util file) and
   reuse slide-text.test.js as the test. Works in a <script> tag (window.SlideText)
   and in Node (module.exports). Nothing here touches user data: the node's own
   `title` and `content` stay as they are; this only decides what a slide SHOWS. */
(function (root) {
  const ELLIPSIS = '…'
  const LIMITS = { titleMax: 140, bodyMax: 220 }

  const seg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null
  // Grapheme clusters, not UTF-16 units: an NFD-typed Vietnamese letter (a + combining mark)
  // or an emoji must never be split by a cut.
  const graphemes = (s) => (seg ? Array.from(seg.segment(s), (x) => x.segment) : Array.from(s))
  const length = (s) => graphemes(s).length

  function stripInline(line) {
    return line
      .replace(/^\s*(#{1,6}\s+|>\s*|\d+[.)]\s+|[-*+]\s+)/, '')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/(\*\*|__|~~|`|\*)/g, '')
      .replace(/(^|\s)_([^_\s][^_]*)_(?=\s|$)/g, '$1$2')
      .trim()
  }

  // Cut at the last space in the final 40% of the budget; never mid-word unless a single word
  // is longer than that. Always ends in one U+2026 when it cut. `rest` is what was left out.
  function clipAtWord(text, max) {
    const g = graphemes(text.normalize('NFC').trim())
    if (g.length <= max) return { text: g.join(''), clipped: false, rest: '' }
    const room = max - 1
    let i = room
    while (i > room * 0.6 && !/\s/.test(g[i])) i--
    if (i <= room * 0.6) i = room
    // Never end on a dangling 1-2 letter word ("a", "of", "và"): hand it to the tail instead.
    const lastSpace = g.slice(0, i).map((x) => /\s/.test(x)).lastIndexOf(true)
    const tokenLen = i - lastSpace - 1
    if (lastSpace > room * 0.4 && tokenLen > 0 && tokenLen <= 2 && g[i] !== undefined && /\s/.test(g[i])) i = lastSpace
    const head = g.slice(0, i).join('').replace(/[\s,;:.\-–]+$/, '')
    return { text: head + ELLIPSIS, clipped: true, rest: g.slice(i).join('').trim() }
  }

  const flat = (lines) => lines.map(stripInline).join(' ').replace(/\s+/g, ' ').trim()

  // content (markdown) -> what the slide shows. Title and body never share a source span.
  function splitSlideText(content, opts) {
    const { titleMax, bodyMax } = Object.assign({}, LIMITS, opts)
    const lines = String(content || '').normalize('NFC').split('\n').map((l) => l.trim()).filter(Boolean)
    if (lines.length === 0) return { empty: true, title: '', body: '', hints: [] }
    const hints = []
    let title
    let rest
    if (/^#{1,3}\s+/.test(lines[0])) {
      title = stripInline(lines[0])
      rest = flat(lines.slice(1))
    } else {
      const all = flat(lines)
      const m = all.match(/^.+?[.!?…](?=\s|$)/)
      title = m ? m[0] : all
      rest = all.slice(title.length).trim()
    }
    if (length(title) > titleMax) {
      const c = clipAtWord(title, titleMax)
      // The tail stays on the slide, marked as a continuation of the clipped title.
      rest = (ELLIPSIS + c.rest + ' ' + rest).trim()
      title = c.text
      hints.push('title-clipped')
    }
    const b = clipAtWord(rest, bodyMax)
    if (b.clipped) hints.push('body-clipped')
    return { empty: false, title, body: b.text, hints }
  }

  // Deterministic type step from title length (graphemes). PPTX cannot measure text, so the
  // same table drives HTML, in-app view and PPTX (px on the 1280x720 stage; pt = px * 0.75).
  // Calibrated by headless test (_calib): worst-case caps-heavy Vietnamese and wide Latin
  // at every bracket limit, in 4 column widths (420, 560, 620, 900), never exceed `lines`.
  // Title block height stays 228-266px, so kicker + title + 4 body lines fit the 592px inner stage.
  const TITLE_STEPS = [
    { upTo: 16, size: 88, lines: 3, line: 1.0 },
    { upTo: 36, size: 64, lines: 4, line: 1.04 },
    { upTo: 90, size: 44, lines: 5, line: 1.08 },
    { upTo: 140, size: 34, lines: 6, line: 1.12 },
  ]
  function titleStep(title) {
    const n = length(title)
    return TITLE_STEPS.find((s) => n <= s.upTo) || TITLE_STEPS[TITLE_STEPS.length - 1]
  }

  const api = { ELLIPSIS, LIMITS, TITLE_STEPS, graphemes, length, stripInline, clipAtWord, splitSlideText, titleStep }
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  root.SlideText = api
})(typeof window !== 'undefined' ? window : globalThis)
