import { describe, expect, it } from 'vitest'
import type { FeedInput } from '../types'
import { validateInput } from '../validate'
import { toAtom } from './atom'
import { toJSONFeed } from './json'
import { toRSS } from './rss'

const withMedia: FeedInput = {
  options: {
    title: 't',
    link: 'https://example.com/',
    author: { name: 'Ann' },
    updated: new Date('2026-01-01T00:00:00Z'),
  },
  items: [
    {
      title: 'a',
      link: 'https://example.com/1',
      content: '<p>x</p>',
      updated: new Date('2026-01-01T00:00:00Z'),
      media: {
        contents: [
          {
            url: '/clip.mp4',
            type: 'video/mp4',
            medium: 'video',
            width: 1280,
            height: 720,
            duration: 42,
            fileSize: 1024,
          },
        ],
        thumbnails: [{ url: '/thumb.jpg', width: 320, height: 180 }, { url: '/thumb2.jpg' }],
      },
    },
  ],
}

const plain: FeedInput = {
  ...withMedia,
  items: [{ ...withMedia.items[0], media: undefined }],
}

const opts = { baseUrl: 'https://example.com', feedUrl: 'https://example.com/feed' }
const MEDIA_NS = 'xmlns:media="http://search.yahoo.com/mrss/"'
const CONTENT =
  '<media:content url="https://example.com/clip.mp4" type="video/mp4" medium="video" width="1280" height="720" duration="42" fileSize="1024"/>'

describe('Media RSS', () => {
  it('emits media:content and media:thumbnail in RSS 2.0, absolutized, declaring xmlns:media', () => {
    const out = toRSS(withMedia, opts)
    expect(out).toContain(MEDIA_NS)
    expect(out).toContain(CONTENT)
    expect(out).toContain(
      '<media:thumbnail url="https://example.com/thumb.jpg" width="320" height="180"/>',
    )
    expect(out).toContain('<media:thumbnail url="https://example.com/thumb2.jpg"/>')
  })

  it('emits the same elements in Atom 1.0 entries', () => {
    const out = toAtom(withMedia, opts)
    expect(out).toContain(MEDIA_NS)
    expect(out).toContain(CONTENT)
    expect(out).toContain('<media:thumbnail url="https://example.com/thumb2.jpg"/>')
  })

  it('declares xmlns:media only when an item uses it', () => {
    expect(toRSS(plain, opts)).not.toContain('xmlns:media')
    expect(toAtom(plain, opts)).not.toContain('xmlns:media')

    const empty: FeedInput = { ...plain, items: [{ ...plain.items[0], media: {} }] }
    expect(toRSS(empty, opts)).not.toContain('xmlns:media')
  })

  it('is RSS 2.0 / Atom 1.0 only', () => {
    expect(toRSS(withMedia, { ...opts, rssVersion: '0.92' })).not.toContain('media:')
    expect(toRSS(withMedia, { ...opts, rssVersion: '1.0' })).not.toContain('media:')
    expect(toAtom(withMedia, { ...opts, atomVersion: '0.3' })).not.toContain('media:')
    expect(toJSONFeed(withMedia, opts)).not.toContain('thumb')
  })

  it('lets an explicit customNamespaces entry win over the automatic declaration', () => {
    const custom: FeedInput = {
      ...withMedia,
      options: { ...withMedia.options, customNamespaces: { 'xmlns:media': 'urn:custom' } },
    }
    const out = toRSS(custom, opts)
    expect(out).toContain('xmlns:media="urn:custom"')
    expect(out).not.toContain(MEDIA_NS)
  })

  it('requires a url on every thumbnail and content entry', () => {
    const missing = (media: NonNullable<FeedInput['items'][number]['media']>): FeedInput => ({
      ...plain,
      items: [{ ...plain.items[0], media }],
    })
    expect(() => validateInput(missing({ thumbnails: [{ url: '' }] }), 'rss')).toThrow(
      /item\[0\] media requires a "url"/,
    )
    expect(() => validateInput(missing({ contents: [{ url: '' }] }), 'atom')).toThrow(/media/)
    expect(() => validateInput(withMedia, 'rss')).not.toThrow()
  })
})
