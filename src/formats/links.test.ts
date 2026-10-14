import { describe, expect, it } from 'vitest'
import type { FeedInput } from '../types'
import { validateInput } from '../validate'
import { toAtom } from './atom'
import { toJSONFeed } from './json'
import { toRSS } from './rss'

const input: FeedInput = {
  options: {
    title: 't',
    link: 'https://example.com/',
    author: { name: 'Ann' },
    updated: new Date('2026-01-01T00:00:00Z'),
    links: [{ rel: 'license', href: '/license', type: 'text/html', title: 'CC BY' }],
  },
  items: [
    {
      title: 'a',
      link: 'https://example.com/1',
      updated: new Date('2026-01-01T00:00:00Z'),
      links: [
        { rel: 'via', href: 'https://origin.test/post' },
        { rel: 'alternate', href: '/fr/1', hreflang: 'fr', type: 'text/html', length: 42 },
      ],
    },
  ],
}
const opts = { baseUrl: 'https://example.com', feedUrl: 'https://example.com/feed' }

describe('generic links', () => {
  it('emits <link> elements in Atom 1.0, absolutized, at feed and entry level', () => {
    const out = toAtom(input, opts)
    expect(out).toContain(
      '<link rel="license" href="https://example.com/license" type="text/html" title="CC BY"/>',
    )
    expect(out).toContain('<link rel="via" href="https://origin.test/post"/>')
    expect(out).toContain(
      '<link rel="alternate" href="https://example.com/fr/1" type="text/html" hreflang="fr" length="42"/>',
    )
  })

  it('emits <atom:link> elements in RSS 2.0 at channel and item level', () => {
    const out = toRSS(input, opts)
    expect(out).toContain('xmlns:atom="http://www.w3.org/2005/Atom"')
    expect(out).toContain(
      '<atom:link rel="license" href="https://example.com/license" type="text/html" title="CC BY"/>',
    )
    expect(out).toContain('<atom:link rel="via" href="https://origin.test/post"/>')
  })

  it('has no effect on older RSS/Atom versions or JSON Feed', () => {
    expect(toRSS(input, { ...opts, rssVersion: '0.92' })).not.toContain('license')
    expect(toRSS(input, { ...opts, rssVersion: '1.0' })).not.toContain('license')
    expect(toAtom(input, { ...opts, atomVersion: '0.3' })).not.toContain('license')
    expect(toJSONFeed(input, opts)).not.toContain('license')
  })

  it('requires rel and href on every link', () => {
    const bad = (links: NonNullable<FeedInput['items'][number]['links']>): FeedInput => ({
      ...input,
      items: [{ ...input.items[0], links }],
    })
    expect(() => validateInput(bad([{ rel: '', href: '/x' }]), 'atom')).toThrow(
      /item\[0\]\.links\[0\] requires both "rel" and "href"/,
    )
    expect(() => validateInput(bad([{ rel: 'via', href: '' }]), 'rss')).toThrow(/"href"/)
    expect(() => validateInput(input, 'atom')).not.toThrow()
  })

  it('rejects relations that have their own field, at feed and item level', () => {
    for (const rel of ['self', 'hub', 'enclosure', 'replies', 'next', 'prev-archive', 'SELF']) {
      expect(() =>
        validateInput(
          { ...input, options: { ...input.options, links: [{ rel, href: '/x' }] } },
          'atom',
        ),
      ).toThrow(/has its own field/)
      expect(() =>
        validateInput(
          { ...input, items: [{ ...input.items[0], links: [{ rel, href: '/x' }] }] },
          'rss',
        ),
      ).toThrow(/has its own field/)
    }
  })
})
