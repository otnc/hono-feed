import { describe, expect, it } from 'vitest'
import { absolutize, isUrl } from './url'

describe('url utils', () => {
  it('absolutizes relative URLs and leaves absolute/undefined ones alone', () => {
    expect(absolutize('/a', 'https://example.com')).toBe('https://example.com/a')
    expect(absolutize('https://other.com/x', 'https://example.com')).toBe('https://other.com/x')
    expect(absolutize(undefined, 'https://example.com')).toBeUndefined()
    expect(absolutize('/a')).toBe('/a')
  })

  it('detects absolute http(s) URLs', () => {
    expect(isUrl('https://example.com')).toBe(true)
    expect(isUrl('http://example.com')).toBe(true)
    expect(isUrl('/relative')).toBe(false)
    expect(isUrl('mailto:a@example.com')).toBe(false)
  })
})
