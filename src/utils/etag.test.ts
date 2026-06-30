import { describe, expect, it } from 'vitest'
import { fnv1a, weakEtag } from './etag'

describe('etag utils', () => {
  it('fnv1a is a deterministic 8-char hex that varies by input', () => {
    expect(fnv1a('hello')).toBe(fnv1a('hello'))
    expect(fnv1a('hello')).toMatch(/^[0-9a-f]{8}$/)
    expect(fnv1a('hello')).not.toBe(fnv1a('world'))
  })

  it('weakEtag wraps the hash as a weak validator', () => {
    expect(weakEtag('body')).toMatch(/^W\/"[0-9a-f]{8}"$/)
  })
})
