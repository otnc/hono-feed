import { describe, expect, it } from 'vitest'
import type { FeedInput } from '../../types'
import { toRSS } from './index'

// A "spec-complete" input: every field a conformant feed needs is filled in, so these
// tests describe the guarantees hono-feed gives you when you supply everything it asks
// for — not the behaviour of partially-filled input (see docs/rss-atom-json-audit.md for
// gaps that only show up when optional-but-spec-required fields are omitted).
const complete: FeedInput = {
  options: {
    title: 'example blog',
    link: 'https://example.com/',
    description: 'diary',
    language: 'en',
    updated: new Date('2026-06-29T00:00:00Z'),
    feedUrl: 'https://example.com/feed',
    image: 'https://example.com/icon.png',
  },
  items: [
    {
      title: 'post 1',
      id: 'https://example.com/1',
      link: 'https://example.com/1',
      description: 'summary',
      published: new Date('2026-06-29T00:00:00Z'),
      content: '<p>body</p>',
      enclosure: { url: 'https://example.com/a.mp3', type: 'audio/mpeg', length: 123 },
    },
  ],
}

const RFC822 = /^[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/

describe('RSS 2.0 conformance (rssboard.org/rss-specification)', () => {
  const xml = toRSS(complete, { rssVersion: '2.0' })

  it('channel carries the three required elements (title/link/description)', () => {
    expect(xml).toMatch(/<channel>[\s\S]*<title>example blog<\/title>/)
    expect(xml).toContain('<link>https://example.com/</link>')
    expect(xml).toContain('<description>diary</description>')
  })

  it('item carries at least title (RSS items require title or description)', () => {
    expect(xml).toContain('<title>post 1</title>')
  })

  it('pubDate/lastBuildDate are RFC822', () => {
    const pubDate = xml.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]
    const lastBuildDate = xml.match(/<lastBuildDate>(.*?)<\/lastBuildDate>/)?.[1]
    expect(pubDate).toMatch(RFC822)
    expect(lastBuildDate).toMatch(RFC822)
  })

  it('enclosure carries url/type/length (all required attributes)', () => {
    expect(xml).toMatch(/<enclosure url="[^"]+" type="[^"]+" length="\d+"\/>/)
  })

  it('image carries url/title/link (all required sub-elements)', () => {
    const img = xml.match(/<image>([\s\S]*?)<\/image>/)?.[1] ?? ''
    expect(img).toContain('<url>https://example.com/icon.png</url>')
    expect(img).toContain('<title>example blog</title>')
    expect(img).toContain('<link>https://example.com/</link>')
  })

  it('guid isPermaLink is a valid boolean literal', () => {
    expect(xml).toMatch(/<guid isPermaLink="(true|false)">/)
  })
})

// 0.91-0.94 share the <rss> structure but define far fewer elements than 2.0 (0.91 has no
// item pubDate/enclosure/category, no channel generator/ttl). Only assert what every
// version in the lineage verifiably requires: the channel trio and item title.
describe('RSS 0.91-0.94 conformance (shared <rss> lineage requirements only)', () => {
  for (const rssVersion of ['0.94', '0.93', '0.92', '0.91'] as const) {
    it(`${rssVersion}: channel carries title/link/description and the version attribute`, () => {
      const xml = toRSS(complete, { rssVersion })
      expect(xml).toContain(`<rss version="${rssVersion}"`)
      expect(xml).toMatch(/<channel>[\s\S]*<title>example blog<\/title>/)
      expect(xml).toContain('<link>https://example.com/</link>')
      expect(xml).toContain('<description>diary</description>')
      expect(xml).toContain('<title>post 1</title>')
    })
  }
})

describe('RSS 0.90 conformance (Netscape RDF Site Summary 0.90)', () => {
  const xml = toRSS(complete, { rssVersion: '0.90' })

  it('declares both required namespaces on rdf:RDF', () => {
    expect(xml).toContain('xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"')
    expect(xml).toContain('xmlns="http://my.netscape.com/rdf/simple/0.9/"')
  })

  it('channel carries title/link/description', () => {
    expect(xml).toMatch(/<channel>[\s\S]*<title>example blog<\/title>/)
    expect(xml).toContain('<link>https://example.com/</link>')
    expect(xml).toContain('<description>diary</description>')
  })

  it('item carries title and link (both required by the 0.90 spec)', () => {
    expect(xml).toMatch(
      /<item>[\s\S]*<title>post 1<\/title>[\s\S]*<link>https:\/\/example\.com\/1<\/link>/,
    )
  })
})

describe('RSS 1.0 conformance (web.resource.org/rss/1.0/spec, RDF Site Summary)', () => {
  const xml = toRSS(complete, { rssVersion: '1.0', feedUrl: 'https://example.com/feed' })

  it('declares rdf/rss1.0/dc namespaces on rdf:RDF', () => {
    expect(xml).toContain('xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"')
    expect(xml).toContain('xmlns="http://purl.org/rss/1.0/"')
    expect(xml).toContain('xmlns:dc="http://purl.org/dc/elements/1.1/"')
  })

  it('channel rdf:about is a URI and carries title/link/description', () => {
    expect(xml).toContain('<channel rdf:about="https://example.com/feed">')
    expect(xml).toContain('<title>example blog</title>')
    expect(xml).toContain('<link>https://example.com/</link>')
    expect(xml).toContain('<description>diary</description>')
  })

  it('the <items> rdf:Seq lists exactly one rdf:li per item, matching each item rdf:about', () => {
    const seqResources = [...xml.matchAll(/<rdf:li rdf:resource="([^"]+)"\/>/g)].map((m) => m[1])
    const itemAbouts = [...xml.matchAll(/<item rdf:about="([^"]+)">/g)].map((m) => m[1])
    expect(seqResources).toEqual(itemAbouts)
    expect(seqResources).toEqual(['https://example.com/1'])
  })

  it('item carries title and link (both mandatory per the 1.0 spec)', () => {
    expect(xml).toMatch(
      /<item rdf:about="[^"]+">[\s\S]*<title>post 1<\/title>[\s\S]*<link>https:\/\/example\.com\/1<\/link>/,
    )
  })
})

describe('RSS 1.1 conformance (inamidst.com/rss1.1/spec)', () => {
  const xml = toRSS(complete, { rssVersion: '1.1', feedUrl: 'https://example.com/feed' })

  it('root is <Channel> in the rss1.1 namespace with rdf:about', () => {
    expect(xml).toContain('<Channel xmlns="http://purl.org/net/rss1.1#"')
    expect(xml).toContain('rdf:about="https://example.com/feed"')
  })

  it('channel carries title/link/description directly (no rdf:Seq table of contents)', () => {
    expect(xml).toContain('<title>example blog</title>')
    expect(xml).toContain('<link>https://example.com/</link>')
    expect(xml).toContain('<description>diary</description>')
    expect(xml).not.toContain('rdf:Seq')
  })

  it('item carries title and link, nested directly under <items>', () => {
    // <items[^>]*> tolerates attributes: the spec requires rdf:parseType="Collection" on
    // <items>, which the serializer does not yet emit (tracked in issue #15).
    expect(xml).toMatch(
      /<items[^>]*>[\s\S]*<item rdf:about="[^"]+">[\s\S]*<title>post 1<\/title>[\s\S]*<link>https:\/\/example\.com\/1<\/link>[\s\S]*<\/item>[\s\S]*<\/items>/,
    )
  })
})
