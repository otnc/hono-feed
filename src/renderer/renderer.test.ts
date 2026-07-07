import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'
import type { FeedInput } from '../types'
import { feedRenderer } from './index'

const input: FeedInput = {
  options: { title: 't', link: 'https://example.com/', updated: new Date('2026-06-29T00:00:00Z') },
  items: [],
}

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

  it('accepts a lazy async input through c.render', async () => {
    const app = new Hono()
    app.use('*', feedRenderer({ format: 'rss' }))
    app.get('/feed', (c) => c.render(async () => input))

    const res = await app.request('/feed')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/rss+xml; charset=utf-8')
  })

  it('honours an etagFrom option through c.render: 304 without resolving input', async () => {
    const inputFn = vi.fn(() => input)
    const app = new Hono()
    app.use('*', feedRenderer())
    app.get('/feed', (c) => c.render(inputFn, { etagFrom: () => 'rev-1' }))

    const res = await app.request('/feed', { headers: { 'if-none-match': 'W/"rev-1"' } })
    expect(res.status).toBe(304)
    expect(inputFn).not.toHaveBeenCalled()
  })
})
