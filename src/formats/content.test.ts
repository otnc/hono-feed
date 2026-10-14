import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { serveFeed } from '../serve'
import type { FeedInput } from '../types'
import { toAtom } from './atom'
import { toJSONFeed } from './json'
import { toRSS } from './rss'

const input = (absolutizeContent?: boolean): FeedInput => ({
  options: {
    title: 't',
    link: 'https://example.com/',
    author: { name: 'Ann' },
    updated: new Date('2026-01-01T00:00:00Z'),
    absolutizeContent,
  },
  items: [
    {
      title: 'a',
      link: 'https://example.com/1',
      content: '<img src="/a.png"><a href="next">n</a>',
      description: '<a href="/d">d</a>',
      updated: new Date('2026-01-01T00:00:00Z'),
    },
  ],
})
const opts = { baseUrl: 'https://example.com/blog/', feedUrl: 'https://example.com/feed' }

describe('absolutizeContent', () => {
  it('leaves content untouched by default', () => {
    expect(toRSS(input(), opts)).toContain('src="/a.png"')
    expect(toAtom(input(), opts)).toContain('src="/a.png"')
    expect(toJSONFeed(input(), opts)).toContain('src=\\"/a.png\\"')
  })

  it('absolutizes content and description in RSS, Atom and JSON Feed when opted in', () => {
    const rss = toRSS(input(true), opts)
    expect(rss).toContain('src="https://example.com/a.png"')
    expect(rss).toContain('href="https://example.com/blog/next"')
    expect(rss).toContain('href="https://example.com/d"')
    expect(toAtom(input(true), opts)).toContain('src="https://example.com/a.png"')
    const json = JSON.parse(toJSONFeed(input(true), opts))
    expect(json.items[0].content_html).toBe(
      '<img src="https://example.com/a.png"><a href="https://example.com/blog/next">n</a>',
    )
  })

  it('does nothing without a base URL, and does not mutate the input', () => {
    const source = input(true)
    expect(toRSS(source, {})).toContain('src="/a.png"')
    toRSS(source, opts)
    expect(source.items[0].content).toBe('<img src="/a.png"><a href="next">n</a>')
  })

  it('applies in serveFeed, using the request origin as the base', async () => {
    const app = new Hono()
    app.get('/feed', (c) => serveFeed(c, input(true)))
    const body = await (await app.request('https://example.org/feed')).text()
    expect(body).toContain('src="https://example.org/a.png"')
  })
})
