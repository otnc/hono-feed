import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import type { FeedInput } from '../types'
import { type FeedMiddlewareEnv, feed } from './index'

const input: FeedInput = { options: { title: 't', link: 'https://example.com/' }, items: [] }

describe('feedMiddleware', () => {
  it('exposes a preconfigured serveFeed on c.var, overridable per call', async () => {
    const app = new Hono<FeedMiddlewareEnv>()
    app.use('*', feed({ format: 'atom', cacheControl: false }))
    app.get('/default', (c) => c.var.serveFeed(input))
    app.get('/override', (c) => c.var.serveFeed(input, { format: 'rss' }))

    const def = await app.request('/default')
    expect(def.headers.get('content-type')).toBe('application/atom+xml; charset=utf-8')
    expect(def.headers.get('cache-control')).toBeNull()

    const over = await app.request('/override')
    expect(over.headers.get('content-type')).toBe('application/rss+xml; charset=utf-8')
  })
})
