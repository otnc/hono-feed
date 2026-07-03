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

  it('requires link or feedUrl for RSS (channel <link> is mandatory)', () => {
    expect(() => validateInput({ options: { title: 't' }, items: [] }, 'rss')).toThrow(
      /RSS feed requires "link"/,
    )
    expect(() =>
      validateInput({ options: { title: 't', feedUrl: 'https://example.com/feed' }, items: [] }, 'rss'),
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
})
