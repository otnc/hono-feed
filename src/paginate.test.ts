import { describe, expect, it } from 'vitest'
import { paginate } from './utils/paging'

const items = Array.from({ length: 25 }, (_, i) => i + 1)
const url = (page: number) => `/feed?page=${page}`

describe('paginate', () => {
  it('returns the first page with next, first and last links (RFC 5005 §3)', () => {
    const result = paginate(items, { perPage: 10, url })
    expect(result.items).toEqual(items.slice(0, 10))
    expect(result.page).toBe(1)
    expect(result.totalPages).toBe(3)
    expect(result.paging).toEqual({
      next: '/feed?page=2',
      first: '/feed?page=1',
      last: '/feed?page=3',
    })
  })

  it('links both directions from a middle page', () => {
    const result = paginate(items, { page: 2, perPage: 10, url })
    expect(result.items).toEqual(items.slice(10, 20))
    expect(result.paging).toEqual({
      next: '/feed?page=3',
      prev: '/feed?page=1',
      first: '/feed?page=1',
      last: '/feed?page=3',
    })
  })

  it('has no next link on the last page, which holds the remainder', () => {
    const result = paginate(items, { page: 3, perPage: 10, url })
    expect(result.items).toEqual([21, 22, 23, 24, 25])
    expect(result.paging.next).toBeUndefined()
    expect(result.paging.prev).toBe('/feed?page=2')
  })

  it('emits no links for a single page', () => {
    expect(paginate(items, { perPage: 100, url }).paging).toEqual({})
    expect(paginate([], { perPage: 10, url })).toEqual({
      items: [],
      paging: {},
      page: 1,
      totalPages: 1,
    })
  })

  it('parses a query string value and falls back to page 1 for anything unparsable', () => {
    expect(paginate(items, { page: '2', perPage: 10, url }).page).toBe(2)
    for (const page of ['abc', '', '0', '-3', null, undefined, Number.NaN]) {
      expect(paginate(items, { page, perPage: 10, url }).page).toBe(1)
    }
  })

  it('clamps a page past the end to the last page', () => {
    const result = paginate(items, { page: 99, perPage: 10, url })
    expect(result.page).toBe(3)
    expect(result.items).toEqual([21, 22, 23, 24, 25])
  })

  it('rejects a perPage that is not a positive integer', () => {
    for (const perPage of [0, -1, 1.5, Number.NaN]) {
      expect(() => paginate(items, { perPage, url })).toThrow(RangeError)
    }
  })
})
