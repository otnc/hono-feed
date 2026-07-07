import { describe, expect, it } from 'vitest'
import { pagingRels } from './paging'

describe('pagingRels', () => {
  it('resolves in next/previous/first/last order, absolutized, skipping unset fields', () => {
    const rels = pagingRels({ next: '/p3', first: '/p1', last: '/p10' }, 'https://example.com')
    expect(rels).toEqual([
      { rel: 'next', href: 'https://example.com/p3' },
      { rel: 'first', href: 'https://example.com/p1' },
      { rel: 'last', href: 'https://example.com/p10' },
    ])
  })

  it('uses "previous" (RFC 5005), not "prev", for the rel value', () => {
    expect(pagingRels({ prev: '/p1' }, undefined)).toEqual([{ rel: 'previous', href: '/p1' }])
  })

  it('returns [] when nothing is set', () => {
    expect(pagingRels({}, 'https://example.com')).toEqual([])
  })
})
