import { describe, expect, it } from 'vitest'
import { serializeCacheControl } from './cache-control'

describe('serializeCacheControl', () => {
  it('joins boolean directives in a stable, conventional order', () => {
    expect(serializeCacheControl({ public: true, maxAge: 3600 })).toBe('public, max-age=3600')
  })

  it('omits directives left unset, including false booleans', () => {
    expect(serializeCacheControl({ public: false, private: true })).toBe('private')
    expect(serializeCacheControl({})).toBe('')
  })

  it('renders every supported directive', () => {
    expect(
      serializeCacheControl({
        noStore: true,
        noCache: true,
        public: true,
        private: true,
        maxAge: 60,
        sMaxAge: 120,
        mustRevalidate: true,
        proxyRevalidate: true,
        immutable: true,
        staleWhileRevalidate: 30,
        staleIfError: 300,
      }),
    ).toBe(
      'no-store, no-cache, public, private, max-age=60, s-maxage=120, ' +
        'must-revalidate, proxy-revalidate, immutable, stale-while-revalidate=30, stale-if-error=300',
    )
  })
})
