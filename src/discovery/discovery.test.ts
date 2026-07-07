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
})
