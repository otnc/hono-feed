import { describe, expect, it } from 'vitest'
import type { FeedInput } from '../types'
import { toAtom, toJSONFeed, toRSS } from './index'

// The formats barrel just re-exports one function per format; format-specific behaviour is
// covered in each format's own test suite. This guards the wiring itself: a refactor that
// swaps or drops an export here would otherwise only surface as a confusing failure in
// unrelated tests (or in consumers like serve.ts / the package's public entry point).
const input: FeedInput = {
  options: { title: 't', link: 'https://example.com/', author: { name: 'a' } },
  items: [
    {
      title: 'post',
      link: 'https://example.com/1',
      content: '<p>body</p>',
      updated: new Date('2026-06-29T00:00:00Z'),
    },
  ],
}

describe('formats barrel', () => {
  it('re-exports toRSS producing RSS output', () => {
    expect(toRSS(input)).toContain('<rss version="2.0"')
  })

  it('re-exports toAtom producing Atom output', () => {
    expect(toAtom(input)).toContain('xmlns="http://www.w3.org/2005/Atom"')
  })

  it('re-exports toJSONFeed producing JSON Feed output', () => {
    expect(JSON.parse(toJSONFeed(input)).version).toBe('https://jsonfeed.org/version/1.1')
  })
})
