import { describe, expect, it } from 'vitest'
import type { FeedInput } from '../../types'
import { toJSONFeed, validateInput } from './index'

const input: FeedInput = {
  options: { title: 'example blog', link: 'https://example.com/' },
  items: [
    {
      title: 'post 1',
      link: 'https://example.com/1',
      published: new Date('2026-06-29T00:00:00Z'),
      content: '<p>body</p>',
    },
  ],
}

describe('toJSONFeed', () => {
  it('merges customJson (feed and item level), and a built-in key always wins on collision', () => {
    const json = JSON.parse(
      toJSONFeed({
        options: {
          ...input.options,
          customJson: { _custom: 'feed-value', title: 'should not win' },
        },
        items: [
          {
            ...input.items[0],
            customJson: { _custom: 'item-value', title: 'should not win either' },
          },
        ],
      }),
    )
    expect(json._custom).toBe('feed-value')
    expect(json.title).toBe('example blog')
    expect(json.items[0]._custom).toBe('item-value')
    expect(json.items[0].title).toBe('post 1')
  })

  it('has no customJson → output unaffected', () => {
    const json = JSON.parse(toJSONFeed(input))
    expect(Object.keys(json)).not.toContain('_custom')
  })

  it('emits version 1.1 and array items', () => {
    const json = JSON.parse(toJSONFeed(input))
    expect(json.version).toBe('https://jsonfeed.org/version/1.1')
    expect(json.items[0].id).toBe('https://example.com/1')
    expect(json.items[0].content_html).toBe('<p>body</p>')
    expect(json.items[0].date_published).toBe('2026-06-29T00:00:00.000Z')
  })

  it('honours jsonFeedVersion', () => {
    expect(JSON.parse(toJSONFeed(input, { jsonFeedVersion: '1' })).version).toBe(
      'https://jsonfeed.org/version/1',
    )
  })

  it('escapes JSON string content and stays valid (control chars need no stripping here)', () => {
    // Unlike XML, JSON has no forbidden characters: quotes, backslashes and control chars are
    // all representable via escapes, so JSON.stringify keeps them and the output round-trips.
    const title = 'quote " backslash \\ newline \n tab \t bell \u0007 emoji \u{1F600}'
    const raw = toJSONFeed({
      options: { title: 't', link: 'https://example.com/' },
      items: [{ title, link: 'https://example.com/1' }],
    })
    // The serialized form must not contain a raw double-quote inside the value or a literal
    // control character — they have to be escaped.
    expect(raw).toContain('\\"')
    expect(raw).toContain('\\u0007')
    expect(raw).not.toContain('\u0007')
    // And it parses back to exactly the original string.
    expect(JSON.parse(raw).items[0].title).toBe(title)
  })

  it('maps authors, tags, image, favicon and attachments', () => {
    const json = JSON.parse(
      toJSONFeed({
        options: {
          title: 't',
          link: 'https://example.com/',
          image: 'https://example.com/icon.png',
          favicon: 'https://example.com/fav.ico',
          author: { name: 'otnc', url: 'https://example.com/otnc' },
        },
        items: [
          {
            title: 'a',
            link: 'https://example.com/1',
            categories: [{ term: 'tech' }, { term: 'news' }],
            image: 'https://example.com/1.png',
            enclosure: { url: 'https://example.com/a.mp3', type: 'audio/mpeg', length: 123 },
            author: [{ name: 'otnc' }],
          },
        ],
      }),
    )
    expect(json.icon).toBe('https://example.com/icon.png')
    expect(json.favicon).toBe('https://example.com/fav.ico')
    expect(json.authors).toEqual([{ name: 'otnc', url: 'https://example.com/otnc' }])
    const item = json.items[0]
    expect(item.tags).toEqual(['tech', 'news'])
    expect(item.image).toBe('https://example.com/1.png')
    expect(item.authors).toEqual([{ name: 'otnc' }])
    expect(item.attachments).toEqual([
      { url: 'https://example.com/a.mp3', mime_type: 'audio/mpeg', size_in_bytes: 123 },
    ])
  })

  it('omits home_page_url and item url when link is absent', () => {
    const json = JSON.parse(
      toJSONFeed({
        options: { title: 't' },
        items: [{ title: 'a', id: 'urn:uuid:1', content: '<p>b</p>' }],
      }),
    )
    expect(json.home_page_url).toBeUndefined()
    expect(json.items[0].url).toBeUndefined()
    expect(json.items[0].id).toBe('urn:uuid:1')
  })

  it('includes language for the default (1.1) version', () => {
    const json = JSON.parse(
      toJSONFeed({
        options: { title: 't', link: 'https://example.com/', language: 'en' },
        items: [],
      }),
    )
    expect(json.language).toBe('en')
  })

  it('omits language for jsonFeedVersion 1 (predates language)', () => {
    const json = JSON.parse(
      toJSONFeed(
        { options: { title: 't', link: 'https://example.com/', language: 'en' }, items: [] },
        { jsonFeedVersion: '1' },
      ),
    )
    expect(json.language).toBeUndefined()
  })

  it('uses the singular author for jsonFeedVersion 1, on both the feed and items', () => {
    const json = JSON.parse(
      toJSONFeed(
        {
          options: { title: 't', link: 'https://example.com/', author: { name: 'otnc' } },
          items: [
            {
              title: 'a',
              link: 'https://example.com/1',
              content: '<p>b</p>',
              author: [{ name: 'one' }, { name: 'two' }],
            },
          ],
        },
        { jsonFeedVersion: '1' },
      ),
    )
    expect(json.author).toEqual({ name: 'otnc' })
    expect(json.authors).toBeUndefined()
    expect(json.items[0].author).toEqual({ name: 'one' })
    expect(json.items[0].authors).toBeUndefined()
  })

  it('omits size_in_bytes when the enclosure has no length', () => {
    const json = JSON.parse(
      toJSONFeed({
        options: { title: 't', link: 'https://example.com/' },
        items: [
          {
            title: 'a',
            link: 'https://example.com/1',
            content: '<p>b</p>',
            enclosure: { url: 'https://example.com/a.mp3', type: 'audio/mpeg' },
          },
        ],
      }),
    )
    expect(json.items[0].attachments[0].size_in_bytes).toBeUndefined()
  })

  it('pretty-prints with 2-space indentation', () => {
    const out = toJSONFeed(
      { options: { title: 't', link: 'https://example.com/' }, items: [] },
      { pretty: true },
    )
    expect(out).toContain('\n  "title"')
  })

  it('falls back to content_text from description when content is absent', () => {
    const json = JSON.parse(
      toJSONFeed({
        options: { title: 't', link: 'https://example.com/' },
        items: [{ title: 'a', link: 'https://example.com/1', description: 'a summary' }],
      }),
    )
    expect(json.items[0].content_text).toBe('a summary')
    expect(json.items[0].content_html).toBeUndefined()
  })

  it('throws when a JSON Feed item has neither id nor link', () => {
    expect(() =>
      toJSONFeed({
        options: { title: 't', link: 'https://example.com/' },
        items: [{ title: 'a', content: '<p>b</p>' }],
      }),
    ).toThrow(/requires "id"/)
  })
})

describe('validateInput (re-exported for this subpath)', () => {
  it('is importable alongside toJSONFeed', () => {
    expect(() => validateInput({ options: { title: '' }, items: [] }, 'json')).toThrow(
      /feed "title" is required/,
    )
  })
})
