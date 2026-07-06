import { describe, expect, it } from 'vitest'
import type { FeedInput } from '../../types'
import { toRSS } from './index'

const input: FeedInput = {
  options: {
    title: 'example blog',
    link: 'https://example.com/',
    description: 'diary',
    language: 'en',
    updated: new Date('2026-06-29T00:00:00Z'),
    feedUrl: 'https://example.com/feed',
  },
  items: [
    {
      title: 'post 1',
      link: 'https://example.com/1',
      published: new Date('2026-06-29T00:00:00Z'),
      content: '<p>body</p>',
    },
  ],
}

describe('toRSS', () => {
  const xml = toRSS(input, { baseUrl: 'https://example.com', feedUrl: 'https://example.com/feed' })

  it('emits the declaration, atom:self, RFC822 date, CDATA content and guid', () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="utf-8"?>')).toBe(true)
    expect(xml).toContain('<rss version="2.0"')
    expect(xml).toContain('<atom:link href="https://example.com/feed" rel="self"')
    expect(xml).toContain('<pubDate>Mon, 29 Jun 2026 00:00:00 GMT</pubDate>')
    expect(xml).toContain('<content:encoded><![CDATA[<p>body</p>]]></content:encoded>')
    expect(xml).toContain('<guid isPermaLink="true">https://example.com/1</guid>')
  })

  it('emits one atom:link rel="hub" per hub URL, absolutized', () => {
    const out = toRSS(
      { ...input, options: { ...input.options, hub: ['/hub1', 'https://hub.example.com/'] } },
      { baseUrl: 'https://example.com', feedUrl: 'https://example.com/feed' },
    )
    expect(out).toContain('<atom:link href="https://example.com/hub1" rel="hub"/>')
    expect(out).toContain('<atom:link href="https://hub.example.com/" rel="hub"/>')
  })

  it('accepts a single hub URL as well as an array', () => {
    const out = toRSS({ ...input, options: { ...input.options, hub: 'https://hub.example.com/' } })
    expect(out).toContain('<atom:link href="https://hub.example.com/" rel="hub"/>')
  })

  it('omits hub links when unset', () => {
    expect(toRSS(input)).not.toContain('rel="hub"')
  })

  it('maps ttl, enclosure, email author and category domain', () => {
    const out = toRSS({
      options: { title: 't', link: 'https://example.com/', ttl: 60 },
      items: [
        {
          title: 'a',
          link: 'https://example.com/1',
          author: { name: 'otnc', email: 'otnc@example.com' },
          categories: [{ term: 'tech', scheme: 'https://example.com/cats' }],
          enclosure: { url: 'https://example.com/a.mp3', type: 'audio/mpeg', length: 123 },
        },
      ],
    })
    expect(out).toContain('<ttl>60</ttl>')
    expect(out).toContain('<author>otnc@example.com (otnc)</author>')
    expect(out).toContain('<category domain="https://example.com/cats">tech</category>')
    expect(out).toContain(
      '<enclosure url="https://example.com/a.mp3" type="audio/mpeg" length="123"/>',
    )
  })

  it('honours xmlVersion and rssVersion', () => {
    const out = toRSS(input, { xmlVersion: '1.1', rssVersion: '0.92' })
    expect(out.startsWith('<?xml version="1.1" encoding="utf-8"?>')).toBe(true)
    expect(out).toContain('<rss version="0.92"')
  })

  it('splits ]]> inside CDATA', () => {
    const out = toRSS({ ...input, items: [{ ...input.items[0], content: 'a]]>b' }] })
    expect(out).toContain('<![CDATA[a]]]]><![CDATA[>b]]>')
  })

  it('escapes markup in titles and strips control chars from text and CDATA', () => {
    const out = toRSS({
      options: { title: 'A & B <ok>', link: 'https://example.com/' },
      // \u0007 (a bell control char) is invalid XML and must not reach the output, in either
      // the escaped title path or the CDATA content path.
      items: [{ title: 'x\u0007y & z', link: 'https://example.com/1', content: 'a\u0007b' }],
    })
    expect(out).toContain('<title>A &amp; B &lt;ok&gt;</title>')
    expect(out).toContain('<title>xy &amp; z</title>')
    expect(out).toContain('<content:encoded><![CDATA[ab]]></content:encoded>')
    expect(out).not.toContain('\u0007')
  })

  it('emits channel copyright when set', () => {
    const out = toRSS({ ...input, options: { ...input.options, copyright: '© otnc' } })
    expect(out).toContain('<copyright>© otnc</copyright>')
  })

  it('marks guid isPermaLink="false" when the id differs from the link', () => {
    const out = toRSS({
      options: { title: 't', link: 'https://example.com/' },
      items: [{ title: 'a', id: 'urn:uuid:1', link: 'https://example.com/1' }],
    })
    expect(out).toContain('<guid isPermaLink="false">urn:uuid:1</guid>')
  })

  it('omits guid when the item has neither id nor link', () => {
    const out = toRSS({
      options: { title: 't', link: 'https://example.com/' },
      items: [{ title: 'a' }],
    })
    expect(out).not.toContain('<guid')
  })

  it('emits a bare email <author> when the item author has no name', () => {
    const out = toRSS({
      options: { title: 't', link: 'https://example.com/' },
      items: [
        {
          title: 'a',
          link: 'https://example.com/1',
          author: { name: '', email: 'otnc@example.com' },
        },
      ],
    })
    expect(out).toContain('<author>otnc@example.com</author>')
  })

  it('defaults enclosure length to 0 when omitted', () => {
    const out = toRSS({
      options: { title: 't', link: 'https://example.com/' },
      items: [
        {
          title: 'a',
          link: 'https://example.com/1',
          enclosure: { url: 'https://example.com/a.mp3', type: 'audio/mpeg' },
        },
      ],
    })
    expect(out).toContain(
      '<enclosure url="https://example.com/a.mp3" type="audio/mpeg" length="0"/>',
    )
  })

  it('omits xmlns:content when no item has content', () => {
    const out = toRSS({
      options: { title: 't', link: 'https://example.com/' },
      items: [{ title: 'a', link: 'https://example.com/1' }],
    })
    expect(out).not.toContain('xmlns:content')
  })

  it('emits the version attribute for 0.93 / 0.94', () => {
    expect(toRSS(input, { rssVersion: '0.94' })).toContain('<rss version="0.94"')
  })

  it('emits RSS 0.90 (RDF) when rssVersion is 0.90', () => {
    const out = toRSS(input, { rssVersion: '0.90' })
    expect(out).toContain('<rdf:RDF')
    expect(out).toContain('xmlns="http://my.netscape.com/rdf/simple/0.9/"')
    expect(out).toContain('<channel>')
    expect(out).toContain('<item>')
    expect(out).toContain('<link>https://example.com/1</link>')
  })

  it('emits RSS 1.0 (RDF) when rssVersion is 1.0', () => {
    const out = toRSS(input, { rssVersion: '1.0', feedUrl: 'https://example.com/feed' })
    expect(out).toContain('<rdf:RDF')
    expect(out).toContain('xmlns="http://purl.org/rss/1.0/"')
    expect(out).toContain('<channel rdf:about="https://example.com/feed">')
    expect(out).toContain('<rdf:li rdf:resource="https://example.com/1"/>')
    expect(out).toContain('<item rdf:about="https://example.com/1">')
    expect(out).toContain('<dc:date>2026-06-29T00:00:00.000Z</dc:date>')
    expect(out).toContain('<content:encoded><![CDATA[<p>body</p>]]></content:encoded>')
  })

  it('emits RSS 1.1 (<Channel>) when rssVersion is 1.1', () => {
    const out = toRSS(input, { rssVersion: '1.1', feedUrl: 'https://example.com/feed' })
    expect(out).toContain('<Channel xmlns="http://purl.org/net/rss1.1#"')
    expect(out).toContain('rdf:about="https://example.com/feed"')
    expect(out).toContain('<item rdf:about="https://example.com/1">')
    expect(out).not.toContain('rdf:Seq')
  })

  it('0.91 requires a per-item <link>, even though later 0.9x/2.0 versions do not', () => {
    const noItemLink: FeedInput = {
      options: { title: 't', link: 'https://example.com/', language: 'en' },
      items: [{ title: 'a', id: 'https://example.com/1' }],
    }
    expect(() => toRSS(noItemLink, { rssVersion: '0.91' })).toThrow(/0.91 item requires "link"/)
    expect(() => toRSS(noItemLink, { rssVersion: '0.92' })).not.toThrow()
  })

  describe('RSS 0.90 (RDF)', () => {
    it('requires link or feedUrl for the channel', () => {
      expect(() => toRSS({ options: { title: 't' }, items: [] }, { rssVersion: '0.90' })).toThrow(
        /RSS 0.90 requires "link"/,
      )
    })

    it('requires link or id for each item', () => {
      expect(() =>
        toRSS(
          { options: { title: 't', link: 'https://example.com/' }, items: [{ title: 'a' }] },
          { rssVersion: '0.90' },
        ),
      ).toThrow(/RSS 0.90 item requires "link"/)
    })

    it('emits an <image> when options.image is set', () => {
      const out = toRSS(
        {
          options: {
            title: 't',
            link: 'https://example.com/',
            image: 'https://example.com/icon.png',
          },
          items: [],
        },
        { rssVersion: '0.90' },
      )
      expect(out).toContain('<image>')
      expect(out).toContain('<url>https://example.com/icon.png</url>')
    })
  })

  describe('RSS 1.0 (RDF)', () => {
    it('requires a feedUrl or link', () => {
      expect(() => toRSS({ options: { title: 't' }, items: [] }, { rssVersion: '1.0' })).toThrow(
        /RSS 1.0 requires "feedUrl" or "link"/,
      )
    })

    it('emits dc:rights when copyright is set', () => {
      const out = toRSS(
        { options: { title: 't', link: 'https://example.com/', copyright: '© otnc' }, items: [] },
        { rssVersion: '1.0' },
      )
      expect(out).toContain('<dc:rights>© otnc</dc:rights>')
    })

    it('emits an image with an rdf:resource and a channel <image> back-reference', () => {
      const out = toRSS(
        {
          options: {
            title: 't',
            link: 'https://example.com/',
            image: 'https://example.com/icon.png',
          },
          items: [],
        },
        { rssVersion: '1.0' },
      )
      expect(out).toContain('<image rdf:resource="https://example.com/icon.png"/>')
      expect(out).toContain('<image rdf:about="https://example.com/icon.png">')
    })

    it('omits the image <link> when the channel has no home link', () => {
      const out = toRSS(
        {
          options: {
            title: 't',
            feedUrl: 'https://example.com/feed',
            image: 'https://example.com/icon.png',
          },
          items: [],
        },
        { rssVersion: '1.0', feedUrl: 'https://example.com/feed' },
      )
      const img = out.match(/<image rdf:about="[^"]+">([\s\S]*?)<\/image>/)?.[1] ?? ''
      expect(img).not.toContain('<link>')
    })

    it('emits dc:creator for the item author', () => {
      const out = toRSS(
        {
          options: { title: 't', link: 'https://example.com/' },
          items: [{ title: 'a', link: 'https://example.com/1', author: { name: 'otnc' } }],
        },
        { rssVersion: '1.0' },
      )
      expect(out).toContain('<dc:creator>otnc</dc:creator>')
    })
  })

  describe('RSS 1.1 (<Channel>)', () => {
    it('requires a feedUrl or link', () => {
      expect(() => toRSS({ options: { title: 't' }, items: [] }, { rssVersion: '1.1' })).toThrow(
        /RSS 1.1 requires "feedUrl" or "link"/,
      )
    })

    it('emits dc:rights and xml:lang when set', () => {
      const out = toRSS(
        {
          options: {
            title: 't',
            link: 'https://example.com/',
            copyright: '© otnc',
            language: 'en',
          },
          items: [],
        },
        { rssVersion: '1.1' },
      )
      expect(out).toContain('<dc:rights>© otnc</dc:rights>')
      expect(out).toContain('xml:lang="en"')
    })

    it('falls back to the feed URI for the channel <link> when the channel has no home link', () => {
      const out = toRSS(
        { options: { title: 't', feedUrl: 'https://example.com/feed' }, items: [] },
        { rssVersion: '1.1', feedUrl: 'https://example.com/feed' },
      )
      expect(out).toContain('<link>https://example.com/feed</link>')
    })
  })

  it('emits dc:subject per category in RSS 1.0/1.1 items', () => {
    const withCategory: FeedInput = {
      options: { title: 't', link: 'https://example.com/', feedUrl: 'https://example.com/feed' },
      items: [
        {
          title: 'a',
          link: 'https://example.com/1',
          categories: [{ term: 'tech' }, { term: 'news' }],
        },
      ],
    }
    const rss10 = toRSS(withCategory, { rssVersion: '1.0', feedUrl: 'https://example.com/feed' })
    expect(rss10).toContain('<dc:subject>tech</dc:subject>')
    expect(rss10).toContain('<dc:subject>news</dc:subject>')

    const rss11 = toRSS(withCategory, { rssVersion: '1.1', feedUrl: 'https://example.com/feed' })
    expect(rss11).toContain('<dc:subject>tech</dc:subject>')
    expect(rss11).toContain('<dc:subject>news</dc:subject>')
  })

  it('throws when an RSS 1.0/1.1 item has neither link nor id', () => {
    const noItemUri: FeedInput = {
      options: { title: 't', link: 'https://example.com/', feedUrl: 'https://example.com/feed' },
      items: [{ title: 'a' }],
    }
    expect(() =>
      toRSS(noItemUri, { rssVersion: '1.0', feedUrl: 'https://example.com/feed' }),
    ).toThrow(/RSS 1.0 item requires "link" or "id"/)
    expect(() =>
      toRSS(noItemUri, { rssVersion: '1.1', feedUrl: 'https://example.com/feed' }),
    ).toThrow(/RSS 1.1 item requires "link" or "id"/)
  })
})
