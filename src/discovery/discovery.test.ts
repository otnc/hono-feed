import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { feedLinkHeader, feedLinks, feedLinksHtml } from './index'

describe('feedLinks', () => {
  it('builds one entry per configured format, with the shared title', () => {
    const links = feedLinks({
      title: 'My Blog',
      rss: '/feed.rss',
      atom: '/feed.atom',
      json: '/feed.json',
    })
    expect(links).toEqual([
      { rel: 'alternate', type: 'application/rss+xml', href: '/feed.rss', title: 'My Blog' },
      { rel: 'alternate', type: 'application/atom+xml', href: '/feed.atom', title: 'My Blog' },
      { rel: 'alternate', type: 'application/feed+json', href: '/feed.json', title: 'My Blog' },
    ])
  })

  it('omits a format entirely when its URL is unset', () => {
    const links = feedLinks({ rss: '/feed.rss' })
    expect(links).toHaveLength(1)
    expect(links[0].type).toBe('application/rss+xml')
  })

  it('returns [] when no format URL is set', () => {
    expect(feedLinks({})).toEqual([])
  })

  it('omits title from each link when unset', () => {
    const [link] = feedLinks({ rss: '/feed.rss' })
    expect(link.title).toBeUndefined()
  })

  it('absolutizes each href against baseUrl when set', () => {
    const links = feedLinks({ rss: '/feed.rss', baseUrl: 'https://example.com' })
    expect(links[0].href).toBe('https://example.com/feed.rss')
  })

  it('leaves hrefs relative when baseUrl is unset', () => {
    const links = feedLinks({ rss: '/feed.rss' })
    expect(links[0].href).toBe('/feed.rss')
  })
})

describe('feedLinksHtml', () => {
  it('renders one <link> tag per format, in rel/type/title/href order', () => {
    const html = feedLinksHtml({ title: 'My Blog', rss: '/feed.rss' })
    expect(html).toBe(
      '<link rel="alternate" type="application/rss+xml" title="My Blog" href="/feed.rss">',
    )
  })

  it('omits the title attribute when unset', () => {
    const html = feedLinksHtml({ rss: '/feed.rss' })
    expect(html).toBe('<link rel="alternate" type="application/rss+xml" href="/feed.rss">')
  })

  it('escapes attribute values (title, href)', () => {
    const html = feedLinksHtml({ title: 'A & B "quoted"', rss: '/feed.rss?a=1&b=2' })
    expect(html).toContain('title="A &amp; B &quot;quoted&quot;"')
    expect(html).toContain('href="/feed.rss?a=1&amp;b=2"')
  })

  it('concatenates multiple formats with no separator', () => {
    const html = feedLinksHtml({ rss: '/feed.rss', atom: '/feed.atom' })
    expect(html).toBe(
      '<link rel="alternate" type="application/rss+xml" href="/feed.rss">' +
        '<link rel="alternate" type="application/atom+xml" href="/feed.atom">',
    )
  })

  it('returns an empty string when no format URL is set', () => {
    expect(feedLinksHtml({})).toBe('')
  })
})

