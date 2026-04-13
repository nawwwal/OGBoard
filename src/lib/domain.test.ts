import { describe, expect, it } from 'vitest'
import { isValidUrl, normalizeUserInputUrl, parseUrlList } from '#/lib/domain'

describe('domain helpers', () => {
  it('normalizes bare domains into https urls', () => {
    expect(normalizeUserInputUrl('vercel.com')).toBe('https://vercel.com/')
    expect(normalizeUserInputUrl('vercel.com/docs')).toBe('https://vercel.com/docs')
  })

  it('strips tracking params, hashes, and default ports during normalization', () => {
    expect(
      normalizeUserInputUrl(
        'https://vercel.com/docs/?utm_source=x&foo=1&fbclid=abc#intro',
      ),
    ).toBe('https://vercel.com/docs?foo=1')
    expect(
      normalizeUserInputUrl(
        'https://example.com:443/path/?b=2&utm_medium=email&a=1',
      ),
    ).toBe('https://example.com/path?a=1&b=2')
  })

  it('accepts bare domains and rejects unsupported schemes', () => {
    expect(isValidUrl('vercel.com')).toBe(true)
    expect(isValidUrl('https://vercel.com')).toBe(true)
    expect(isValidUrl('javascript:alert(1)')).toBe(false)
    expect(isValidUrl('mailto:test@example.com')).toBe(false)
  })

  it('parses bulk input, normalizes urls, deduplicates, and caps the list', () => {
    const raw = [
      'vercel.com',
      'https://vercel.com/?utm_source=twitter',
      'https://vercel.com/#hero',
      'github.com',
      'not a url',
    ]
      .concat(Array.from({ length: 60 }, (_, index) => `example${index}.com`))
      .join('\n')

    const urls = parseUrlList(raw)

    expect(urls[0]).toBe('https://vercel.com/')
    expect(urls[1]).toBe('https://github.com/')
    expect(urls).toHaveLength(50)
  })
})
