import { describe, expect, it } from 'vitest'
import type { FeedInput } from '../../types'
import { toRSS } from './index'

const base: FeedInput = {
  options: { title: 't', link: 'https://example.com/' },
  items: [{ title: 'a', link: 'https://example.com/1' }],
}

describe('RSS 2.0 podcast namespaces (iTunes / Podcasting 2.0)', () => {
  it('emits every feed-level iTunes element and declares xmlns:itunes', () => {
    const out = toRSS({
      ...base,
      options: {
        ...base.options,
        podcast: {
          author: 'otnc',
          category: ['Technology', 'News'],
          explicit: false,
          image: 'https://example.com/cover.jpg',
          owner: { name: 'otnc', email: 'otnc@example.com' },
          type: 'episodic',
        },
      },
    })
    expect(out).toContain('xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"')
    expect(out).toContain('<itunes:author>otnc</itunes:author>')
    expect(out).toContain('<itunes:category text="Technology"/>')
    expect(out).toContain('<itunes:category text="News"/>')
    expect(out).toContain('<itunes:explicit>false</itunes:explicit>')
    expect(out).toContain('<itunes:image href="https://example.com/cover.jpg"/>')
    expect(out).toContain(
      '<itunes:owner><itunes:name>otnc</itunes:name><itunes:email>otnc@example.com</itunes:email></itunes:owner>',
    )
    expect(out).toContain('<itunes:type>episodic</itunes:type>')
  })

  it('emits every feed-level Podcasting 2.0 element and declares xmlns:podcast', () => {
    const out = toRSS({
      ...base,
      options: {
        ...base.options,
        podcast: {
          guid: '917393e3-1b1e-5cef-ace4-edaa54e1f810',
          locked: true,
          funding: [{ url: 'https://example.com/support', text: 'Support the show' }],
        },
      },
    })
    expect(out).toContain('xmlns:podcast="https://podcastindex.org/namespace/1.0"')
    expect(out).toContain('<podcast:guid>917393e3-1b1e-5cef-ace4-edaa54e1f810</podcast:guid>')
    expect(out).toContain('<podcast:locked>yes</podcast:locked>')
    expect(out).toContain(
      '<podcast:funding url="https://example.com/support">Support the show</podcast:funding>',
    )
  })

  it('locked: false emits podcast:locked as "no"', () => {
    const out = toRSS({
      ...base,
      options: { ...base.options, podcast: { locked: false } },
    })
    expect(out).toContain('<podcast:locked>no</podcast:locked>')
  })

  it('feed-level explicit: true emits itunes:explicit as "true"', () => {
    const out = toRSS({
      ...base,
      options: { ...base.options, podcast: { explicit: true } },
    })
    expect(out).toContain('<itunes:explicit>true</itunes:explicit>')
  })

  it('item-level explicit: false emits itunes:explicit as "false"', () => {
    const out = toRSS({
      ...base,
      items: [{ ...base.items[0], podcast: { explicit: false } }],
    })
    expect(out).toContain('<itunes:explicit>false</itunes:explicit>')
  })

  it('emits every item-level iTunes element', () => {
    const out = toRSS({
      ...base,
      items: [
        {
          ...base.items[0],
          podcast: {
            duration: 1800,
            explicit: true,
            episode: 5,
            season: 2,
            episodeType: 'full',
            image: 'https://example.com/ep5.jpg',
          },
        },
      ],
    })
    expect(out).toContain('<itunes:duration>1800</itunes:duration>')
    expect(out).toContain('<itunes:explicit>true</itunes:explicit>')
    expect(out).toContain('<itunes:episode>5</itunes:episode>')
    expect(out).toContain('<itunes:season>2</itunes:season>')
    expect(out).toContain('<itunes:episodeType>full</itunes:episodeType>')
    expect(out).toContain('<itunes:image href="https://example.com/ep5.jpg"/>')
  })

  it('emits every item-level Podcasting 2.0 element', () => {
    const out = toRSS({
      ...base,
      items: [
        {
          ...base.items[0],
          podcast: {
            transcript: [
              { url: 'https://example.com/1.vtt', type: 'text/vtt' },
              { url: 'https://example.com/1.srt', type: 'application/srt' },
            ],
            chapters: {
              url: 'https://example.com/1-chapters.json',
              type: 'application/json+chapters',
            },
          },
        },
      ],
    })
    expect(out).toContain('<podcast:transcript url="https://example.com/1.vtt" type="text/vtt"/>')
    expect(out).toContain(
      '<podcast:transcript url="https://example.com/1.srt" type="application/srt"/>',
    )
    expect(out).toContain(
      '<podcast:chapters url="https://example.com/1-chapters.json" type="application/json+chapters"/>',
    )
  })

  it('podcast:chapters defaults type to application/json+chapters when omitted', () => {
    const out = toRSS({
      ...base,
      items: [
        {
          ...base.items[0],
          podcast: { chapters: { url: 'https://example.com/1-chapters.json' } },
        },
      ],
    })
    expect(out).toContain(
      '<podcast:chapters url="https://example.com/1-chapters.json" type="application/json+chapters"/>',
    )
  })

  it('itunes:duration prefers item.podcast.duration over enclosure.duration', () => {
    const out = toRSS({
      ...base,
      items: [
        {
          ...base.items[0],
          podcast: { duration: 100 },
          enclosure: { url: 'https://example.com/a.mp3', type: 'audio/mpeg', duration: 200 },
        },
      ],
    })
    expect(out).toContain('<itunes:duration>100</itunes:duration>')
    expect(out).not.toContain('<itunes:duration>200</itunes:duration>')
  })

  it('itunes:duration falls back to enclosure.duration when item.podcast.duration is unset', () => {
    const out = toRSS({
      ...base,
      items: [
        {
          ...base.items[0],
          enclosure: { url: 'https://example.com/a.mp3', type: 'audio/mpeg', duration: 200 },
        },
      ],
    })
    expect(out).toContain('<itunes:duration>200</itunes:duration>')
  })

  it('the enclosure.duration fallback alone still declares xmlns:itunes (no item.podcast at all)', () => {
    const out = toRSS({
      ...base,
      items: [
        {
          ...base.items[0],
          enclosure: { url: 'https://example.com/a.mp3', type: 'audio/mpeg', duration: 200 },
        },
      ],
    })
    expect(out).toContain('xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"')
  })

  it('omits both namespaces and every element when no podcast field is set anywhere', () => {
    const out = toRSS(base)
    expect(out).not.toContain('xmlns:itunes')
    expect(out).not.toContain('xmlns:podcast')
    expect(out).not.toContain('itunes:')
    expect(out).not.toContain('podcast:')
  })

  it('declares only xmlns:itunes when only iTunes fields are used', () => {
    const out = toRSS({ ...base, options: { ...base.options, podcast: { author: 'otnc' } } })
    expect(out).toContain('xmlns:itunes')
    expect(out).not.toContain('xmlns:podcast')
  })

  it('declares only xmlns:podcast when only Podcasting 2.0 fields are used', () => {
    const out = toRSS({ ...base, options: { ...base.options, podcast: { locked: true } } })
    expect(out).toContain('xmlns:podcast')
    expect(out).not.toContain('xmlns:itunes')
  })

  it('an explicit customNamespaces entry wins over the automatic xmlns:itunes declaration', () => {
    const out = toRSS({
      ...base,
      options: {
        ...base.options,
        podcast: { author: 'otnc' },
        customNamespaces: { 'xmlns:itunes': 'urn:custom-itunes' },
      },
    })
    expect(out).toContain('xmlns:itunes="urn:custom-itunes"')
    expect(out).not.toContain('http://www.itunes.com/dtds/podcast-1.0.dtd')
  })

  it('absolutizes itunes:image, itunes:owner is unaffected, and podcast:funding url', () => {
    const out = toRSS(
      {
        ...base,
        options: { ...base.options, podcast: { image: '/cover.jpg', funding: [{ url: '/fund' }] } },
      },
      { baseUrl: 'https://example.com' },
    )
    expect(out).toContain('<itunes:image href="https://example.com/cover.jpg"/>')
    expect(out).toContain('<podcast:funding url="https://example.com/fund"/>')
  })

  it('podcast:funding omits text when unset (self-closing element)', () => {
    const out = toRSS({
      ...base,
      options: { ...base.options, podcast: { funding: [{ url: 'https://example.com/fund' }] } },
    })
    expect(out).toContain('<podcast:funding url="https://example.com/fund"/>')
  })

  it('is ignored on every RSS version other than 2.0 (no elements, no namespace)', () => {
    for (const rssVersion of ['0.94', '0.93', '0.92', '0.91', '1.1', '1.0', '0.90'] as const) {
      const out = toRSS(
        {
          ...base,
          options: {
            ...base.options,
            language: 'en',
            podcast: { author: 'otnc', locked: true },
          },
          items: [{ ...base.items[0], podcast: { duration: 1800 } }],
        },
        { rssVersion, feedUrl: 'https://example.com/feed', suppressDeprecationWarnings: true },
      )
      expect(out).not.toContain('itunes:')
      expect(out).not.toContain('podcast:guid')
      expect(out).not.toContain('podcast:locked')
    }
  })

  it('is ignored by Atom and JSON Feed entirely', async () => {
    const { toAtom } = await import('../atom')
    const { toJSONFeed } = await import('../json')
    const input: FeedInput = {
      options: { ...base.options, podcast: { author: 'otnc', locked: true } },
      items: [{ ...base.items[0], podcast: { duration: 1800 } }],
    }
    const atom = toAtom(input)
    const json = toJSONFeed(input)
    expect(atom).not.toContain('itunes:')
    expect(atom).not.toContain('podcast:')
    expect(json).not.toContain('itunes')
    expect(json).not.toContain('podcast')
  })
})
