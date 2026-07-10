import { describe, expect, it } from 'vitest'
import { pagingMarker, pagingRels } from './paging'

describe('pagingRels', () => {
  it('resolves in next/previous/first/last/current order, absolutized, skipping unset fields', () => {
    const rels = pagingRels(
      { next: '/p3', first: '/p1', last: '/p10', current: '/p5' },
      'https://example.com',
    )
    expect(rels).toEqual([
      { rel: 'next', href: 'https://example.com/p3' },
      { rel: 'first', href: 'https://example.com/p1' },
      { rel: 'last', href: 'https://example.com/p10' },
      { rel: 'current', href: 'https://example.com/p5' },
    ])
  })

  it('uses "previous" (RFC 5005), not "prev", for the rel value', () => {
    expect(pagingRels({ prev: '/p1' }, undefined)).toEqual([{ rel: 'previous', href: '/p1' }])
  })

  it('returns [] when nothing is set', () => {
    expect(pagingRels({}, 'https://example.com')).toEqual([])
  })

  it('ignores complete/archive booleans (not link rels)', () => {
    expect(pagingRels({ complete: true, archive: false }, undefined)).toEqual([])
  })

  it('maps prevArchive/nextArchive to the hyphenated RFC 5005 §4 rels, absolutized, after the other rels', () => {
    const rels = pagingRels(
      { current: '/feed', prevArchive: '/archive/2', nextArchive: '/archive/4' },
      'https://example.com',
    )
    expect(rels).toEqual([
      { rel: 'current', href: 'https://example.com/feed' },
      { rel: 'prev-archive', href: 'https://example.com/archive/2' },
      { rel: 'next-archive', href: 'https://example.com/archive/4' },
    ])
  })
})

describe('pagingMarker', () => {
  it('returns "complete" when complete is true', () => {
    expect(pagingMarker({ complete: true })).toBe('complete')
  })

  it('returns "archive" when archive is true', () => {
    expect(pagingMarker({ archive: true })).toBe('archive')
  })

  it('returns undefined when neither is set', () => {
    expect(pagingMarker({})).toBeUndefined()
  })

  it('returns undefined when both are explicitly false', () => {
    expect(pagingMarker({ complete: false, archive: false })).toBeUndefined()
  })
})
