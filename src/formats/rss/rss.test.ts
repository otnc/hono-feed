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
})
