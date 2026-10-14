import { describe, expect, it } from 'vitest'
import type { FeedInput, ItemPodcast } from '../../types'
import { toRSS } from './index'

const NS = 'xmlns:podcast="https://podcastindex.org/namespace/1.0"'

const withFeed = (podcast: NonNullable<FeedInput['options']['podcast']>): FeedInput => ({
  options: { title: 't', link: 'https://example.com/', podcast },
  items: [{ title: 'a', link: 'https://example.com/1' }],
})
const withItem = (podcast: ItemPodcast): FeedInput => ({
  options: { title: 't', link: 'https://example.com/' },
  items: [{ title: 'a', link: 'https://example.com/1', podcast }],
})

describe('Podcasting 2.0 shared elements (feed and item level)', () => {
  const shared = {
    person: [
      {
        name: 'Ann Host',
        role: 'host',
        group: 'cast',
        img: '/ann.jpg',
        href: 'https://example.com/ann',
      },
      { name: 'Bob & Guest' },
    ],
    license: { identifier: 'CC-BY-4.0', url: '/license' },
    location: { name: 'Austin, TX', geo: 'geo:30.2672,-97.7431', osm: 'R113314' },
    images: { srcset: 'https://x.test/a-320.jpg 320w, https://x.test/a-640.jpg 640w' },
    socialInteract: [
      {
        protocol: 'activitypub',
        uri: 'https://mastodon.example/@show/1',
        accountId: '@show@mastodon.example',
        accountUrl: 'https://mastodon.example/@show',
        priority: 1,
      },
      { protocol: 'disabled' },
    ],
  }
  const expected = [
    '<podcast:person role="host" group="cast" img="https://example.com/ann.jpg" href="https://example.com/ann">Ann Host</podcast:person>',
    '<podcast:person>Bob &amp; Guest</podcast:person>',
    '<podcast:license url="https://example.com/license">CC-BY-4.0</podcast:license>',
    '<podcast:location geo="geo:30.2672,-97.7431" osm="R113314">Austin, TX</podcast:location>',
    '<podcast:images srcset="https://x.test/a-320.jpg 320w, https://x.test/a-640.jpg 640w"/>',
    '<podcast:socialInteract protocol="activitypub" uri="https://mastodon.example/@show/1" accountId="@show@mastodon.example" accountUrl="https://mastodon.example/@show" priority="1"/>',
    '<podcast:socialInteract protocol="disabled"/>',
  ]
  const opts = { baseUrl: 'https://example.com' }

  it('emits them at feed level, absolutized, and declares xmlns:podcast', () => {
    const out = toRSS(withFeed(shared), opts)
    expect(out).toContain(NS)
    for (const fragment of expected) expect(out).toContain(fragment)
  })

  it('emits them at item level, absolutized, and declares xmlns:podcast', () => {
    const out = toRSS(withItem(shared), opts)
    expect(out).toContain(NS)
    for (const fragment of expected) expect(out).toContain(fragment)
  })
})

describe('Podcasting 2.0 feed-level only elements', () => {
  it('emits podcast:medium', () => {
    const out = toRSS(withFeed({ medium: 'music' }))
    expect(out).toContain(NS)
    expect(out).toContain('<podcast:medium>music</podcast:medium>')
  })

  it('emits podcast:trailer with an RFC 822 pubdate', () => {
    const out = toRSS(
      withFeed({
        trailer: [
          {
            title: 'Season 2 trailer',
            url: 'https://example.com/trailer.mp3',
            pubDate: new Date('2026-03-01T08:00:00Z'),
            length: 12345,
            type: 'audio/mpeg',
            season: 2,
          },
        ],
      }),
    )
    expect(out).toContain(
      '<podcast:trailer url="https://example.com/trailer.mp3" pubdate="Sun, 01 Mar 2026 08:00:00 GMT" length="12345" type="audio/mpeg" season="2">Season 2 trailer</podcast:trailer>',
    )
  })
})

describe('Podcasting 2.0 item-level season and episode', () => {
  it('emits podcast:season with a name and podcast:episode with a display label', () => {
    const out = toRSS(
      withItem({
        podcastSeason: { number: 2, name: 'Race to Mars' },
        podcastEpisode: { number: 12.5, display: 'Ch.12.5' },
      }),
    )
    expect(out).toContain(NS)
    expect(out).toContain('<podcast:season name="Race to Mars">2</podcast:season>')
    expect(out).toContain('<podcast:episode display="Ch.12.5">12.5</podcast:episode>')
  })

  it('is independent of the itunes:season / itunes:episode fields', () => {
    const out = toRSS(withItem({ season: 1, episode: 3, podcastSeason: { number: 1 } }))
    expect(out).toContain('<itunes:season>1</itunes:season>')
    expect(out).toContain('<itunes:episode>3</itunes:episode>')
    expect(out).toContain('<podcast:season>1</podcast:season>')
  })
})

describe('Podcasting 2.0 namespace gating', () => {
  it('does not declare xmlns:podcast when none of the new fields is set', () => {
    expect(toRSS(withFeed({ author: 'a' }))).not.toContain('xmlns:podcast')
    expect(toRSS(withItem({ duration: 5 }))).not.toContain('xmlns:podcast')
  })

  it('leaves older RSS versions untouched', () => {
    expect(toRSS(withFeed({ medium: 'music' }), { rssVersion: '0.92' })).not.toContain('podcast:')
  })
})
