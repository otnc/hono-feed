import { describe, expect, it } from 'vitest'
import type { FeedInput } from '../../types'
import { toJSONFeed } from './index'

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

  it('maps multiple attachments from an enclosure array; RSS-style single object still works', () => {
    const json = JSON.parse(
      toJSONFeed({
        options: { title: 't', link: 'https://example.com/' },
        items: [
          {
            title: 'a',
            link: 'https://example.com/1',
            enclosure: [
              { url: 'https://example.com/a.mp3', type: 'audio/mpeg', length: 123 },
              { url: 'https://example.com/a.ogg', type: 'audio/ogg' },
            ],
          },
        ],
      }),
    )
    expect(json.items[0].attachments).toEqual([
      { url: 'https://example.com/a.mp3', mime_type: 'audio/mpeg', size_in_bytes: 123 },
      { url: 'https://example.com/a.ogg', mime_type: 'audio/ogg' },
    ])
  })

  it('maps external_url, banner_image and expired', () => {
    const json = JSON.parse(
      toJSONFeed(
        {
          options: { title: 't', link: 'https://example.com/', expired: true },
          items: [
            {
              title: 'a',
              link: 'https://example.com/1',
              content: '<p>b</p>',
              externalUrl: 'https://other.example.com/post',
              bannerImage: '/banner.png',
            },
          ],
        },
        { baseUrl: 'https://example.com' },
      ),
    )
    expect(json.expired).toBe(true)
    expect(json.items[0].external_url).toBe('https://other.example.com/post')
    expect(json.items[0].banner_image).toBe('https://example.com/banner.png')
  })

  it('includes per-item language for the default (1.1) version, omits it for 1.0', () => {
    const build = (jsonFeedVersion?: '1' | '1.1') =>
      JSON.parse(
        toJSONFeed(
          {
            options: { title: 't', link: 'https://example.com/' },
            items: [{ title: 'a', link: 'https://example.com/1', content: 'b', language: 'fr' }],
          },
          { jsonFeedVersion, suppressDeprecationWarnings: true },
        ),
      )
    expect(build('1.1').items[0].language).toBe('fr')
    expect(build('1').items[0].language).toBeUndefined()
  })

  it('omits expired, external_url and banner_image when unset', () => {
    const json = JSON.parse(
      toJSONFeed({
        options: { title: 't', link: 'https://example.com/' },
        items: [{ title: 'a', link: 'https://example.com/1', content: 'b' }],
      }),
    )
    expect(json.expired).toBeUndefined()
    expect(json.items[0].external_url).toBeUndefined()
    expect(json.items[0].banner_image).toBeUndefined()
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
