import { afterEach, describe, expect, it, vi } from 'vitest'
import { notifyHub } from './websub'

afterEach(() => {
  vi.unstubAllGlobals()
})

function stubFetch(impl: (url: string, init?: RequestInit) => Promise<Response> | Response) {
  const fn = vi.fn(impl)
  vi.stubGlobal('fetch', fn)
  return fn
}

describe('notifyHub', () => {
  it('POSTs hub.mode=publish and hub.url form-encoded to a single hub', async () => {
    const fetchMock = stubFetch(() => new Response(null, { status: 204 }))
    await notifyHub('https://hub.example.com/', 'https://example.com/feed.xml')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://hub.example.com/')
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ 'Content-Type': 'application/x-www-form-urlencoded' })
    expect(init.body).toBe('hub.mode=publish&hub.url=https%3A%2F%2Fexample.com%2Ffeed.xml')
  })

  it('sends one repeated hub.url parameter per feed URL', async () => {
    const fetchMock = stubFetch(() => new Response(null, { status: 204 }))
    await notifyHub('https://hub.example.com/', [
      'https://example.com/feed.rss',
      'https://example.com/feed.atom',
    ])
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const params = new URLSearchParams(init.body as string)
    expect(params.getAll('hub.url')).toEqual([
      'https://example.com/feed.rss',
      'https://example.com/feed.atom',
    ])
  })

  it('sends one POST per hub when given multiple hubs', async () => {
    const fetchMock = stubFetch(() => new Response(null, { status: 204 }))
    await notifyHub(
      ['https://hub-a.example.com/', 'https://hub-b.example.com/'],
      'https://example.com/feed.xml',
    )
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      'https://hub-a.example.com/',
      'https://hub-b.example.com/',
    ])
  })

  it('reports ok/status per hub, preserving hub order', async () => {
    stubFetch((url) =>
      url === 'https://hub-a.example.com/'
        ? new Response(null, { status: 204 })
        : new Response(null, { status: 503 }),
    )
    const results = await notifyHub(
      ['https://hub-a.example.com/', 'https://hub-b.example.com/'],
      'https://example.com/feed.xml',
    )
    expect(results).toEqual([
      { hub: 'https://hub-a.example.com/', ok: true, status: 204 },
      { hub: 'https://hub-b.example.com/', ok: false, status: 503 },
    ])
  })

  it('never rejects: a network error becomes a status: 0 result, not a throw', async () => {
    stubFetch(() => {
      throw new TypeError('network error')
    })
    const results = await notifyHub('https://hub.example.com/', 'https://example.com/feed.xml')
    expect(results).toEqual([{ hub: 'https://hub.example.com/', ok: false, status: 0 }])
  })

  it('a failing hub does not prevent other hubs from being pinged', async () => {
    const fetchMock = stubFetch((url) => {
      if (url === 'https://hub-a.example.com/') throw new TypeError('network error')
      return new Response(null, { status: 204 })
    })
    const results = await notifyHub(
      ['https://hub-a.example.com/', 'https://hub-b.example.com/'],
      'https://example.com/feed.xml',
    )
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(results).toEqual([
      { hub: 'https://hub-a.example.com/', ok: false, status: 0 },
      { hub: 'https://hub-b.example.com/', ok: true, status: 204 },
    ])
  })

  it('passes an AbortSignal through to fetch', async () => {
    const fetchMock = stubFetch(() => new Response(null, { status: 204 }))
    const controller = new AbortController()
    await notifyHub('https://hub.example.com/', 'https://example.com/feed.xml', {
      signal: controller.signal,
    })
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.signal).toBe(controller.signal)
  })

  it('an aborted request is reported as a result, not a rejection', async () => {
    stubFetch(() => {
      throw new DOMException('The operation was aborted', 'AbortError')
    })
    const controller = new AbortController()
    controller.abort()
    const results = await notifyHub('https://hub.example.com/', 'https://example.com/feed.xml', {
      signal: controller.signal,
    })
    expect(results).toEqual([{ hub: 'https://hub.example.com/', ok: false, status: 0 }])
  })
})
