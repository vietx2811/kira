/**
 * Run with: bun test apps/desktop/src/kira
 */
import { describe, expect, test } from 'bun:test'
import {
  buildPinterestLoginUrl,
  classifyPinterestConnectionStatus,
  formatConnectionLastSeen,
  parseKiraConnectionPayload,
  resolvePinterestOpenUrl,
} from './pinterestConnection'

describe('parseKiraConnectionPayload', () => {
  test('accepts a well-formed pinterest payload', () => {
    expect(parseKiraConnectionPayload('{"service":"pinterest","loggedIn":true}')).toEqual({
      service: 'pinterest',
      loggedIn: true,
    })
    expect(parseKiraConnectionPayload('{"service":"pinterest","loggedIn":false}')).toEqual({
      service: 'pinterest',
      loggedIn: false,
    })
  })

  test('rejects broken JSON', () => {
    expect(parseKiraConnectionPayload('{not json')).toBe(null)
  })

  test('rejects a non-object', () => {
    expect(parseKiraConnectionPayload('[1,2,3]')).toBe(null)
    expect(parseKiraConnectionPayload('"pinterest"')).toBe(null)
    expect(parseKiraConnectionPayload('null')).toBe(null)
  })

  test('rejects an unknown service', () => {
    expect(parseKiraConnectionPayload('{"service":"instagram","loggedIn":true}')).toBe(null)
  })

  test('rejects a non-boolean loggedIn', () => {
    expect(parseKiraConnectionPayload('{"service":"pinterest","loggedIn":"yes"}')).toBe(null)
  })

  test('rejects a missing field either way', () => {
    expect(parseKiraConnectionPayload('{"service":"pinterest"}')).toBe(null)
    expect(parseKiraConnectionPayload('{"loggedIn":true}')).toBe(null)
  })

  // Same intent as validate_connection_payload's own
  // rejects_unknown_extra_field test in lib.rs: a well-formed payload that
  // also carries a third field (a cookie, a URL — anything wider than this
  // feature is meant to ever send) is rejected, not accepted with the extra
  // field ignored.
  test('rejects an extra field riding along on an otherwise-valid payload', () => {
    expect(parseKiraConnectionPayload('{"service":"pinterest","loggedIn":true,"cookie":"abc"}')).toBe(null)
  })
})

describe('classifyPinterestConnectionStatus', () => {
  test('null knowledge is unknown', () => {
    expect(classifyPinterestConnectionStatus(null)).toBe('unknown')
  })

  test('loggedIn true is logged_in', () => {
    expect(classifyPinterestConnectionStatus({ loggedIn: true, lastSeenAt: '2026-11-11T00:00:00.000Z' })).toBe(
      'logged_in',
    )
  })

  test('loggedIn false is logged_out', () => {
    expect(classifyPinterestConnectionStatus({ loggedIn: false, lastSeenAt: '2026-11-11T00:00:00.000Z' })).toBe(
      'logged_out',
    )
  })
})

describe('buildPinterestLoginUrl', () => {
  test('carries the destination path and query as next', () => {
    const url = buildPinterestLoginUrl('https://www.pinterest.com/pin/123456789/')
    expect(url).toBe('https://www.pinterest.com/login/?next=%2Fpin%2F123456789%2F')
  })

  test('keeps a search query string', () => {
    const url = buildPinterestLoginUrl('https://www.pinterest.com/search/pins/?q=quiet%20interior')
    expect(url).toBe('https://www.pinterest.com/login/?next=%2Fsearch%2Fpins%2F%3Fq%3Dquiet%2520interior')
  })

  test('falls back to sending a non-absolute value as-is', () => {
    const url = buildPinterestLoginUrl('/pin/123/')
    expect(url).toBe('https://www.pinterest.com/login/?next=%2Fpin%2F123%2F')
  })
})

describe('resolvePinterestOpenUrl', () => {
  const destination = 'https://www.pinterest.com/pin/123456789/'

  test('unknown status opens the destination directly', () => {
    expect(resolvePinterestOpenUrl(null, destination)).toBe(destination)
  })

  test('known logged-in opens the destination directly', () => {
    expect(resolvePinterestOpenUrl({ loggedIn: true, lastSeenAt: '2026-11-11T00:00:00.000Z' }, destination)).toBe(
      destination,
    )
  })

  test('known logged-out redirects through the login page', () => {
    const result = resolvePinterestOpenUrl({ loggedIn: false, lastSeenAt: '2026-11-11T00:00:00.000Z' }, destination)
    expect(result).toBe(buildPinterestLoginUrl(destination))
    expect(result.startsWith('https://www.pinterest.com/login/')).toBe(true)
  })
})

describe('formatConnectionLastSeen', () => {
  const now = Date.parse('2026-11-11T12:00:00.000Z')

  test('under a minute reads as just now, in either language', () => {
    const iso = new Date(now - 30_000).toISOString()
    expect(formatConnectionLastSeen(iso, 'en', now)).toBe('Just now')
    expect(formatConnectionLastSeen(iso, 'vi', now)).toBe('Vừa xong')
  })

  test('minutes ago', () => {
    const iso = new Date(now - 5 * 60_000).toISOString()
    expect(formatConnectionLastSeen(iso, 'en', now)).toBe('5 minutes ago')
  })

  test('hours ago', () => {
    const iso = new Date(now - 3 * 60 * 60_000).toISOString()
    expect(formatConnectionLastSeen(iso, 'en', now)).toBe('3 hours ago')
  })

  test('days ago, in Vietnamese', () => {
    // numeric: 'auto' prefers the named day two days back over "2 ngày
    // trước" — Intl's own call, not a hardcoded string here.
    const iso = new Date(now - 2 * 24 * 60 * 60_000).toISOString()
    expect(formatConnectionLastSeen(iso, 'vi', now)).toBe('Hôm kia')
  })

  test('many days ago, in Vietnamese', () => {
    const iso = new Date(now - 10 * 24 * 60 * 60_000).toISOString()
    expect(formatConnectionLastSeen(iso, 'vi', now)).toBe('10 ngày trước')
  })

  test('an unparsable timestamp comes back empty, not a crash', () => {
    expect(formatConnectionLastSeen('not a date', 'en', now)).toBe('')
  })
})
