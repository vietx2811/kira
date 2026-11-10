/**
 * Pure logic for the Settings "Connections" row (docs/research/
 * 2026-11-09-pinterest-similar-flow.md §A, "Cập nhật 2026-11-10", phương
 * án 3) and for routing "Find similar on Pinterest" through a login page
 * when the extension's last-seen status says the user is signed out.
 *
 * No React, no DOM, unit-tested without the app (`bun test
 * apps/desktop/src/kira`).
 *
 * KIRA never reads a cookie or a token for this. The only fact it ever
 * learns is whatever the extension's content script posts from a
 * `pinterest.com` tab — one bool, `loggedIn` — relayed over the loopback
 * capture server (`POST http://127.0.0.1:47653/connection`, validated in
 * src-tauri/src/lib.rs's `validate_connection_payload`) as the
 * `kira:connection` native event. `parseKiraConnectionPayload` mirrors that
 * Rust validation on the frontend the same way `parseKiraCapturePayload`
 * mirrors `validate_capture_payload` — defense in depth, not the only
 * check.
 */

/** Services this flow currently has a connection row for. Kept as a small,
    closed set (not just `string`) so a typo in a call site is a type error,
    not a silent no-op — mirrors KNOWN_CONNECTION_SERVICES in lib.rs. */
export type PinterestConnectionService = 'pinterest'

const KNOWN_CONNECTION_SERVICES: ReadonlySet<string> = new Set<PinterestConnectionService>(['pinterest'])

export type KiraConnectionPayload = {
  service: PinterestConnectionService
  loggedIn: boolean
}

/**
 * What's actually persisted (app-wide, like AI settings — see
 * `useConnectionsStore` in main.tsx): the last status the extension
 * reported, and when KIRA received it (not the extension's own clock —
 * nothing here depends on cross-process time agreeing). `null` means
 * "never told us," i.e. the status shown is "Unknown," not "logged out."
 */
export type PinterestConnectionKnowledge = {
  loggedIn: boolean
  lastSeenAt: string
}

/**
 * Validates the raw event payload string exactly as strictly as
 * `validate_connection_payload` does server-side: a JSON object with
 * exactly `service` and `loggedIn`, `service` from the known set, no extra
 * fields. Anything else comes back `null` rather than a best-effort guess —
 * the Rust side already refused to emit the event for a payload this
 * function would reject, so landing here should mean "trust this," but a
 * future change on one side drifting from the other should fail loud, not
 * quietly accept something malformed.
 */
export function parseKiraConnectionPayload(raw: string): KiraConnectionPayload | null {
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const keys = Object.keys(value as Record<string, unknown>)
  if (keys.length !== 2 || !keys.includes('service') || !keys.includes('loggedIn')) return null
  const candidate = value as { service?: unknown; loggedIn?: unknown }
  if (typeof candidate.service !== 'string' || !KNOWN_CONNECTION_SERVICES.has(candidate.service)) return null
  if (typeof candidate.loggedIn !== 'boolean') return null
  return { service: candidate.service as PinterestConnectionService, loggedIn: candidate.loggedIn }
}

export type PinterestConnectionStatusKind = 'logged_in' | 'logged_out' | 'unknown'

/** Maps stored knowledge to one of the three states Settings shows — "Đã
    đăng nhập" / "Chưa đăng nhập" / "Chưa rõ" — leaving the actual label
    strings (and their vi/en text) to the component, which has `t()`. */
export function classifyPinterestConnectionStatus(
  knowledge: PinterestConnectionKnowledge | null,
): PinterestConnectionStatusKind {
  if (!knowledge) return 'unknown'
  return knowledge.loggedIn ? 'logged_in' : 'logged_out'
}

/**
 * Pinterest's own login page takes a `next` querystring to return the user
 * to where they meant to go. Only the path and query of the destination are
 * sent, not the full absolute URL: `next` is a same-site redirect target,
 * and a relative path is both what Pinterest's own links use and the
 * smaller thing to hand a login form. If `destinationUrl` doesn't parse as
 * an absolute URL (defensive only — callers only ever pass one that already
 * passed `validate_pinterest_url`), it's sent through unchanged rather than
 * dropped.
 */
export function buildPinterestLoginUrl(destinationUrl: string): string {
  let next = destinationUrl
  try {
    const parsed = new URL(destinationUrl)
    next = `${parsed.pathname}${parsed.search}`
  } catch {
    // Not an absolute URL — fall back to sending it as-is.
  }
  return `https://www.pinterest.com/login/?next=${encodeURIComponent(next)}`
}

/**
 * Decides what URL "Find similar on Pinterest" should actually open.
 * `destinationUrl` is `buildPinterestSimilarUrl(node)`'s result — already
 * decided (pin page vs. search) and already pinterest.com. Only a
 * confidently-known "logged out" redirects through the login page; "logged
 * in" and "unknown" (the extension has never seen a Pinterest tab, or
 * hasn't since this status went stale) open the destination directly, same
 * as before this feature existed — Pinterest's own "Welcome to Pinterest"
 * gate already covers the unknown case (research 2026-11-09 §1.1).
 */
export function resolvePinterestOpenUrl(
  knowledge: PinterestConnectionKnowledge | null,
  destinationUrl: string,
): string {
  if (knowledge && knowledge.loggedIn === false) return buildPinterestLoginUrl(destinationUrl)
  return destinationUrl
}

const RELATIVE_TIME_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 24 * 60 * 60 * 1000],
  ['month', 30 * 24 * 60 * 60 * 1000],
  ['day', 24 * 60 * 60 * 1000],
  ['hour', 60 * 60 * 1000],
  ['minute', 60 * 1000],
]

/**
 * "Last seen 2 hours ago" / "Thấy lần cuối 2 giờ trước" — `Intl.
 * RelativeTimeFormat` already knows how to say this in Vietnamese, so this
 * just picks the coarsest unit that fits rather than hand-rolling strings
 * (and risking an em dash). `now` is a parameter instead of reading the
 * clock so this is deterministic to test; the real call site in main.tsx
 * leaves it out and gets `Date.now()`.
 */
export function formatConnectionLastSeen(iso: string, lang: 'en' | 'vi', now: number = Date.now()): string {
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ''
  const elapsedMs = now - then
  if (elapsedMs < 60_000) return lang === 'vi' ? 'Vừa xong' : 'Just now'
  const formatter = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' })
  for (const [unit, unitMs] of RELATIVE_TIME_UNITS) {
    if (elapsedMs < unitMs && unit !== 'minute') continue
    const value = Math.max(1, Math.round(elapsedMs / unitMs))
    return formatter.format(-value, unit)
  }
  return ''
}
