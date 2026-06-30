import { describe, expect, it } from 'vitest'
import type { FeedInput } from '../../types'
import { toAtom } from './index'

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
})
