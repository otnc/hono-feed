import { describe, expect, expectTypeOf, it } from 'vitest'
import type {
  FeedOptions,
  FeedPodcast,
  ItemPodcast,
  PodcastChapters,
  PodcastFunding,
  PodcastOwner,
  PodcastTranscript,
} from './index'
import * as honoFeed from './index'

describe('package root', () => {
  it('exports the documented runtime API', () => {
    expect(Object.keys(honoFeed).sort()).toEqual([
      'Feed',
      'feedExtensionMap',
      'feedMiddleware',
      'lintInput',
      'notifyHub',
      'paginate',
      'serveFeed',
      'serveOpml',
      'toAtom',
      'toJSONFeed',
      'toOPML',
      'toRSS',
      'validateInput',
    ])
  })

  it('serializes with the exported functions', () => {
    const input = {
      options: { title: 't', link: 'https://example.com/', author: { name: 'a' } },
      items: [{ title: 'post', link: 'https://example.com/1', content: '<p>body</p>' }],
    }
    expect(honoFeed.toRSS(input)).toContain('<rss version="2.0"')
    expect(honoFeed.toAtom(input)).toContain('xmlns="http://www.w3.org/2005/Atom"')
    expect(JSON.parse(honoFeed.toJSONFeed(input)).version).toBe('https://jsonfeed.org/version/1.1')
  })
})

describe('public podcast types', () => {
  it('are the types used by FeedOptions and FeedItem', () => {
    expectTypeOf<FeedOptions['podcast']>().toEqualTypeOf<FeedPodcast | undefined>()
    expectTypeOf<FeedPodcast['owner']>().toEqualTypeOf<PodcastOwner | undefined>()
    expectTypeOf<FeedPodcast['funding']>().toEqualTypeOf<PodcastFunding[] | undefined>()
    expectTypeOf<ItemPodcast['transcript']>().toEqualTypeOf<PodcastTranscript[] | undefined>()
    expectTypeOf<ItemPodcast['chapters']>().toEqualTypeOf<PodcastChapters | undefined>()
  })
})
