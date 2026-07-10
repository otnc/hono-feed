import { describe, expect, it } from 'vitest'
import { fnv1a64, resolveEtag, weakEtag } from './etag'

describe('etag utils', () => {
  it('fnv1a64 is a deterministic 16-char hex that varies by input', () => {
    expect(fnv1a64('hello')).toBe(fnv1a64('hello'))
    expect(fnv1a64('hello')).toMatch(/^[0-9a-f]{16}$/)
    expect(fnv1a64('hello')).not.toBe(fnv1a64('world'))
  })

  it('weakEtag wraps the hash as a weak validator', () => {
    expect(weakEtag('body')).toMatch(/^W\/"[0-9a-f]{16}"$/)
  })

  describe('resolveEtag', () => {
    it('falls back to the built-in weak hash when no custom function is given', () => {
      expect(resolveEtag('body')).toBe(weakEtag('body'))
    })

    it("wraps a custom function's bare tag as a weak validator", () => {
      expect(resolveEtag('body', () => 'rev-42')).toBe('W/"rev-42"')
    })

    it("uses a custom function's already-quoted tag verbatim (weak or strong)", () => {
      expect(resolveEtag('body', () => '"rev-42"')).toBe('"rev-42"')
      expect(resolveEtag('body', () => 'W/"rev-42"')).toBe('W/"rev-42"')
    })

    it('passes the body through to the custom function', () => {
      expect(resolveEtag('the-body', (body) => body.toUpperCase())).toBe('W/"THE-BODY"')
    })
  })
})
