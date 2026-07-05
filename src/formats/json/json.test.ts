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
})
