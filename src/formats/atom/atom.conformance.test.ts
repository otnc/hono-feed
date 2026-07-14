import { describe, expect, it } from 'vitest'
import type { FeedInput } from '../../types'
import { toAtom } from './index'

const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/

// Spec-complete input: feed-level author is present so the RFC 4287 4.1.1 "author unless
// every entry has one" rule is satisfied without relying on unvalidated fallbacks.
const complete: FeedInput = {
  options: {
    title: 'example blog',
    link: 'https://example.com/',
    description: 'diary',
    id: 'https://example.com/',
    updated: new Date('2026-06-29T00:00:00Z'),
    feedUrl: 'https://example.com/feed',
    author: { name: 'otnc', email: 'otnc@example.com' },
  },
  items: [
    {
      title: 'post 1',
      id: 'https://example.com/1',
      link: 'https://example.com/1',
      published: new Date('2026-06-29T00:00:00Z'),
      updated: new Date('2026-06-29T01:00:00Z'),
      content: '<p>body</p>',
      categories: [{ term: 'tech' }],
    },
  ],
}

describe('Atom 1.0 conformance (RFC 4287)', () => {
  const xml = toAtom(complete, { feedUrl: 'https://example.com/feed' })

  it('feed carries the three mandatory elements: id, title, updated', () => {
    expect(xml).toContain('<id>https://example.com/</id>')
    expect(xml).toContain('<title>example blog</title>')
    expect(xml).toMatch(/<updated>([^<]+)<\/updated>/)
  })

  it('feed updated is RFC3339 (§3.3 Date Construct)', () => {
    const updated = xml.match(/<feed[\s\S]*?<updated>(.*?)<\/updated>/)?.[1]
    expect(updated).toMatch(RFC3339)
  })

  it('entry carries the three mandatory elements: id, title, updated', () => {
    expect(xml).toContain('<id>https://example.com/1</id>')
    expect(xml).toContain('<title>post 1</title>')
    const entryUpdated = xml.match(/<entry>[\s\S]*?<updated>(.*?)<\/updated>/)?.[1]
    expect(entryUpdated).toMatch(RFC3339)
  })

  it('published, when present, is also RFC3339', () => {
    const published = xml.match(/<published>(.*?)<\/published>/)?.[1]
    expect(published).toMatch(RFC3339)
  })

  it('category carries the required term attribute (§4.2.2)', () => {
    expect(xml).toMatch(/<category term="tech"(\s+scheme="[^"]*")?\/>/)
  })

  it('author carries the required name (§3.2.1) when supplied', () => {
    expect(xml).toMatch(/<author>[\s\S]*<name>otnc<\/name>[\s\S]*<\/author>/)
  })

  it('entry satisfies "no atom:content requires a rel=alternate link" (§4.1.2)', () => {
    // The fixture has both; the rule only needs one. Pin that the compliant shape holds:
    // every <entry> contains <content> or a rel="alternate" <link>.
    const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((m) => m[1])
    expect(entries.length).toBeGreaterThan(0)
    for (const entry of entries) {
      const ok = /<content[\s>]/.test(entry) || /<link rel="alternate"/.test(entry)
      expect(ok).toBe(true)
    }
  })

  it('content type="html" is escaped HTML, not raw markup (§4.1.3.1)', () => {
    expect(xml).toContain('<content type="html">&lt;p&gt;body&lt;/p&gt;</content>')
    expect(xml).not.toContain('<content type="html"><p>')
  })

  it('declares the Atom 1.0 namespace on the root', () => {
    expect(xml).toContain('xmlns="http://www.w3.org/2005/Atom"')
  })
})

describe('Atom 0.3 conformance (draft-nottingham-atom-format, deprecated)', () => {
  const xml = toAtom(complete, { atomVersion: '0.3', feedUrl: 'https://example.com/feed' })

  it('root declares version="0.3" and the 0.3 namespace', () => {
    expect(xml).toContain('<feed version="0.3" xmlns="http://purl.org/atom/ns#"')
  })

  it('feed carries title, id and modified', () => {
    expect(xml).toContain('<title>example blog</title>')
    expect(xml).toContain('<id>https://example.com/</id>')
    const modified = xml.match(/<feed[\s\S]*?<modified>(.*?)<\/modified>/)?.[1]
    expect(modified).toMatch(RFC3339)
  })

  it('entry carries title, id and modified; issued (if present) is also RFC3339', () => {
    expect(xml).toContain('<title>post 1</title>')
    expect(xml).toContain('<id>https://example.com/1</id>')
    const issued = xml.match(/<issued>(.*?)<\/issued>/)?.[1]
    expect(issued).toMatch(RFC3339)
    const entryModified = xml.match(/<entry>[\s\S]*?<modified>(.*?)<\/modified>/)?.[1]
    expect(entryModified).toMatch(RFC3339)
  })

  it('emits the mandatory <issued> even when the item only has updated', () => {
    const out = toAtom(
      {
        ...complete,
        items: [{ ...complete.items[0], published: undefined }],
      },
      { atomVersion: '0.3', suppressDeprecationWarnings: true },
    )
    const issued = out.match(/<issued>(.*?)<\/issued>/)?.[1]
    expect(issued).toMatch(RFC3339)
  })
})

describe('Atom XML serialization (RFC 4287 §2)', () => {
  it('rejects xmlVersion 1.1 — Atom documents are serialized as XML 1.0', () => {
    expect(() => toAtom(complete, { xmlVersion: '1.1' })).toThrow(/XML 1\.0/)
  })
})

describe('WebSub hub discovery (W3C WebSub §4)', () => {
  it('emits one link rel="hub" per hub URL, absolutized', () => {
    const withHub: FeedInput = {
      ...complete,
      options: { ...complete.options, hub: ['/hub1', 'https://hub.example.com/'] },
    }
    const xml = toAtom(withHub, { baseUrl: 'https://example.com' })
    expect(xml).toContain('<link rel="hub" href="https://example.com/hub1"/>')
    expect(xml).toContain('<link rel="hub" href="https://hub.example.com/"/>')
  })

  it('accepts a single hub URL as well as an array', () => {
    const xml = toAtom({
      ...complete,
      options: { ...complete.options, hub: 'https://hub.example.com/' },
    })
    expect(xml).toContain('<link rel="hub" href="https://hub.example.com/"/>')
  })

  it('omits hub links when unset', () => {
    expect(toAtom(complete)).not.toContain('rel="hub"')
  })
})

describe('Atom pagination links (RFC 5005 §3)', () => {
  it('emits link rel="next"/"previous"/"first"/"last" for paging, absolutized', () => {
    const withPaging: FeedInput = {
      ...complete,
      options: {
        ...complete.options,
        paging: {
          next: '/feed?page=3',
          prev: '/feed?page=1',
          first: '/feed?page=1',
          last: '/feed?page=10',
        },
      },
    }
    const xml = toAtom(withPaging, { baseUrl: 'https://example.com' })
    expect(xml).toContain('<link rel="next" href="https://example.com/feed?page=3"/>')
    expect(xml).toContain('<link rel="previous" href="https://example.com/feed?page=1"/>')
    expect(xml).toContain('<link rel="first" href="https://example.com/feed?page=1"/>')
    expect(xml).toContain('<link rel="last" href="https://example.com/feed?page=10"/>')
  })

  it('omits paging links when unset', () => {
    expect(toAtom(complete)).not.toContain('rel="next"')
  })

  it('emits link rel="current" for paging.current, absolutized', () => {
    const withCurrent: FeedInput = {
      ...complete,
      options: { ...complete.options, paging: { current: '/feed' } },
    }
    const xml = toAtom(withCurrent, { baseUrl: 'https://example.com' })
    expect(xml).toContain('<link rel="current" href="https://example.com/feed"/>')
  })

  it('emits link rel="prev-archive"/"next-archive" for the RFC 5005 §4 archive rels, absolutized', () => {
    const withArchiveRels: FeedInput = {
      ...complete,
      options: {
        ...complete.options,
        paging: { prevArchive: '/archive/2', nextArchive: '/archive/4' },
      },
    }
    const xml = toAtom(withArchiveRels, { baseUrl: 'https://example.com' })
    expect(xml).toContain('<link rel="prev-archive" href="https://example.com/archive/2"/>')
    expect(xml).toContain('<link rel="next-archive" href="https://example.com/archive/4"/>')
  })

  it('an archive page emits fh:archive, current and prev-archive together (RFC 5005 §4 shape)', () => {
    const archivePage: FeedInput = {
      ...complete,
      options: {
        ...complete.options,
        paging: { archive: true, current: '/feed', prevArchive: '/archive/2' },
      },
    }
    const xml = toAtom(archivePage, { baseUrl: 'https://example.com' })
    expect(xml).toContain('<fh:archive/>')
    expect(xml).toContain('<link rel="current" href="https://example.com/feed"/>')
    expect(xml).toContain('<link rel="prev-archive" href="https://example.com/archive/2"/>')
  })

  it('emits <fh:complete/> and declares xmlns:fh for paging.complete', () => {
    const withComplete: FeedInput = {
      ...complete,
      options: { ...complete.options, paging: { complete: true } },
    }
    const xml = toAtom(withComplete)
    expect(xml).toContain('xmlns:fh="http://purl.org/syndication/history/1.0"')
    expect(xml).toContain('<fh:complete/>')
    expect(xml).not.toContain('<fh:archive/>')
  })

  it('emits <fh:archive/> and declares xmlns:fh for paging.archive', () => {
    const withArchive: FeedInput = {
      ...complete,
      options: { ...complete.options, paging: { archive: true } },
    }
    const xml = toAtom(withArchive)
    expect(xml).toContain('xmlns:fh="http://purl.org/syndication/history/1.0"')
    expect(xml).toContain('<fh:archive/>')
    expect(xml).not.toContain('<fh:complete/>')
  })

  it('omits xmlns:fh and any fh:* element when paging has no complete/archive', () => {
    const withNext: FeedInput = {
      ...complete,
      options: { ...complete.options, paging: { next: '/feed?page=2' } },
    }
    const xml = toAtom(withNext)
    expect(xml).not.toContain('xmlns:fh')
    expect(xml).not.toContain('fh:complete')
    expect(xml).not.toContain('fh:archive')
  })
})

describe('Atom customXml/customNamespaces escape hatch', () => {
  it('appends customXml after built-in feed/entry elements and merges customNamespaces', () => {
    const withCustom: FeedInput = {
      ...complete,
      options: {
        ...complete.options,
        customNamespaces: { 'xmlns:itunes': 'http://www.itunes.com/dtds/podcast-1.0.dtd' },
        customXml: [{ name: 'itunes:author', text: 'Ada' }],
      },
      items: [{ ...complete.items[0], customXml: [{ name: 'itunes:duration', text: '3:45' }] }],
    }
    const xml = toAtom(withCustom)
    expect(xml).toContain('xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"')
    expect(xml).toContain('<itunes:author>Ada</itunes:author>')
    expect(xml).toContain('<itunes:duration>3:45</itunes:duration>')
    expect(xml.indexOf('<itunes:author>')).toBeLessThan(xml.indexOf('<entry>'))
  })

  it('has no custom fields → no custom elements/namespaces present', () => {
    expect(toAtom(complete)).not.toContain('itunes')
  })
})

describe('Atom feed-level category (RFC 4287 §4.1.1, same element as §4.2.2)', () => {
  it('emits one <category> per feed-level category', () => {
    const withFeedCategories: FeedInput = {
      ...complete,
      options: {
        ...complete.options,
        categories: [{ term: 'tech', scheme: 'https://example.com/cats' }, { term: 'news' }],
      },
    }
    const xml = toAtom(withFeedCategories)
    expect(xml).toContain('<category term="tech" scheme="https://example.com/cats"/>')
    expect(xml).toContain('<category term="news"/>')
  })

  it('omits <category> when unset (the fixture entry has its own, unaffected)', () => {
    const feedLevel = toAtom(complete).split('<entry>')[0]
    expect(feedLevel).not.toContain('<category')
  })
})

describe('Atom icon/logo mapping (RFC 4287 §4.2.8)', () => {
  const branded: FeedInput = {
    ...complete,
    options: {
      ...complete.options,
      image: '/logo.png',
      favicon: '/favicon.ico',
    },
  }

  it('maps image to <logo> and favicon to <icon>, absolutized', () => {
    const xml = toAtom(branded, { baseUrl: 'https://example.com' })
    expect(xml).toContain('<logo>https://example.com/logo.png</logo>')
    expect(xml).toContain('<icon>https://example.com/favicon.ico</icon>')
  })

  it('omits <logo>/<icon> when unset', () => {
    expect(toAtom(complete)).not.toMatch(/<logo>|<icon>/)
  })
})

describe('Atom enclosure mapping (RFC 4287 §4.2.7.2)', () => {
  const withEnclosure: FeedInput = {
    ...complete,
    items: [
      {
        ...complete.items[0],
        enclosure: { url: '/ep1.mp3', type: 'audio/mpeg', length: 12345 },
      },
    ],
  }

  it('Atom 1.0 emits <link rel="enclosure"> with type and length, absolutized', () => {
    const xml = toAtom(withEnclosure, { baseUrl: 'https://example.com' })
    expect(xml).toContain(
      '<link rel="enclosure" href="https://example.com/ep1.mp3" type="audio/mpeg" length="12345"/>',
    )
  })

  it('Atom 1.0 omits the length attribute when unset', () => {
    const xml = toAtom({
      ...withEnclosure,
      items: [
        {
          ...withEnclosure.items[0],
          enclosure: { url: 'https://example.com/ep1.mp3', type: 'audio/mpeg' },
        },
      ],
    })
    expect(xml).toContain(
      '<link rel="enclosure" href="https://example.com/ep1.mp3" type="audio/mpeg"/>',
    )
  })

  it('Atom 0.3 emits <link rel="enclosure"> the same way', () => {
    const xml = toAtom(withEnclosure, {
      atomVersion: '0.3',
      baseUrl: 'https://example.com',
      suppressDeprecationWarnings: true,
    })
    expect(xml).toContain(
      '<link rel="enclosure" href="https://example.com/ep1.mp3" type="audio/mpeg" length="12345"/>',
    )
  })

  it('Atom 0.3 omits the length attribute when unset, like 1.0', () => {
    const xml = toAtom(
      {
        ...withEnclosure,
        items: [
          {
            ...withEnclosure.items[0],
            enclosure: { url: 'https://example.com/ep1.mp3', type: 'audio/mpeg' },
          },
        ],
      },
      { atomVersion: '0.3', suppressDeprecationWarnings: true },
    )
    expect(xml).toContain(
      '<link rel="enclosure" href="https://example.com/ep1.mp3" type="audio/mpeg"/>',
    )
  })

  it('no enclosure → no rel="enclosure" link', () => {
    expect(toAtom(complete)).not.toContain('rel="enclosure"')
  })

  it('ignores enclosure.duration (no Atom attribute for it)', () => {
    const xml = toAtom({
      ...withEnclosure,
      items: [
        {
          ...withEnclosure.items[0],
          enclosure: { url: 'https://example.com/ep1.mp3', type: 'audio/mpeg', duration: 1800 },
        },
      ],
    })
    expect(xml).toContain(
      '<link rel="enclosure" href="https://example.com/ep1.mp3" type="audio/mpeg"/>',
    )
    expect(xml).not.toContain('1800')
  })

  it('ignores enclosure.title (JSON Feed-only attachment field, no Atom mapping)', () => {
    const xml = toAtom({
      ...withEnclosure,
      items: [
        {
          ...withEnclosure.items[0],
          enclosure: {
            url: 'https://example.com/ep1.mp3',
            type: 'audio/mpeg',
            title: 'Episode 1',
          },
        },
      ],
    })
    expect(xml).toContain(
      '<link rel="enclosure" href="https://example.com/ep1.mp3" type="audio/mpeg"/>',
    )
    expect(xml).not.toContain('Episode 1')
  })
})
