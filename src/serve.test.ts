import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'
import { Feed } from './feed'
import { serveFeed } from './serve'

const buildFeed = () =>
  new Feed({
    title: 'example blog',
    link: 'https://example.com/',
    author: { name: 'otnc' },
    updated: new Date('2026-06-29T00:00:00Z'),
  }).addItem({
    title: 'post 1',
    link: 'https://example.com/1',
    description: 'summary',
    published: new Date('2026-06-29T00:00:00Z'),
  })

function app() {
  const a = new Hono()
  a.get('/feed', (c) => serveFeed(c, buildFeed()))
  a.get('/atom.xml', (c) => serveFeed(c, buildFeed(), { format: 'atom' }))
  return a
}

describe('serveFeed', () => {
  it('defaults to rss with a charset content-type', async () => {
    const res = await app().request('/feed')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/rss+xml; charset=utf-8')
  })

  it('negotiates from Accept and sets Vary, but not for a fixed format', async () => {
    const negotiated = await app().request('/feed', { headers: { accept: 'application/atom+xml' } })
    expect(negotiated.headers.get('content-type')).toBe('application/atom+xml; charset=utf-8')
    expect(negotiated.headers.get('vary')).toBe('Accept')

    const fixed = await app().request('/atom.xml')
    expect(fixed.headers.get('vary')).toBeNull()
  })

  describe('strictAccept', () => {
    it('answers 406, marked no-store, when Accept rejects every format', async () => {
      const a = new Hono()
      a.get('/feed', (c) => serveFeed(c, buildFeed(), { strictAccept: true }))
      const res = await a.request('/feed', { headers: { accept: '*/*;q=0' } })
      expect(res.status).toBe(406)
      expect(res.headers.get('cache-control')).toBe('no-store')
    })

    it('406 also when each format is individually rejected at q=0', async () => {
      const a = new Hono()
      a.get('/feed', (c) => serveFeed(c, buildFeed(), { strictAccept: true }))
      const res = await a.request('/feed', {
        headers: {
          accept:
            'application/rss+xml;q=0, application/atom+xml;q=0, application/feed+json;q=0, application/json;q=0',
        },
      })
      expect(res.status).toBe(406)
    })

    it('falls through to defaultFormat when Accept merely fails to match (not a rejection)', async () => {
      const a = new Hono()
      a.get('/feed', (c) => serveFeed(c, buildFeed(), { strictAccept: true }))
      const res = await a.request('/feed', { headers: { accept: 'text/html' } })
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toBe('application/rss+xml; charset=utf-8')
    })

    it('keeps the default (non-strict) 200 behaviour when strictAccept is unset', async () => {
      const res = await app().request('/feed', { headers: { accept: '*/*;q=0' } })
      expect(res.status).toBe(200)
    })

    it('is not consulted when the format is explicit or query/extension-detected', async () => {
      const a = new Hono()
      a.get('/rss.xml', (c) => serveFeed(c, buildFeed(), { format: 'rss', strictAccept: true }))
      const res = await a.request('/rss.xml', { headers: { accept: '*/*;q=0' } })
      expect(res.status).toBe(200)
    })

    it('answers 200 with rss when Accept asks for rss only (specific type outranks a q=0 wildcard)', async () => {
      const a = new Hono()
      a.get('/feed', (c) => serveFeed(c, buildFeed(), { strictAccept: true }))
      const res = await a.request('/feed', { headers: { accept: 'application/rss+xml, */*;q=0' } })
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toBe('application/rss+xml; charset=utf-8')
    })
  })

  describe('q=0 rejection', () => {
    it('does not fall back to a format the Accept header explicitly rejected via a wildcard', async () => {
      const res = await app().request('/feed', {
        headers: { accept: 'application/rss+xml;q=0, */*' },
      })
      expect(res.headers.get('content-type')).not.toBe('application/rss+xml; charset=utf-8')
    })

    it('does not fall back to defaultFormat when it alone was explicitly rejected', async () => {
      const res = await app().request('/feed', {
        headers: { accept: 'application/rss+xml;q=0' },
      })
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).not.toBe('application/rss+xml; charset=utf-8')
    })
  })

  it('answers If-None-Match with an empty 304', async () => {
    const first = await app().request('/feed')
    const etag = first.headers.get('etag') as string
    expect(etag).toMatch(/^W\//)
    const res = await app().request('/feed', { headers: { 'if-none-match': etag } })
    expect(res.status).toBe(304)
    expect(await res.text()).toBe('')
  })

  it('ignores If-None-Match on a POST request, per RFC 9110 §13.1.2/§13.1.3 (GET/HEAD only)', async () => {
    const a = new Hono()
    a.post('/feed', (c) => serveFeed(c, buildFeed()))
    const first = await a.request('/feed', { method: 'POST' })
    const etag = first.headers.get('etag') as string
    expect(etag).toMatch(/^W\//)
    const res = await a.request('/feed', {
      method: 'POST',
      headers: { 'if-none-match': etag },
    })
    expect(res.status).toBe(200)
  })

  it('returns an empty body with Content-Length for HEAD', async () => {
    const res = await app().request('/feed', { method: 'HEAD' })
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('')
    expect(Number(res.headers.get('content-length'))).toBeGreaterThan(0)
  })

  it('detects the format from the query when enabled', async () => {
    const a = new Hono()
    a.get('/feed', (c) => serveFeed(c, buildFeed(), { detectFromQuery: true }))
    const res = await a.request('/feed?format=json')
    expect(res.headers.get('content-type')).toBe('application/feed+json; charset=utf-8')
  })

  it('does not include query params in the feedUrl when using detectFromQuery', async () => {
    const a = new Hono()
    a.get('/feed', (c) => serveFeed(c, buildFeed(), { detectFromQuery: true }))
    const res = await a.request('https://example.com/feed?format=atom')
    const text = await res.text()
    expect(text).toContain('https://example.com/feed')
    expect(text).not.toContain('?format=atom')
  })

  it('detects the format from the URL extension', async () => {
    const a = new Hono()
    a.get('/feed.json', (c) => serveFeed(c, buildFeed()))
    const res = await a.request('/feed.json')
    expect(res.headers.get('content-type')).toBe('application/feed+json; charset=utf-8')
  })

  it('answers a satisfied If-Modified-Since with 304', async () => {
    const res = await app().request('/feed', {
      headers: { 'if-modified-since': 'Wed, 01 Jul 2026 00:00:00 GMT' },
    })
    expect(res.status).toBe(304)
  })

  it('omits Cache-Control when cacheControl is false and still sets Last-Modified', async () => {
    const a = new Hono()
    a.get('/feed', (c) => serveFeed(c, buildFeed(), { cacheControl: false }))
    const res = await a.request('/feed')
    expect(res.headers.get('cache-control')).toBeNull()
    expect(res.headers.get('last-modified')).toBe('Mon, 29 Jun 2026 00:00:00 GMT')
  })

  it('accepts a CacheControlDirectives object as well as a raw string', async () => {
    const a = new Hono()
    a.get('/feed', (c) =>
      serveFeed(c, buildFeed(), {
        cacheControl: { public: true, maxAge: 600, staleWhileRevalidate: 60 },
      }),
    )
    const res = await a.request('/feed')
    expect(res.headers.get('cache-control')).toBe('public, max-age=600, stale-while-revalidate=60')
  })

  it('serves a title-only feed: the request URL satisfies the channel <link> fallback', async () => {
    const a = new Hono()
    a.get('/feed', (c) => serveFeed(c, { options: { title: 'Example Blog' }, items: [] }))
    const res = await a.request('https://example.com/feed')
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('<link>https://example.com/feed</link>')
  })

  it('uses the request URL as the Atom feed id when the input has none', async () => {
    const a = new Hono()
    a.get('/feed', (c) =>
      serveFeed(
        c,
        { options: { title: 't', updated: new Date('2026-06-29T00:00:00Z') }, items: [] },
        { format: 'atom' },
      ),
    )
    const res = await a.request('https://example.com/feed')
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('<id>https://example.com/feed</id>')
  })

  it('absolutizes a relative options.feedUrl against baseUrl instead of emitting it as-is', async () => {
    const a = new Hono()
    a.get('/feed', (c) =>
      serveFeed(c, {
        options: { title: 't', link: 'https://example.com/', feedUrl: '/feed.xml' },
        items: [],
      }),
    )
    const res = await a.request('http://localhost/feed')
    const text = await res.text()
    expect(text).toContain('href="http://localhost/feed.xml"')
  })

  it('resolves a relative options.feedUrl into an absolute Atom feed id', async () => {
    const a = new Hono()
    a.get('/atom', (c) =>
      serveFeed(
        c,
        {
          options: {
            title: 't',
            feedUrl: '/feed.atom',
            updated: new Date('2026-01-01'),
            author: { name: 'A' },
          },
          items: [],
        },
        { format: 'atom' },
      ),
    )
    const res = await a.request('http://localhost/atom')
    const text = await res.text()
    expect(text).toContain('<id>http://localhost/feed.atom</id>')
  })

  it('derives the self URL from baseUrl rather than the request origin', async () => {
    const a = new Hono()
    a.get('/feed', (c) =>
      serveFeed(
        c,
        { options: { title: 't', link: 'https://example.com/' }, items: [] },
        {
          baseUrl: 'https://public.example.com',
        },
      ),
    )
    const res = await a.request('http://internal-host/feed')
    const text = await res.text()
    expect(text).toContain('href="https://public.example.com/feed"')
    expect(text).not.toContain('internal-host')
  })

  it('throws TypeError on a missing title', () => {
    const c = {
      req: { url: 'https://example.com/feed', method: 'GET', header: () => undefined },
    } as unknown as Parameters<typeof serveFeed>[0]
    expect(() => serveFeed(c, { options: { title: '' }, items: [] })).toThrow(TypeError)
  })

  describe('version from the query', () => {
    const buildFeedWithLanguage = () =>
      new Feed({
        title: 'example blog',
        link: 'https://example.com/',
        language: 'en',
        author: { name: 'otnc' },
        updated: new Date('2026-06-29T00:00:00Z'),
      }).addItem({
        title: 'post 1',
        link: 'https://example.com/1',
        description: 'summary',
        published: new Date('2026-06-29T00:00:00Z'),
      })

    it('honours ?version= when detectFromQuery is enabled', async () => {
      const a = new Hono()
      a.get('/feed', (c) => serveFeed(c, buildFeedWithLanguage(), { detectFromQuery: true }))
      const res = await a.request('/feed?version=0.91')
      expect(res.status).toBe(200)
      expect(await res.text()).toContain('<language>en</language>')
    })

    it('ignores the query when rssVersion is pinned in code', async () => {
      const a = new Hono()
      a.get('/feed', (c) =>
        serveFeed(c, buildFeedWithLanguage(), { detectFromQuery: true, rssVersion: '2.0' }),
      )
      const res = await a.request('/feed?version=0.91')
      expect(await res.text()).not.toContain('rdf')
    })

    it('answers 400 for an unknown version value, marked no-store', async () => {
      const a = new Hono()
      a.get('/feed', (c) => serveFeed(c, buildFeedWithLanguage(), { detectFromQuery: true }))
      const res = await a.request('/feed?version=9.9')
      expect(res.status).toBe(400)
      expect(res.headers.get('cache-control')).toBe('no-store')
    })

    it('answers 422 when the query-selected version cannot be generated from the data, marked no-store', async () => {
      const a = new Hono()
      a.get('/feed', (c) => serveFeed(c, buildFeed(), { detectFromQuery: true }))
      const res = await a.request('/feed?version=0.91')
      expect(res.status).toBe(422)
      expect(res.headers.get('cache-control')).toBe('no-store')
      expect(await res.text()).toContain('RSS 0.91 requires "language"')
    })

    it('still throws when the same failure comes from a version pinned in code', () => {
      const c = {
        req: { url: 'https://example.com/feed', method: 'GET', header: () => undefined },
      } as unknown as Parameters<typeof serveFeed>[0]
      expect(() => serveFeed(c, buildFeed(), { rssVersion: '0.91' })).toThrow(TypeError)
    })

    it('lets formatQueryParam and versionQueryParam be renamed', async () => {
      const a = new Hono()
      a.get('/feed', (c) =>
        serveFeed(c, buildFeedWithLanguage(), {
          detectFromQuery: true,
          formatQueryParam: 'f',
          versionQueryParam: 'v',
        }),
      )
      const res = await a.request('/feed?f=rss&v=0.91')
      expect(res.status).toBe(200)
      expect(await res.text()).toContain('<language>en</language>')

      // The default names no longer apply once renamed.
      const ignored = await a.request('/feed?format=json&version=0.91')
      expect(ignored.headers.get('content-type')).toBe('application/rss+xml; charset=utf-8')
    })

    it('detects the format from the query while ignoring the version query when disabled', async () => {
      const a = new Hono()
      a.get('/feed', (c) =>
        serveFeed(c, buildFeed(), { detectFormatFromQuery: true, detectVersionFromQuery: false }),
      )
      const res = await a.request('/feed?format=atom&version=0.91')
      expect(res.headers.get('content-type')).toBe('application/atom+xml; charset=utf-8')
    })

    it('detects the version from the query while ignoring the format query when disabled', async () => {
      const a = new Hono()
      a.get('/feed', (c) =>
        serveFeed(c, buildFeedWithLanguage(), {
          detectFormatFromQuery: false,
          detectVersionFromQuery: true,
        }),
      )
      const res = await a.request('/feed?format=atom&version=0.91')
      expect(res.headers.get('content-type')).toBe('application/rss+xml; charset=utf-8')
      expect(await res.text()).toContain('<language>en</language>')
    })

    it('detectFromQuery still enables both when the granular options are unset', async () => {
      const a = new Hono()
      a.get('/feed', (c) => serveFeed(c, buildFeedWithLanguage(), { detectFromQuery: true }))
      const res = await a.request('/feed?format=atom&version=0.3')
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toBe('application/atom+xml; charset=utf-8')
    })

    it('honours ?version= for atom, and answers 400 for an unknown atom version', async () => {
      const a = new Hono()
      a.get('/feed', (c) => serveFeed(c, buildFeed(), { detectFromQuery: true, format: 'atom' }))
      const ok = await a.request('/feed?version=0.3')
      expect(ok.status).toBe(200)
      expect(ok.headers.get('content-type')).toBe('application/atom+xml; charset=utf-8')

      const bad = await a.request('/feed?version=9.9')
      expect(bad.status).toBe(400)
      expect(bad.headers.get('cache-control')).toBe('no-store')
    })

    it('honours ?version= for json, and answers 400 for an unknown json version', async () => {
      const a = new Hono()
      a.get('/feed', (c) => serveFeed(c, buildFeed(), { detectFromQuery: true, format: 'json' }))
      const ok = await a.request('/feed?version=1')
      expect(ok.status).toBe(200)
      const json = await ok.json()
      expect(json.version).toBe('https://jsonfeed.org/version/1')

      const bad = await a.request('/feed?version=9.9')
      expect(bad.status).toBe(400)
      expect(bad.headers.get('cache-control')).toBe('no-store')
    })
  })

  describe('conditional requests', () => {
    it('answers a non-matching If-None-Match with a full 200 response', async () => {
      const res = await app().request('/feed', {
        headers: { 'if-none-match': '"not-the-etag"' },
      })
      expect(res.status).toBe(200)
      expect((await res.text()).length).toBeGreaterThan(0)
    })

    it('matches a weak etag among several comma-separated If-None-Match candidates', async () => {
      const first = await app().request('/feed')
      const etag = first.headers.get('etag') as string
      const res = await app().request('/feed', {
        headers: { 'if-none-match': `"something-else", ${etag}` },
      })
      expect(res.status).toBe(304)
    })

    it('treats If-None-Match: * as always matching', async () => {
      const res = await app().request('/feed', { headers: { 'if-none-match': '*' } })
      expect(res.status).toBe(304)
    })

    it('ignores an unparsable If-Modified-Since and returns 200', async () => {
      const res = await app().request('/feed', {
        headers: { 'if-modified-since': 'not-a-date' },
      })
      expect(res.status).toBe(200)
    })

    it('ignores If-Modified-Since when If-None-Match is present, even with no ETag to compare (RFC 9110 §13.1.3)', async () => {
      const a = new Hono()
      a.get('/feed', (c) => serveFeed(c, buildFeed(), { etag: false }))
      const res = await a.request('/feed', {
        headers: {
          'if-none-match': '"stale-etag"',
          'if-modified-since': 'Wed, 01 Jul 2026 00:00:00 GMT', // would satisfy IMS alone
        },
      })
      expect(res.status).toBe(200)
    })
  })

  describe('etag / lastModified toggles', () => {
    it('omits ETag when etag is false', async () => {
      const a = new Hono()
      a.get('/feed', (c) => serveFeed(c, buildFeed(), { etag: false }))
      const res = await a.request('/feed')
      expect(res.headers.get('etag')).toBeNull()
    })

    it('omits Last-Modified when lastModified is false', async () => {
      const a = new Hono()
      a.get('/feed', (c) => serveFeed(c, buildFeed(), { lastModified: false }))
      const res = await a.request('/feed')
      expect(res.headers.get('last-modified')).toBeNull()
    })

    it('omits Last-Modified when there is no date anywhere in the feed', async () => {
      const a = new Hono()
      a.get('/feed', (c) =>
        serveFeed(c, {
          options: { title: 't', link: 'https://example.com/' },
          items: [{ title: 'a', link: 'https://example.com/1', description: 'd' }],
        }),
      )
      const res = await a.request('/feed')
      expect(res.headers.get('last-modified')).toBeNull()
    })

    it('uses a custom etag function, wrapping a bare tag as weak', async () => {
      const a = new Hono()
      a.get('/feed', (c) => serveFeed(c, buildFeed(), { etag: () => 'rev-42' }))
      const res = await a.request('/feed')
      expect(res.headers.get('etag')).toBe('W/"rev-42"')
    })

    it('matches If-None-Match against a custom etag function for 304', async () => {
      const a = new Hono()
      a.get('/feed', (c) => serveFeed(c, buildFeed(), { etag: () => 'rev-42' }))
      const res = await a.request('/feed', { headers: { 'if-none-match': 'W/"rev-42"' } })
      expect(res.status).toBe(304)
    })

    it('passes an already-quoted custom tag through verbatim', async () => {
      const a = new Hono()
      a.get('/feed', (c) => serveFeed(c, buildFeed(), { etag: () => '"strong-rev"' }))
      const res = await a.request('/feed')
      expect(res.headers.get('etag')).toBe('"strong-rev"')
    })

    it('matches an If-None-Match tag containing a comma (a legal etagc character)', async () => {
      const a = new Hono()
      a.get('/feed', (c) => serveFeed(c, buildFeed(), { etag: () => '"rev-1,2"' }))
      const res = await a.request('/feed', { headers: { 'if-none-match': '"rev-1,2"' } })
      expect(res.status).toBe(304)
    })

    it('matches a comma-containing tag among a comma-separated list of candidates', async () => {
      const a = new Hono()
      a.get('/feed', (c) => serveFeed(c, buildFeed(), { etag: () => '"rev-1,2"' }))
      const res = await a.request('/feed', {
        headers: { 'if-none-match': '"something-else", "rev-1,2"' },
      })
      expect(res.status).toBe(304)
    })

    it('does not match when no candidate equals a comma-containing tag', async () => {
      const a = new Hono()
      a.get('/feed', (c) => serveFeed(c, buildFeed(), { etag: () => '"rev-1,2"' }))
      const res = await a.request('/feed', { headers: { 'if-none-match': '"rev-1", "2"' } })
      expect(res.status).toBe(200)
    })

    it('treats an If-None-Match value with no quoted entity-tags as a non-match', async () => {
      const res = await app().request('/feed', {
        headers: { 'if-none-match': 'garbage-no-quotes' },
      })
      expect(res.status).toBe(200)
    })
  })
})

describe('serveFeed: lazy input', () => {
  it('stays synchronous when input is a plain object and etagFrom is unset (regression)', async () => {
    let wasPromise: boolean | undefined
    const a = new Hono()
    a.get('/feed', (c) => {
      const res = serveFeed(c, buildFeed())
      wasPromise = res instanceof Promise
      return res
    })
    const res = await a.request('/feed')
    expect(wasPromise).toBe(false)
    expect(res.status).toBe(200)
  })

  it('stays synchronous when a lazy input function itself resolves synchronously', async () => {
    let wasPromise: boolean | undefined
    const a = new Hono()
    a.get('/feed', (c) => {
      const res = serveFeed(c, () => buildFeed())
      wasPromise = res instanceof Promise
      return res
    })
    const res = await a.request('/feed')
    expect(wasPromise).toBe(false)
    expect(res.status).toBe(200)
  })

  it('returns a Promise when the lazy input function is itself async', async () => {
    let wasPromise: boolean | undefined
    const a = new Hono()
    a.get('/feed', (c) => {
      const res = serveFeed(c, async () => buildFeed())
      wasPromise = res instanceof Promise
      return res
    })
    const res = await a.request('/feed')
    expect(wasPromise).toBe(true)
    expect(res.status).toBe(200)
  })

  it('works with the default body-hash ETag: resolves once, 304s on a matching If-None-Match', async () => {
    const inputFn = vi.fn(() => buildFeed())
    const a = new Hono()
    a.get('/feed', (c) => serveFeed(c, inputFn))
    const first = await a.request('/feed')
    expect(first.status).toBe(200)
    const etag = first.headers.get('etag') as string
    const second = await a.request('/feed', { headers: { 'if-none-match': etag } })
    expect(second.status).toBe(304)
    expect(inputFn).toHaveBeenCalledTimes(2) // once per request — no etagFrom short-circuit here
  })
})

describe('serveFeed: etagFrom', () => {
  it('answers 304 from a matching If-None-Match without ever resolving input', async () => {
    const inputFn = vi.fn(() => buildFeed())
    const a = new Hono()
    a.get('/feed', (c) => serveFeed(c, inputFn, { etagFrom: () => 'rev-1' }))
    const res = await a.request('/feed', { headers: { 'if-none-match': 'W/"rev-1"' } })
    expect(res.status).toBe(304)
    expect(inputFn).not.toHaveBeenCalled()
  })

  it('answers 304 for HEAD too, without resolving input', async () => {
    const inputFn = vi.fn(() => buildFeed())
    const a = new Hono()
    a.get('/feed', (c) => serveFeed(c, inputFn, { etagFrom: () => 'rev-1' }))
    const res = await a.request('/feed', {
      method: 'HEAD',
      headers: { 'if-none-match': 'W/"rev-1"' },
    })
    expect(res.status).toBe(304)
    expect(await res.text()).toBe('')
    expect(inputFn).not.toHaveBeenCalled()
  })

  it('ignores If-None-Match on a POST request and resolves input normally (etagFrom path)', async () => {
    const inputFn = vi.fn(() => buildFeed())
    const a = new Hono()
    a.post('/feed', (c) => serveFeed(c, inputFn, { etagFrom: () => 'rev-post' }))
    const res = await a.request('/feed', {
      method: 'POST',
      headers: { 'if-none-match': 'W/"rev-post"' },
    })
    expect(res.status).toBe(200)
    expect(inputFn).toHaveBeenCalled()
  })

  it('carries Vary: Accept on the 304 short-circuit when the format was negotiated', async () => {
    const a = new Hono()
    a.get('/feed', (c) => serveFeed(c, buildFeed(), { etagFrom: () => 'rev-vary' }))
    const res = await a.request('/feed', {
      headers: { accept: 'application/atom+xml', 'if-none-match': 'W/"rev-vary"' },
    })
    expect(res.status).toBe(304)
    expect(res.headers.get('vary')).toBe('Accept')
  })

  it('omits Vary on the 304 short-circuit when the format was not negotiated (explicit format)', async () => {
    const a = new Hono()
    a.get('/feed', (c) =>
      serveFeed(c, buildFeed(), { format: 'rss', etagFrom: () => 'rev-novary' }),
    )
    const res = await a.request('/feed', { headers: { 'if-none-match': 'W/"rev-novary"' } })
    expect(res.status).toBe(304)
    expect(res.headers.get('vary')).toBeNull()
  })

  it('a weak-compared match (bare quoted tag) still short-circuits', async () => {
    const inputFn = vi.fn(() => buildFeed())
    const a = new Hono()
    a.get('/feed', (c) => serveFeed(c, inputFn, { etagFrom: () => 'rev-1' }))
    const res = await a.request('/feed', { headers: { 'if-none-match': '"rev-1"' } })
    expect(res.status).toBe(304)
    expect(inputFn).not.toHaveBeenCalled()
  })

  it('resolves input and uses the etagFrom tag as the ETag when If-None-Match does not match', async () => {
    const inputFn = vi.fn(() => buildFeed())
    const a = new Hono()
    a.get('/feed', (c) => serveFeed(c, inputFn, { etagFrom: () => 'rev-2' }))
    const res = await a.request('/feed', { headers: { 'if-none-match': 'W/"stale"' } })
    expect(res.status).toBe(200)
    expect(res.headers.get('etag')).toBe('W/"rev-2"')
    expect(inputFn).toHaveBeenCalledTimes(1)
  })

  it('resolves input normally when there is no If-None-Match at all', async () => {
    const inputFn = vi.fn(() => buildFeed())
    const a = new Hono()
    a.get('/feed', (c) => serveFeed(c, inputFn, { etagFrom: () => 'rev-3' }))
    const res = await a.request('/feed')
    expect(res.status).toBe(200)
    expect(res.headers.get('etag')).toBe('W/"rev-3"')
    expect(inputFn).toHaveBeenCalledTimes(1)
  })

  it('ignores If-Modified-Since when If-None-Match is present but does not match the etagFrom tag', async () => {
    const a = new Hono()
    a.get('/feed', (c) => serveFeed(c, buildFeed(), { etagFrom: () => 'rev-4' }))
    const res = await a.request('/feed', {
      headers: {
        'if-none-match': 'W/"stale"',
        'if-modified-since': 'Wed, 01 Jul 2026 00:00:00 GMT', // would satisfy IMS alone
      },
    })
    expect(res.status).toBe(200)
  })

  it('still answers a satisfied If-Modified-Since with 304 when there is no If-None-Match', async () => {
    const a = new Hono()
    a.get('/feed', (c) => serveFeed(c, buildFeed(), { etagFrom: () => 'rev-5' }))
    const res = await a.request('/feed', {
      headers: { 'if-modified-since': 'Wed, 01 Jul 2026 00:00:00 GMT' },
    })
    expect(res.status).toBe(304)
  })

  it('accepts an async etagFrom and stays correct end-to-end', async () => {
    const inputFn = vi.fn(() => buildFeed())
    const a = new Hono()
    a.get('/feed', (c) => serveFeed(c, inputFn, { etagFrom: async () => 'rev-6' }))
    const res = await a.request('/feed', { headers: { 'if-none-match': 'W/"rev-6"' } })
    expect(res.status).toBe(304)
    expect(inputFn).not.toHaveBeenCalled()
  })

  it('serializes a CacheControlDirectives object on the etagFrom 304 short-circuit', async () => {
    const a = new Hono()
    a.get('/feed', (c) =>
      serveFeed(c, buildFeed(), {
        etagFrom: () => 'rev-cc',
        cacheControl: { public: true, maxAge: 600 },
      }),
    )
    const res = await a.request('/feed', { headers: { 'if-none-match': 'W/"rev-cc"' } })
    expect(res.status).toBe(304)
    expect(res.headers.get('cache-control')).toBe('public, max-age=600')
  })

  it('omits Cache-Control on the etagFrom 304 short-circuit when cacheControl is false', async () => {
    const a = new Hono()
    a.get('/feed', (c) =>
      serveFeed(c, buildFeed(), { etagFrom: () => 'rev-cc2', cacheControl: false }),
    )
    const res = await a.request('/feed', { headers: { 'if-none-match': 'W/"rev-cc2"' } })
    expect(res.status).toBe(304)
    expect(res.headers.get('cache-control')).toBeNull()
  })

  it('returns a Promise when etagFrom is itself async, even if it matches', async () => {
    let wasPromise: boolean | undefined
    const a = new Hono()
    a.get('/feed', (c) => {
      const res = serveFeed(c, buildFeed(), { etagFrom: async () => 'rev-7' })
      wasPromise = res instanceof Promise
      return res
    })
    const res = await a.request('/feed', { headers: { 'if-none-match': 'W/"rev-7"' } })
    expect(wasPromise).toBe(true)
    expect(res.status).toBe(304)
  })

  it('stays synchronous at runtime when etagFrom resolves synchronously and input is a plain object', async () => {
    let wasPromise: boolean | undefined
    const a = new Hono()
    a.get('/feed', (c) => {
      const res = serveFeed(c, buildFeed(), { etagFrom: () => 'rev-8' })
      wasPromise = res instanceof Promise
      return res
    })
    const res = await a.request('/feed', { headers: { 'if-none-match': 'W/"rev-8"' } })
    expect(wasPromise).toBe(false)
    expect(res.status).toBe(304)
  })

  it('resolves both an async etagFrom and a lazy async input when neither short-circuits', async () => {
    const inputFn = vi.fn(async () => buildFeed())
    const a = new Hono()
    a.get('/feed', (c) => serveFeed(c, inputFn, { etagFrom: async () => 'rev-9' }))
    const res = await a.request('/feed', { headers: { 'if-none-match': 'W/"stale"' } })
    expect(res.status).toBe(200)
    expect(res.headers.get('etag')).toBe('W/"rev-9"')
    expect(inputFn).toHaveBeenCalledTimes(1)
  })

  it('a strictAccept 406 short-circuits before etagFrom is ever called', async () => {
    const etagFromFn = vi.fn(() => 'rev-10')
    const a = new Hono()
    a.get('/feed', (c) => serveFeed(c, buildFeed(), { strictAccept: true, etagFrom: etagFromFn }))
    const res = await a.request('/feed', { headers: { accept: '*/*;q=0' } })
    expect(res.status).toBe(406)
    expect(etagFromFn).not.toHaveBeenCalled()
  })

  it('Last-Modified is still derived from the resolved feed on the non-304 path', async () => {
    const a = new Hono()
    a.get('/feed', (c) => serveFeed(c, buildFeed(), { etagFrom: () => 'rev-11' }))
    const res = await a.request('/feed')
    expect(res.headers.get('last-modified')).toBe('Mon, 29 Jun 2026 00:00:00 GMT')
  })
})
