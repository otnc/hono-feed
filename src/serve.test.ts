import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
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

  it('answers If-None-Match with an empty 304', async () => {
    const first = await app().request('/feed')
    const etag = first.headers.get('etag') as string
    expect(etag).toMatch(/^W\//)
    const res = await app().request('/feed', { headers: { 'if-none-match': etag } })
    expect(res.status).toBe(304)
    expect(await res.text()).toBe('')
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

  it('throws TypeError on a missing title', () => {
    const c = {
      req: { url: 'https://example.com/feed', method: 'GET', header: () => undefined },
    } as unknown as Parameters<typeof serveFeed>[0]
    expect(() => serveFeed(c, { options: { title: '' }, items: [] })).toThrow(TypeError)
  })
})
