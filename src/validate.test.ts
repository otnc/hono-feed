import { describe, expect, it } from 'vitest'
import type { FeedInput } from './types'
import { validateInput } from './validate'

const valid: FeedInput = {
  options: { title: 't', link: 'https://example.com/', author: { name: 'a' } },
  items: [
    {
      title: 'a',
      link: 'https://example.com/1',
      description: 'd',
      published: new Date('2026-06-29T00:00:00Z'),
    },
  ],
}

describe('validateInput', () => {
  it('passes a valid feed for every format', () => {
    expect(() => validateInput(valid, 'rss')).not.toThrow()
    expect(() => validateInput(valid, 'atom')).not.toThrow()
    expect(() => validateInput(valid, 'json')).not.toThrow()
  })

  it('requires a feed title and an item title', () => {
    expect(() => validateInput({ options: { title: '' }, items: [] }, 'rss')).toThrow(TypeError)
    expect(() =>
      validateInput(
        { options: { title: 't', link: 'https://example.com/' }, items: [{ title: '' }] },
        'rss',
      ),
    ).toThrow(/item\[0\]/)
  })

  it('rejects invalid dates', () => {
    const bad = {
      options: { title: 't', link: 'https://example.com/' },
      items: [{ title: 'a', published: new Date('nope') }],
    }
    expect(() => validateInput(bad, 'rss')).toThrow(/valid Date/)
  })

  it('rejects an invalid feed-level "published" date', () => {
    const bad: FeedInput = {
      options: { title: 't', link: 'https://example.com/', published: new Date('nope') },
      items: [],
    }
    expect(() => validateInput(bad, 'rss')).toThrow(/feed\.published.*valid Date/)
  })

  it('requires link or feedUrl for RSS (channel <link> is mandatory)', () => {
    expect(() => validateInput({ options: { title: 't' }, items: [] }, 'rss')).toThrow(
      /RSS feed requires "link"/,
    )
    expect(() =>
      validateInput(
        { options: { title: 't', feedUrl: 'https://example.com/feed' }, items: [] },
        'rss',
      ),
    ).not.toThrow()
  })

  it('enforces Atom id/updated requirements only for atom', () => {
    expect(() => validateInput({ options: { title: 't' }, items: [] }, 'atom')).toThrow(
      /Atom feed requires/,
    )
    const noId = {
      options: { title: 't', link: 'https://example.com/', author: { name: 'a' } },
      items: [{ title: 'a' }],
    }
    expect(() => validateInput(noId, 'atom')).toThrow(/Atom item/)
    expect(() => validateInput(noId, 'rss')).not.toThrow()
  })

  it('requires the feed-level Atom id to be an absolute IRI (RFC 4287 §4.2.6)', () => {
    const slugFeedId: FeedInput = {
      options: {
        title: 't',
        link: 'https://example.com/',
        id: 'not-an-iri',
        author: { name: 'a' },
      },
      items: [],
    }
    expect(() => validateInput(slugFeedId, 'atom')).toThrow(/absolute IRI/)
    expect(() => validateInput(slugFeedId, 'rss')).not.toThrow()

    const urnFeedId = {
      ...slugFeedId,
      options: {
        ...slugFeedId.options,
        id: 'urn:uuid:1225c695-cfb8',
        updated: new Date('2026-06-29T00:00:00Z'),
      },
    }
    expect(() => validateInput(urnFeedId, 'atom')).not.toThrow()
  })

  it('requires an Atom item to carry updated or published', () => {
    const noDate: FeedInput = {
      options: { title: 't', link: 'https://example.com/', author: { name: 'a' } },
      items: [{ title: 'a', id: 'https://example.com/1', link: 'https://example.com/1' }],
    }
    expect(() => validateInput(noDate, 'atom')).toThrow(/requires "updated" \(or "published"\)/)
    expect(() => validateInput(noDate, 'rss')).not.toThrow()

    const withPublished = {
      ...noDate,
      items: [{ ...noDate.items[0], published: new Date('2026-06-29T00:00:00Z') }],
    }
    expect(() => validateInput(withPublished, 'atom')).not.toThrow()
  })

  it('requires an Atom author on the feed or on every item (RFC 4287 §4.1.1)', () => {
    const noAuthor: FeedInput = {
      options: { title: 't', link: 'https://example.com/' },
      items: [
        { title: 'a', link: 'https://example.com/1', updated: new Date('2026-06-29T00:00:00Z') },
      ],
    }
    expect(() => validateInput(noAuthor, 'atom')).toThrow(/requires an "author"/)
    expect(() => validateInput(noAuthor, 'rss')).not.toThrow()

    const itemAuthor = {
      ...noAuthor,
      items: [{ ...noAuthor.items[0], author: { name: 'a' } }],
    }
    expect(() => validateInput(itemAuthor, 'atom')).not.toThrow()

    const emptyAuthorArray = {
      ...noAuthor,
      items: [{ ...noAuthor.items[0], author: [] }],
    }
    expect(() => validateInput(emptyAuthorArray, 'atom')).toThrow(/requires an "author"/)

    const nonEmptyAuthorArray = {
      ...noAuthor,
      items: [{ ...noAuthor.items[0], author: [{ name: 'a' }] }],
    }
    expect(() => validateInput(nonEmptyAuthorArray, 'atom')).not.toThrow()
  })

  it('requires Atom ids to be absolute IRIs (RFC 4287 §4.2.6)', () => {
    const slugId = {
      options: { title: 't', link: 'https://example.com/', author: { name: 'a' } },
      items: [
        {
          title: 'a',
          id: 'post-1',
          link: 'https://example.com/1',
          updated: new Date('2026-06-29T00:00:00Z'),
        },
      ],
    }
    expect(() => validateInput(slugId, 'atom')).toThrow(/absolute IRI/)
    expect(() => validateInput(slugId, 'rss')).not.toThrow()

    const urnId = { ...slugId, items: [{ ...slugId.items[0], id: 'urn:uuid:1225c695-cfb8' }] }
    expect(() => validateInput(urnId, 'atom')).not.toThrow()
  })

  it('requires link or content per Atom entry (RFC 4287 §4.1.2)', () => {
    const bare = {
      options: { title: 't', link: 'https://example.com/', author: { name: 'a' } },
      items: [
        {
          title: 'a',
          id: 'https://example.com/1',
          updated: new Date('2026-06-29T00:00:00Z'),
        },
      ],
    }
    expect(() => validateInput(bare, 'atom')).toThrow(/requires "link" \(or "content"\)/)
    const withContent = { ...bare, items: [{ ...bare.items[0], content: '<p>b</p>' }] }
    expect(() => validateInput(withContent, 'atom')).not.toThrow()
  })

  it('requires id/link and content/description per JSON Feed item', () => {
    const noId = {
      options: { title: 't', link: 'https://example.com/' },
      items: [{ title: 'a', content: '<p>b</p>' }],
    }
    expect(() => validateInput(noId, 'json')).toThrow(/requires "id"/)

    const noBody = {
      options: { title: 't', link: 'https://example.com/' },
      items: [{ title: 'a', link: 'https://example.com/1' }],
    }
    expect(() => validateInput(noBody, 'json')).toThrow(/requires "content"/)
    expect(() => validateInput(noBody, 'rss')).not.toThrow()
  })

  it('requires updated for an Atom feed with no items', () => {
    const empty = {
      options: { title: 't', link: 'https://example.com/', author: { name: 'a' } },
      items: [],
    }
    expect(() => validateInput(empty, 'atom')).toThrow(/requires "updated"/)
    expect(() =>
      validateInput(
        { ...empty, options: { ...empty.options, updated: new Date('2026-06-29T00:00:00Z') } },
        'atom',
      ),
    ).not.toThrow()
  })

  it('rejects paging.complete and paging.archive both set (RFC 5005 §2/§4 are mutually exclusive)', () => {
    const bothSet: FeedInput = {
      options: {
        title: 't',
        link: 'https://example.com/',
        paging: { complete: true, archive: true },
      },
      items: [],
    }
    expect(() => validateInput(bothSet, 'rss')).toThrow(/mutually exclusive/)
  })

  it('allows paging.complete or paging.archive set alone', () => {
    const completeOnly: FeedInput = {
      options: { title: 't', link: 'https://example.com/', paging: { complete: true } },
      items: [],
    }
    expect(() => validateInput(completeOnly, 'rss')).not.toThrow()

    const archiveOnly: FeedInput = {
      options: { title: 't', link: 'https://example.com/', paging: { archive: true } },
      items: [],
    }
    expect(() => validateInput(archiveOnly, 'rss')).not.toThrow()
  })

  it('rejects skipHours values outside 0-23', () => {
    const tooHigh: FeedInput = {
      options: { title: 't', link: 'https://example.com/', skipHours: [24] },
      items: [],
    }
    expect(() => validateInput(tooHigh, 'rss')).toThrow(/skipHours/)

    const negative: FeedInput = {
      options: { title: 't', link: 'https://example.com/', skipHours: [-1] },
      items: [],
    }
    expect(() => validateInput(negative, 'rss')).toThrow(/skipHours/)

    const nonInteger: FeedInput = {
      options: { title: 't', link: 'https://example.com/', skipHours: [1.5] },
      items: [],
    }
    expect(() => validateInput(nonInteger, 'rss')).toThrow(/skipHours/)
  })

  it('allows skipHours values within 0-23, including the boundaries', () => {
    const valid: FeedInput = {
      options: { title: 't', link: 'https://example.com/', skipHours: [0, 23] },
      items: [],
    }
    expect(() => validateInput(valid, 'rss')).not.toThrow()
  })

  it('rejects a negative or non-integer ttl', () => {
    const negative: FeedInput = {
      options: { title: 't', link: 'https://example.com/', ttl: -5 },
      items: [],
    }
    expect(() => validateInput(negative, 'rss')).toThrow(/"ttl"/)

    const nonInteger: FeedInput = {
      options: { title: 't', link: 'https://example.com/', ttl: 1.5 },
      items: [],
    }
    expect(() => validateInput(nonInteger, 'rss')).toThrow(/"ttl"/)
  })

  it('allows a non-negative integer ttl, including zero', () => {
    const valid: FeedInput = {
      options: { title: 't', link: 'https://example.com/', ttl: 0 },
      items: [],
    }
    expect(() => validateInput(valid, 'rss')).not.toThrow()
  })
})
