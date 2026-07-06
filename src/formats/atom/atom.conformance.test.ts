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
