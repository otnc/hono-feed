import { describe, expect, it } from 'vitest'
import type { FeedInput } from '../../types'
import { toAtom, validateInput } from './index'

const input: FeedInput = {
  options: {
    title: 'example blog',
    link: 'https://example.com/',
    language: 'en',
    updated: new Date('2026-06-29T00:00:00Z'),
  },
  items: [
    {
      title: 'post 1',
      link: 'https://example.com/1',
      published: new Date('2026-06-29T00:00:00Z'),
      content: '<p>body</p>',
    },
  ],
}

describe('toAtom', () => {
  const xml = toAtom(input, { feedUrl: 'https://example.com/feed' })

  it('emits required id/title/updated and escaped html content', () => {
    expect(xml).toContain('<id>https://example.com/</id>')
    expect(xml).toContain('<updated>2026-06-29T00:00:00.000Z</updated>')
    expect(xml).toContain('xml:lang="en"')
    expect(xml).toContain('<content type="html">&lt;p&gt;body&lt;/p&gt;</content>')
  })

  it('emits self/alternate links and a full author', () => {
    const out = toAtom(
      {
        options: {
          title: 't',
          link: 'https://example.com/',
          author: { name: 'otnc', email: 'otnc@example.com', url: 'https://example.com/otnc' },
        },
        items: [
          { title: 'a', link: 'https://example.com/1', updated: new Date('2026-06-29T00:00:00Z') },
        ],
      },
      { feedUrl: 'https://example.com/feed' },
    )
    expect(out).toContain('<link rel="alternate" href="https://example.com/"/>')
    expect(out).toContain(
      '<link rel="self" type="application/atom+xml" href="https://example.com/feed"/>',
    )
    expect(out).toContain('<email>otnc@example.com</email>')
    expect(out).toContain('<uri>https://example.com/otnc</uri>')
  })

  it('escapes text and attributes', () => {
    const out = toAtom({
      ...input,
      items: [{ ...input.items[0], title: '<x> & "q"', categories: [{ term: `a"b'c` }] }],
    })
    expect(out).toContain('<title>&lt;x&gt; &amp; "q"</title>')
    expect(out).toContain('term="a&quot;b&apos;c"')
  })

  it('escapes html content as a text node and strips control chars from title/content', () => {
    const out = toAtom({
      ...input,
      // \u0007 (bell) is invalid XML; it must be dropped from both the title and the
      // type="html" content (which is emitted as an escaped text node).
      items: [{ ...input.items[0], title: 'a\u0007b', content: '<p>c\u0007d & e</p>' }],
    })
    expect(out).toContain('<title>ab</title>')
    expect(out).toContain('<content type="html">&lt;p&gt;cd &amp; e&lt;/p&gt;</content>')
    expect(out).not.toContain('\u0007')
  })

  it('emits Atom 0.3 when atomVersion is 0.3', () => {
    const out = toAtom(input, { atomVersion: '0.3' })
    expect(out).toContain('<feed version="0.3" xmlns="http://purl.org/atom/ns#"')
    expect(out).toContain('<modified>2026-06-29T00:00:00.000Z</modified>')
    expect(out).toContain('<issued>2026-06-29T00:00:00.000Z</issued>')
    expect(out).toContain(
      '<content type="text/html" mode="escaped">&lt;p&gt;body&lt;/p&gt;</content>',
    )
  })

  it('throws when neither id, link nor feedUrl can supply the Atom feed id', () => {
    expect(() => toAtom({ options: { title: 't' }, items: [] })).toThrow(/requires an id/)
    expect(() => toAtom({ options: { title: 't' }, items: [] }, { atomVersion: '0.3' })).toThrow(
      /requires an id/,
    )
  })

  it('throws when an entry has neither id nor link', () => {
    const noEntryId = {
      options: { title: 't', link: 'https://example.com/' },
      items: [{ title: 'a', updated: new Date('2026-06-29T00:00:00Z') }],
    }
    expect(() => toAtom(noEntryId)).toThrow(/Atom entry requires an id/)
    expect(() => toAtom(noEntryId, { atomVersion: '0.3' })).toThrow(/Atom 0.3 entry requires an id/)
  })

  describe('Atom 1.0 optional fields', () => {
    it('emits rights, subtitle and a category without a scheme', () => {
      const out = toAtom({
        options: {
          title: 't',
          link: 'https://example.com/',
          description: 'a subtitle',
          copyright: '© otnc',
          updated: new Date('2026-06-29T00:00:00Z'),
        },
        items: [
          {
            title: 'a',
            link: 'https://example.com/1',
            updated: new Date('2026-06-29T00:00:00Z'),
            categories: [{ term: 'tech' }],
          },
        ],
      })
      expect(out).toContain('<subtitle>a subtitle</subtitle>')
      expect(out).toContain('<rights>© otnc</rights>')
      expect(out).toMatch(/<category term="tech"\/>/)
    })

    it('falls back to published for updated, and omits the published element when absent', () => {
      const out = toAtom({
        options: { title: 't', link: 'https://example.com/' },
        items: [
          {
            title: 'a',
            link: 'https://example.com/1',
            published: new Date('2026-06-29T00:00:00Z'),
          },
        ],
      })
      const entry = out.match(/<entry>([\s\S]*?)<\/entry>/)?.[1] ?? ''
      expect(entry).toContain('<updated>2026-06-29T00:00:00.000Z</updated>')
      expect(entry).toContain('<published>2026-06-29T00:00:00.000Z</published>')
    })

    it('falls back to the feed link when neither id nor a real update source is given', () => {
      const out = toAtom({
        options: { title: 't', link: 'https://example.com/' },
        items: [],
      })
      expect(out).toContain('<id>https://example.com/</id>')
      expect(out).toMatch(/<updated>([^<]+)<\/updated>/)
    })

    it('omits the entry <link> when the item has an id but no link', () => {
      const out = toAtom({
        options: { title: 't', link: 'https://example.com/' },
        items: [
          {
            title: 'a',
            id: 'urn:uuid:1',
            content: '<p>b</p>',
            updated: new Date('2026-06-29T00:00:00Z'),
          },
        ],
      })
      const entry = out.match(/<entry>([\s\S]*?)<\/entry>/)?.[1] ?? ''
      expect(entry).not.toContain('<link')
    })

    it('renders per-item authors as <author> elements', () => {
      const out = toAtom({
        options: { title: 't', link: 'https://example.com/' },
        items: [
          {
            title: 'a',
            link: 'https://example.com/1',
            updated: new Date('2026-06-29T00:00:00Z'),
            author: [{ name: 'one' }, { name: 'two', url: 'https://example.com/two' }],
          },
        ],
      })
      expect(out.match(/<author>/g)).toHaveLength(2)
      expect(out).toContain('<name>one</name>')
      expect(out).toContain('<uri>https://example.com/two</uri>')
    })

    it('falls back to "now" for entry <updated> when neither updated nor published is set', () => {
      const out = toAtom({
        options: { title: 't', link: 'https://example.com/' },
        items: [{ title: 'a', link: 'https://example.com/1' }],
      })
      const entryUpdated = out.match(/<entry>[\s\S]*?<updated>(.*?)<\/updated>/)?.[1]
      expect(entryUpdated).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })
  })

  describe('Atom 0.3 optional fields', () => {
    it('emits tagline and copyright, and omits <link> when link is absent', () => {
      const out = toAtom(
        {
          options: {
            title: 't',
            id: 'https://example.com/',
            description: 'a tagline',
            copyright: '© otnc',
          },
          items: [],
        },
        { atomVersion: '0.3' },
      )
      expect(out).toContain('<tagline>a tagline</tagline>')
      expect(out).toContain('<copyright>© otnc</copyright>')
      expect(out).not.toContain('<link')
    })

    it('emits a summary from description when content is absent', () => {
      const out = toAtom(
        {
          options: { title: 't', link: 'https://example.com/' },
          items: [
            {
              title: 'a',
              link: 'https://example.com/1',
              description: 'a summary',
              updated: new Date('2026-06-29T00:00:00Z'),
            },
          ],
        },
        { atomVersion: '0.3' },
      )
      expect(out).toContain('<summary>a summary</summary>')
      expect(out).not.toContain('<content')
    })

    it('falls back to updated for issued when published is absent', () => {
      const out = toAtom(
        {
          options: { title: 't', link: 'https://example.com/' },
          items: [
            {
              title: 'a',
              link: 'https://example.com/1',
              updated: new Date('2026-06-29T00:00:00Z'),
            },
          ],
        },
        { atomVersion: '0.3', suppressDeprecationWarnings: true },
      )
      const entry = out.match(/<entry>([\s\S]*?)<\/entry>/)?.[1] ?? ''
      expect(entry).toContain('<issued>2026-06-29T00:00:00.000Z</issued>')
      expect(entry).toContain('<modified>2026-06-29T00:00:00.000Z</modified>')
    })

    it('omits the entry <link> when the item has an id but no link', () => {
      const out = toAtom(
        {
          options: { title: 't', link: 'https://example.com/' },
          items: [{ title: 'a', id: 'urn:uuid:1', content: '<p>b</p>' }],
        },
        { atomVersion: '0.3' },
      )
      const entry = out.match(/<entry>([\s\S]*?)<\/entry>/)?.[1] ?? ''
      expect(entry).not.toContain('<link')
    })

    it('falls back to "now" for issued/modified when neither published nor updated is set', () => {
      const out = toAtom(
        {
          options: { title: 't', link: 'https://example.com/' },
          items: [{ title: 'a', link: 'https://example.com/1' }],
        },
        { atomVersion: '0.3' },
      )
      const issued = out.match(/<issued>(.*?)<\/issued>/)?.[1]
      const modified = out.match(/<modified>(.*?)<\/modified>/g)
      expect(issued).toMatch(/^\d{4}-\d{2}-\d{2}T/)
      expect(modified).toHaveLength(2) // one feed-level, one entry-level
    })

    it('renders multiple item authors as repeated <author> elements', () => {
      const out = toAtom(
        {
          options: { title: 't', link: 'https://example.com/' },
          items: [
            {
              title: 'a',
              link: 'https://example.com/1',
              updated: new Date('2026-06-29T00:00:00Z'),
              author: [{ name: 'one' }, { name: 'two', url: 'https://example.com/two' }],
            },
          ],
        },
        { atomVersion: '0.3' },
      )
      expect(out.match(/<author>/g)).toHaveLength(2)
      expect(out).toContain('<name>one</name>')
      expect(out).toContain('<name>two</name>')
      expect(out).toContain('<url>https://example.com/two</url>')
    })
  })
})

describe('validateInput (re-exported for this subpath)', () => {
  it('is importable alongside toAtom', () => {
    expect(() => validateInput({ options: { title: '' }, items: [] }, 'atom')).toThrow(
      /feed "title" is required/,
    )
  })
})