describe('feedLinkHeader', () => {
  function htmlApp() {
    const app = new Hono()
    app.use('*', feedLinkHeader({ rss: '/feed.rss', atom: '/feed.atom' }))
    app.get('/page', (c) => c.html('<p>hi</p>'))
    app.get('/data', (c) => c.json({ ok: true }))
    return app
  }

  it('appends one Link header per configured format to an HTML response', async () => {
    const res = await htmlApp().request('/page')
    expect(res.headers.get('content-type')).toContain('text/html')
    const links = res.headers.get('link')
    expect(links).toBe(
      '</feed.rss>; rel="alternate"; type="application/rss+xml", </feed.atom>; rel="alternate"; type="application/atom+xml"',
    )
  })

  it('does not add a Link header to a non-HTML response', async () => {
    const res = await htmlApp().request('/data')
    expect(res.headers.get('link')).toBeNull()
  })

  it('adds no Link header at all when no format URL is configured', async () => {
    const app = new Hono()
    app.use('*', feedLinkHeader({}))
    app.get('/page', (c) => c.html('<p>hi</p>'))
    const res = await app.request('/page')
    expect(res.headers.get('link')).toBeNull()
  })

  it('includes a title parameter when title is set', async () => {
    const app = new Hono()
    app.use('*', feedLinkHeader({ title: 'My Blog', rss: '/feed.rss' }))
    app.get('/page', (c) => c.html('<p>hi</p>'))
    const res = await app.request('/page')
    expect(res.headers.get('link')).toBe(
      '</feed.rss>; rel="alternate"; type="application/rss+xml"; title="My Blog"',
    )
  })

  it('serializes a non-ASCII title as RFC 8187 title* instead of crashing (previously a 500)', async () => {
    const app = new Hono()
    app.use('*', feedLinkHeader({ title: '日本語のブログ', rss: '/feed.rss' }))
    app.get('/page', (c) => c.html('<p>hi</p>'))
    const res = await app.request('/page')
    expect(res.status).toBe(200)
    expect(res.headers.get('link')).toBe(
      `</feed.rss>; rel="alternate"; type="application/rss+xml"; title*=UTF-8''%E6%97%A5%E6%9C%AC%E8%AA%9E%E3%81%AE%E3%83%96%E3%83%AD%E3%82%B0`,
    )
  })

  it('a title containing a double quote falls back to title* (quoted-string stays legal)', async () => {
    const app = new Hono()
    app.use('*', feedLinkHeader({ title: 'My "quoted" blog', rss: '/feed.rss' }))
    app.get('/page', (c) => c.html('<p>hi</p>'))
    const res = await app.request('/page')
    expect(res.headers.get('link')).toBe(
      `</feed.rss>; rel="alternate"; type="application/rss+xml"; title*=UTF-8''My%20%22quoted%22%20blog`,
    )
  })

  it('a title containing a backslash falls back to title* too', async () => {
    const app = new Hono()
    app.use('*', feedLinkHeader({ title: String.raw`a\b`, rss: '/feed.rss' }))
    app.get('/page', (c) => c.html('<p>hi</p>'))
    const res = await app.request('/page')
    expect(res.headers.get('link')).toBe(
      `</feed.rss>; rel="alternate"; type="application/rss+xml"; title*=UTF-8''a%5Cb`,
    )
  })

  it("title* percent-encodes RFC 8187 non-attr-chars that encodeURIComponent leaves raw (*'())", async () => {
    const app = new Hono()
    app.use('*', feedLinkHeader({ title: "Ada's *(blog)* 日記", rss: '/feed.rss' }))
    app.get('/page', (c) => c.html('<p>hi</p>'))
    const res = await app.request('/page')
    expect(res.headers.get('link')).toBe(
      `</feed.rss>; rel="alternate"; type="application/rss+xml"; title*=UTF-8''Ada%27s%20%2A%28blog%29%2A%20%E6%97%A5%E8%A8%98`,
    )
  })

  it('percent-encodes a non-ASCII relative href instead of crashing (previously a 500)', async () => {
    const app = new Hono()
    app.use('*', feedLinkHeader({ rss: '/フィード.rss' }))
    app.get('/page', (c) => c.html('<p>hi</p>'))
    const res = await app.request('/page')
    expect(res.status).toBe(200)
    expect(res.headers.get('link')).toBe(
      '</%E3%83%95%E3%82%A3%E3%83%BC%E3%83%89.rss>; rel="alternate"; type="application/rss+xml"',
    )
  })

  it('percent-encodes a non-BMP character (surrogate pair) as its real code point, not U+FFFD', async () => {
    const app = new Hono()
    app.use('*', feedLinkHeader({ rss: 'https://example.com/😀/feed.rss' }))
    app.get('/page', (c) => c.html('<p>hi</p>'))
    const res = await app.request('/page')
    expect(res.headers.get('link')).toBe(
      '<https://example.com/%F0%9F%98%80/feed.rss>; rel="alternate"; type="application/rss+xml"',
    )
  })

  it('percent-encodes a space in the href so the <URI-Reference> framing stays legal', async () => {
    const app = new Hono()
    app.use('*', feedLinkHeader({ rss: '/my feed.rss' }))
    app.get('/page', (c) => c.html('<p>hi</p>'))
    const res = await app.request('/page')
    expect(res.headers.get('link')).toBe(
      '</my%20feed.rss>; rel="alternate"; type="application/rss+xml"',
    )
  })

  it('does not double-encode an href that is already percent-encoded (e.g. via baseUrl)', async () => {
    const app = new Hono()
    app.use('*', feedLinkHeader({ rss: '/フィード.rss', baseUrl: 'https://example.com' }))
    app.get('/page', (c) => c.html('<p>hi</p>'))
    const res = await app.request('/page')
    expect(res.headers.get('link')).toBe(
      '<https://example.com/%E3%83%95%E3%82%A3%E3%83%BC%E3%83%89.rss>; rel="alternate"; type="application/rss+xml"',
    )
  })

  it('adds the Link header to application/xhtml+xml responses too', async () => {
    const app = new Hono()
    app.use('*', feedLinkHeader({ rss: '/feed.rss' }))
    app.get('/page', (c) => c.body('<html/>', 200, { 'Content-Type': 'application/xhtml+xml' }))
    const res = await app.request('/page')
    expect(res.headers.get('link')).toBe('</feed.rss>; rel="alternate"; type="application/rss+xml"')
  })

  it('does not add a Link header to a response with no Content-Type at all', async () => {
    const app = new Hono()
    app.use('*', feedLinkHeader({ rss: '/feed.rss' }))
    app.get('/empty', (c) => c.body(null, 204))
    const res = await app.request('/empty')
    expect(res.headers.get('link')).toBeNull()
  })
})
