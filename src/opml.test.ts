import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { type OpmlInput, serveOpml, toOPML } from './opml'

const input: OpmlInput = {
  title: 'My <subscriptions>',
  dateCreated: new Date('2026-01-01T00:00:00Z'),
  dateModified: new Date('2026-02-03T04:05:06Z'),
  ownerName: 'Ann',
  ownerEmail: 'ann@example.com',
  ownerId: '/ann',
  outlines: [
    { text: 'Blog & Co', xmlUrl: '/feed.xml', htmlUrl: '/', description: 'd', language: 'en' },
    {
      text: 'Tech',
      category: '/Tech',
      children: [
        { text: 'Atom one', type: 'atom', xmlUrl: 'https://a.example/atom' },
        { text: 'Plain', title: 'Plain title' },
      ],
    },
  ],
}

describe('toOPML', () => {
  it('produces an OPML 2.0 document with head and body', () => {
    const out = toOPML(input, { baseUrl: 'https://example.com' })
    expect(out.startsWith('<?xml version="1.0" encoding="utf-8"?><opml version="2.0"><head>')).toBe(
      true,
    )
    expect(out).toContain('<title>My &lt;subscriptions&gt;</title>')
    expect(out).toContain('<ownerName>Ann</ownerName><ownerEmail>ann@example.com</ownerEmail>')
    expect(out).toContain('<ownerId>https://example.com/ann</ownerId>')
    expect(out.endsWith('</body></opml>')).toBe(true)
  })

  it('writes dates in RFC 822 form (OPML 2.0 §head)', () => {
    const out = toOPML(input)
    expect(out).toContain('<dateCreated>Thu, 01 Jan 2026 00:00:00 GMT</dateCreated>')
    expect(out).toContain('<dateModified>Tue, 03 Feb 2026 04:05:06 GMT</dateModified>')
  })

  it('defaults type to rss for an outline with xmlUrl, absolutizes URLs and escapes text', () => {
    const out = toOPML(input, { baseUrl: 'https://example.com' })
    expect(out).toContain(
      '<outline text="Blog &amp; Co" type="rss" xmlUrl="https://example.com/feed.xml" htmlUrl="https://example.com/" description="d" language="en"/>',
    )
    expect(out).toContain('<outline text="Atom one" type="atom" xmlUrl="https://a.example/atom"/>')
  })

  it('nests children inside a folder outline, which has no type', () => {
    const out = toOPML(input)
    expect(out).toContain('<outline text="Tech" category="/Tech"><outline text="Atom one"')
    expect(out).toContain('<outline text="Plain" title="Plain title"/></outline>')
  })

  it('omits unset head elements and accepts an empty list', () => {
    expect(toOPML({ outlines: [] })).toBe(
      '<?xml version="1.0" encoding="utf-8"?><opml version="2.0"><head/><body/></opml>',
    )
  })

  it('pretty-prints and honours xmlVersion', () => {
    const out = toOPML({ outlines: [{ text: 'a' }] }, { pretty: true, xmlVersion: '1.1' })
    expect(out.startsWith('<?xml version="1.1" encoding="utf-8"?>\n<opml version="2.0">')).toBe(
      true,
    )
    expect(out).toContain('\n  <body>\n    <outline text="a"/>\n  </body>')
  })

  it('requires text on every outline, including nested ones', () => {
    expect(() => toOPML({ outlines: [{ text: '' }] })).toThrow(/OPML outlines\[0\] "text"/)
    expect(() =>
      toOPML({ outlines: [{ text: 'a', children: [{ text: 'ok' }, { text: '' }] }] }),
    ).toThrow(/outlines\[0\]\.children\[1\] "text" is required/)
  })
})

describe('serveOpml', () => {
  const build = (options?: Parameters<typeof serveOpml>[2]) => {
    const app = new Hono()
    app.get('/subs.opml', (c) => serveOpml(c, input, options))
    return app
  }
  const url = 'https://example.com/subs.opml'

  it('serves the document with OPML content type, caching headers and the request origin as base', async () => {
    const res = await build().request(url)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/x-opml; charset=utf-8')
    expect(res.headers.get('cache-control')).toBe('public, max-age=3600')
    expect(res.headers.get('etag')).toMatch(/^W\/"[^"]+"$/)
    expect(res.headers.get('last-modified')).toBe('Tue, 03 Feb 2026 04:05:06 GMT')
    expect(await res.text()).toContain('xmlUrl="https://example.com/feed.xml"')
  })

  it('answers 304 to a matching If-None-Match and a satisfied If-Modified-Since', async () => {
    const app = build()
    const first = await app.request(url)
    const etag = first.headers.get('etag') as string
    const byEtag = await app.request(url, { headers: { 'if-none-match': etag } })
    expect(byEtag.status).toBe(304)
    expect(await byEtag.text()).toBe('')

    const byDate = await app.request(url, {
      headers: { 'if-modified-since': 'Tue, 03 Feb 2026 04:05:06 GMT' },
    })
    expect(byDate.status).toBe(304)
  })

  it('returns an empty body with Content-Length for HEAD', async () => {
    const res = await build().request(url, { method: 'HEAD' })
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('')
    expect(Number(res.headers.get('content-length'))).toBeGreaterThan(0)
  })

  it('lets cacheControl, etag, lastModified and baseUrl be configured', async () => {
    const res = await build({
      cacheControl: false,
      etag: false,
      lastModified: false,
      baseUrl: 'https://cdn.example',
    }).request(url)
    expect(res.headers.get('cache-control')).toBeNull()
    expect(res.headers.get('etag')).toBeNull()
    expect(res.headers.get('last-modified')).toBeNull()
    expect(await res.text()).toContain('xmlUrl="https://cdn.example/feed.xml"')
  })
})
