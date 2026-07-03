import { describe, expect, it } from 'vitest'
import type { FeedInput } from '../../types'
import { toJSONFeed } from './index'

const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/

// Spec-complete input: every item has both an id-worthy link and content, so the
// "content_html or content_text required" rule (jsonfeed.org/version/1.1 §Items) is
// satisfied without relying on unvalidated fallbacks.
const complete: FeedInput = {
  options: {
    title: 'example blog',
    link: 'https://example.com/',
    description: 'diary',
    feedUrl: 'https://example.com/feed',
  },
  items: [
    {
      title: 'post 1',
      id: 'https://example.com/1',
      link: 'https://example.com/1',
      content: '<p>body</p>',
      published: new Date('2026-06-29T00:00:00Z'),
      updated: new Date('2026-06-29T01:00:00Z'),
      enclosure: { url: 'https://example.com/a.mp3', type: 'audio/mpeg', length: 123 },
    },
  ],
}

describe('JSON Feed 1.1 conformance (jsonfeed.org/version/1.1)', () => {
  const feed = JSON.parse(toJSONFeed(complete))

  it('version is the canonical 1.1 URL', () => {
    expect(feed.version).toBe('https://jsonfeed.org/version/1.1')
  })

  it('carries the required top-level title and an items array', () => {
    expect(feed.title).toBe('example blog')
    expect(Array.isArray(feed.items)).toBe(true)
  })

  it('every item has a non-empty id', () => {
    for (const item of feed.items) {
      expect(typeof item.id).toBe('string')
      expect(item.id.length).toBeGreaterThan(0)
    }
  })

  it('every item has content_html or content_text', () => {
    for (const item of feed.items) {
      expect(item.content_html !== undefined || item.content_text !== undefined).toBe(true)
    }
  })

  it('date_published / date_modified are RFC3339', () => {
    expect(feed.items[0].date_published).toMatch(RFC3339)
    expect(feed.items[0].date_modified).toMatch(RFC3339)
  })

  it('attachments carry url and mime_type (both required by the spec)', () => {
    const attachment = feed.items[0].attachments[0]
    expect(typeof attachment.url).toBe('string')
    expect(typeof attachment.mime_type).toBe('string')
  })

  it('uses the 1.1 "authors" array, not the deprecated singular "author"', () => {
    const withAuthor = JSON.parse(
      toJSONFeed({
        ...complete,
        options: { ...complete.options, author: { name: 'otnc' } },
      }),
    )
    expect(withAuthor.authors).toEqual([{ name: 'otnc' }])
    expect(withAuthor.author).toBeUndefined()
  })
})

describe('JSON Feed 1.0 conformance (jsonfeed.org/version/1)', () => {
  it('version is the canonical 1.0 URL', () => {
    const feed = JSON.parse(
      toJSONFeed(complete, { jsonFeedVersion: '1', suppressDeprecationWarnings: true }),
    )
    expect(feed.version).toBe('https://jsonfeed.org/version/1')
  })
})
