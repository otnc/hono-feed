import { describe, expect, it } from 'vitest'
import { absolutize, isUrl, selfUrl } from './url'

describe('url utils', () => {
  it('absolutizes relative URLs and leaves absolute/undefined ones alone', () => {
    expect(absolutize('/a', 'https://example.com')).toBe('https://example.com/a')
    expect(absolutize('https://other.com/x', 'https://example.com')).toBe('https://other.com/x')
    expect(absolutize(undefined, 'https://example.com')).toBeUndefined()
    expect(absolutize('/a')).toBe('/a')
  })

  it('returns the original string when the base is not a valid URL', () => {
    expect(absolutize('/a', 'not a valid base')).toBe('/a')
  })

  it('selfUrl: a serialize-time feedUrl wins over the option', () => {
    expect(
      selfUrl(
        { feedUrl: 'https://example.com/from-request' },
        { feedUrl: 'https://example.com/from-option' },
      ),
    ).toBe('https://example.com/from-request')
    expect(selfUrl({}, { feedUrl: '/feed' })).toBe('/feed')
    expect(selfUrl({ baseUrl: 'https://example.com' }, { feedUrl: '/feed' })).toBe(
      'https://example.com/feed',
    )
    expect(selfUrl({}, {})).toBeUndefined()
  })

  it('detects absolute http(s) URLs', () => {
    expect(isUrl('https://example.com')).toBe(true)
    expect(isUrl('http://example.com')).toBe(true)
    expect(isUrl('/relative')).toBe(false)
    expect(isUrl('mailto:a@example.com')).toBe(false)
  })
})
