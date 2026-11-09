/**
 * Pure logic for "Find similar on Pinterest" (docs/research/
 * 2026-11-09-pinterest-similar-flow.md §3.3), split out of main.tsx's
 * buildPinterestSimilarUrl so it's unit-testable (`bun test
 * apps/desktop/src/kira`) without the app. No React, no DOM.
 *
 * Bug this fixes: a browser-extension capture of a Pinterest pin stores the
 * pin's own page URL in `source` (capture.pageUrl) and the pinned image's
 * CDN URL in `sourceUrl` (capture.url, see createReferenceFromCapture) —
 * `sourceUrl` must keep meaning "the image URL" since
 * downloadAndAnalyzeCaptureImage depends on that. The old check only ever
 * looked at `sourceUrl`, so a pin capture always fell through to the tag
 * search below instead of reopening the pin itself.
 */

const SEARCH_SYSTEM_TAGS = new Set(['browser', 'image', 'page'])

/** A token that looks like part of a URL rather than a real search word —
    the raw capture source/pin URL ends up in `tags` via sourceTags
    (tagsFromFilename on `${title} ${sourceText}`), and leaking it into the
    Pinterest search query is what produced queries like "... hoi
    https://www.pinterest.com/pin/987.../" in the wild. */
function looksLikeUrlToken(token: string): boolean {
  if (token.includes('/') || token.includes(':')) return true
  return /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(token)
}

function isPinterestPinUrl(value: string | undefined): value is string {
  if (!value) return false
  try {
    const parsed = new URL(value)
    const isPinterestHost = parsed.hostname === 'pinterest.com' || parsed.hostname.endsWith('.pinterest.com')
    return isPinterestHost && parsed.pathname.startsWith('/pin/')
  } catch {
    return false
  }
}

/**
 * The Pin's own page URL, checking both fields a capture might have put it
 * in (`source` for an extension capture, `sourceUrl` for a pin link pasted
 * directly onto the canvas — see createReferenceFromUrl, where both fields
 * carry the same pasted URL) — whichever one actually is a pin link wins.
 * `null` means "no pin URL available," so the caller falls back to search.
 */
export function resolvePinterestPinUrl(node: { source?: string; sourceUrl?: string }): string | null {
  if (isPinterestPinUrl(node.source)) return node.source
  if (isPinterestPinUrl(node.sourceUrl)) return node.sourceUrl
  return null
}

const MAX_SEARCH_QUERY_LENGTH = 100

/**
 * Builds the fallback tag-search query (no pin URL available): drops the
 * system tags every capture carries (`browser`, the capture `kind`),
 * drops any token that looks like a URL rather than a search word, dedupes
 * case-insensitively, and prefers the title's own words over tag order —
 * the title reads as a coherent phrase, tags are an unordered bag.
 */
export function buildPinterestSearchQuery(title: string, tags: string[]): string {
  const titleWords = title
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean)

  const cleanTags = tags
    .map((tag) => tag.trim())
    .filter(Boolean)
    .filter((tag) => !SEARCH_SYSTEM_TAGS.has(tag.toLowerCase()))
    .filter((tag) => !looksLikeUrlToken(tag))

  const seen = new Set<string>()
  const words: string[] = []
  for (const word of [...titleWords, ...cleanTags]) {
    const key = word.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    words.push(word)
  }

  const query = words.join(' ')
  if (query.length <= MAX_SEARCH_QUERY_LENGTH) return query

  // Cut at the last whole word inside the limit — a hard slice risks
  // handing Pinterest a mangled trailing fragment (e.g. "...lant").
  const truncated = query.slice(0, MAX_SEARCH_QUERY_LENGTH)
  const lastSpace = truncated.lastIndexOf(' ')
  return lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated
}
