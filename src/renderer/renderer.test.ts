import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import type { FeedInput } from '../types'
import { feedRenderer } from './index'

const input: FeedInput = { options: { title: 't', link: 'https://example.com/' }, items: [] }

describe('feedRenderer', () => {
  it('serves a feed through c.render, overridable per call', async () => {
    const app = new Hono()
    app.use('*', feedRenderer({ format: 'atom', cacheControl: false }))
    app.get('/default', (c) => c.render(input))
    app.get('/override', (c) => c.render(input, { format: 'rss' }))

    const def = await app.request('/default')
    expect(def.headers.get('content-type')).toBe('application/atom+xml; charset=utf-8')
    expect(def.headers.get('cache-control')).toBeNull()

    const over = await app.request('/override')
    expect(over.headers.get('content-type')).toBe('application/rss+xml; charset=utf-8')
  })
})
