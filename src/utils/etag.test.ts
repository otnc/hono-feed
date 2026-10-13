import { describe, expect, it } from 'vitest'
import { resolveEtag, weakEtag } from './etag'

describe('weakEtag', () => {
  it('is a weak entity-tag (RFC 9110 §8.8.3)', () => {
    expect(weakEtag('body')).toMatch(/^W\/"[^"]+"$/)
  })

  it('matches the FNV-1a 64-bit test vectors', () => {
    expect(weakEtag('')).toBe('W/"cbf29ce484222325"')
    expect(weakEtag('a')).toBe('W/"af63dc4c8601ec8c"')
    expect(weakEtag('foobar')).toBe('W/"85944171f73967e8"')
  })

  it('is stable for the same body and differs for a different body', () => {
    expect(weakEtag('hello')).toBe(weakEtag('hello'))
    expect(weakEtag('hello')).not.toBe(weakEtag('world'))
  })
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
