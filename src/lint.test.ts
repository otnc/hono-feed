import { describe, expect, it } from 'vitest'
import { lintInput } from './lint'
import type { FeedInput } from './types'

const clean: FeedInput = {
  options: {
    title: 't',
    link: 'https://example.com/',
    description: 'd',
    language: 'en',
    image: 'https://example.com/icon.png',
  },
  items: [
    {
      title: 'a',
      id: 'https://example.com/1',
      link: 'https://example.com/1',
      published: new Date('2026-06-29T00:00:00Z'),
      author: { name: 'a' },
    },
  ],
}

describe('lintInput', () => {
  it('returns no warnings for a fully-populated feed, in every format', () => {
    expect(lintInput(clean, 'rss')).toEqual([])
    expect(lintInput(clean, 'atom')).toEqual([])
    expect(lintInput(clean, 'json')).toEqual([])
  })

  it('warns about a missing feed description, with RSS-specific wording', () => {
    const noDescription: FeedInput = {
      ...clean,
      options: { ...clean.options, description: undefined },
    }
    expect(lintInput(noDescription, 'rss')).toEqual([
      expect.stringMatching(/no "description".*<description>/),
    ])
    expect(lintInput(noDescription, 'atom')).toEqual([
      expect.stringMatching(/no "description".*subtitle\/summary/),
    ])
  })

  it('warns about a missing feed language', () => {
    const noLanguage: FeedInput = { ...clean, options: { ...clean.options, language: undefined } }
    expect(lintInput(noLanguage, 'rss')).toEqual([expect.stringMatching(/no "language"/)])
  })

  it('warns about a missing image and favicon, but not when either is present', () => {
    const neither: FeedInput = { ...clean, options: { ...clean.options, image: undefined } }
    expect(lintInput(neither, 'rss')).toEqual([expect.stringMatching(/no "image" or "favicon"/)])

    const faviconOnly: FeedInput = {
      ...clean,
      options: { ...clean.options, image: undefined, favicon: 'https://example.com/fav.ico' },
    }
    expect(lintInput(faviconOnly, 'rss')).toEqual([])
  })

  it('warns about a missing Atom id/link/feedUrl, only for atom', () => {
    const noLink: FeedInput = { ...clean, options: { ...clean.options, link: undefined } }
    expect(lintInput(noLink, 'atom')).toEqual([
      expect.stringMatching(/no "id" \(or "link"\/"feedUrl"\)/),
    ])
    expect(lintInput(noLink, 'rss')).toEqual([])

    const withFeedUrl: FeedInput = {
      ...clean,
      options: { ...clean.options, link: undefined, feedUrl: 'https://example.com/feed' },
    }
    expect(lintInput(withFeedUrl, 'atom')).toEqual([])
  })

  it('warns about missing Apple Podcasts fields, only when podcast is opted in', () => {
    const noPodcast = lintInput(clean, 'rss')
    expect(noPodcast).toEqual([])

    const emptyPodcast: FeedInput = { ...clean, options: { ...clean.options, podcast: {} } }
    expect(lintInput(emptyPodcast, 'rss')).toEqual([
      expect.stringMatching(/no "image"\/"category"\/"explicit"/),
    ])

    const partialPodcast: FeedInput = {
      ...clean,
      options: {
        ...clean.options,
        podcast: { image: 'https://example.com/cover.png', category: ['Tech'], explicit: false },
      },
    }
    expect(lintInput(partialPodcast, 'rss')).toEqual([])
  })

  it('warns about a missing item id, with per-format wording', () => {
    const noId: FeedInput = { ...clean, items: [{ ...clean.items[0], id: undefined }] }
    expect(lintInput(noId, 'atom')).toEqual([expect.stringMatching(/no "id".*atom:id/)])
    expect(lintInput(noId, 'json')).toEqual([expect.stringMatching(/no "id".*json id/)])
    expect(lintInput(noId, 'rss')).toEqual([expect.stringMatching(/no "id".*guid/)])
  })

  it('does not warn about a missing item id when link is present (fallback target exists)', () => {
    const noId: FeedInput = { ...clean, items: [{ ...clean.items[0], id: undefined }] }
    expect(lintInput(noId, 'rss')[0]).toContain('falls back to the link')
  })

  it('warns about a missing item date', () => {
    const noDate: FeedInput = {
      ...clean,
      items: [{ ...clean.items[0], published: undefined, updated: undefined }],
    }
    expect(lintInput(noDate, 'rss')).toEqual([
      expect.stringMatching(/no "published"\/"updated" date/),
    ])

    const withUpdated: FeedInput = {
      ...clean,
      items: [
        { ...clean.items[0], published: undefined, updated: new Date('2026-06-29T00:00:00Z') },
      ],
    }
    expect(lintInput(withUpdated, 'rss')).toEqual([])
  })

  it('warns about a missing item author', () => {
    const noAuthor: FeedInput = { ...clean, items: [{ ...clean.items[0], author: undefined }] }
    expect(lintInput(noAuthor, 'rss')).toEqual([expect.stringMatching(/no "author"/)])

    const emptyAuthorArray: FeedInput = { ...clean, items: [{ ...clean.items[0], author: [] }] }
    expect(lintInput(emptyAuthorArray, 'rss')).toEqual([expect.stringMatching(/no "author"/)])
  })

  it('indexes item warnings by position', () => {
    const twoItems: FeedInput = {
      ...clean,
      items: [clean.items[0], { ...clean.items[0], id: undefined, link: undefined }],
    }
    expect(lintInput(twoItems, 'rss')).toEqual([expect.stringMatching(/^item\[1\]:/)])
  })

  it('never throws, even on a feed that would fail validateInput', () => {
    const empty: FeedInput = { options: { title: '' }, items: [] }
    expect(() => lintInput(empty, 'atom')).not.toThrow()
  })
})
