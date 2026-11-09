/**
 * Run with: bun test apps/desktop/src/kira
 */
import { describe, expect, test } from 'bun:test'
import { buildPinterestSearchQuery, resolvePinterestPinUrl } from './pinterestSimilar'

describe('resolvePinterestPinUrl', () => {
  test('finds a pin URL in source (browser-extension capture)', () => {
    expect(
      resolvePinterestPinUrl({
        source: 'https://www.pinterest.com/pin/987654321/',
        sourceUrl: 'https://i.pinimg.com/originals/aa/bb/cc/hash.jpg',
      }),
    ).toBe('https://www.pinterest.com/pin/987654321/')
  })

  test('finds a pin URL in sourceUrl (pin link pasted directly)', () => {
    expect(
      resolvePinterestPinUrl({
        source: 'https://www.pinterest.com/pin/123456789/',
        sourceUrl: 'https://www.pinterest.com/pin/123456789/',
      }),
    ).toBe('https://www.pinterest.com/pin/123456789/')
  })

  test('bare pinterest.com host (no subdomain) still matches', () => {
    expect(resolvePinterestPinUrl({ source: 'https://pinterest.com/pin/42/' })).toBe('https://pinterest.com/pin/42/')
  })

  test('neither field is a pin URL', () => {
    expect(
      resolvePinterestPinUrl({
        source: 'https://www.pinterest.com/some-user/some-board/',
        sourceUrl: 'https://i.pinimg.com/originals/aa/bb/cc/hash.jpg',
      }),
    ).toBe(null)
  })

  test('a lookalike host is rejected, not treated as pinterest.com', () => {
    expect(resolvePinterestPinUrl({ source: 'https://evilpinterest.com/pin/1/' })).toBe(null)
  })

  test('unparseable or missing values do not throw', () => {
    expect(resolvePinterestPinUrl({})).toBe(null)
    expect(resolvePinterestPinUrl({ source: 'not a url' })).toBe(null)
  })
})

describe('buildPinterestSearchQuery', () => {
  test('reproduces the reported bug: system tags and the raw pin URL are stripped', () => {
    const title = 'Hoi An lanterns'
    const tags = ['browser', 'image', 'lantern', 'hoi', 'an', 'lanterns', 'hoi', 'https://www.pinterest.com/pin/987654321/']
    expect(buildPinterestSearchQuery(title, tags)).toBe('Hoi An lanterns lantern')
  })

  test('drops a bare domain-shaped tag too, not just full URLs with a scheme', () => {
    expect(buildPinterestSearchQuery('altar', ['browser', 'image', 'pinterest.com', 'ritual'])).toBe('altar ritual')
  })

  test('drops the page system tag for a page capture', () => {
    expect(buildPinterestSearchQuery('Market stall', ['browser', 'page', 'street', 'food'])).toBe('Market stall street food')
  })

  test('dedupes case-insensitively, keeping the first-seen casing', () => {
    expect(buildPinterestSearchQuery('Lantern Lantern', ['lantern', 'glow'])).toBe('Lantern glow')
  })

  test('title words come before tag words when both are present', () => {
    expect(buildPinterestSearchQuery('brushed altar object', ['ritual', 'bronze'])).toBe('brushed altar object ritual bronze')
  })

  test('truncates an overly long query without cutting mid-word', () => {
    const longTitle = Array.from({ length: 30 }, (_, i) => `word${i}`).join(' ')
    const query = buildPinterestSearchQuery(longTitle, [])
    expect(query.length).toBeLessThanOrEqual(100)
    expect(query.endsWith(' ')).toBe(false)
    // A true prefix of the original (only whole trailing words dropped),
    // not a hard slice that mangles the last word.
    expect(longTitle.startsWith(query)).toBe(true)
  })

  test('empty title and tags produce an empty query, not a crash', () => {
    expect(buildPinterestSearchQuery('', [])).toBe('')
  })
})
