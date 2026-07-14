import { XMLParser, XMLValidator } from 'fast-xml-parser'
import { describe, expect, it } from 'vitest'
import type { FeedInput } from '../types'
import { toAtom, toRSS } from './index'

// Every other XML assertion in this test suite is a string check (toContain/toMatch)
// against the serialized output, so well-formedness and round-trip fidelity are only
// ever guaranteed transitively through the per-function escaping unit tests. This file
// instead runs a real, spec-conformant XML parser against the output, pinning the
// property feed readers actually depend on: no reachable input produces a document a
// conforming parser reads differently than intended. fast-xml-parser is a devDependency
// only — the published package stays runtime-dependency-free.
const parser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: false,
  // Decodes numeric character references (e.g. `&#xD;`) in addition to the five
  // predefined XML entities — needed to verify escapeText/escapeAttr's CR handling.
  htmlEntities: true,
})

function isWellFormed(xml: string): boolean {
  return XMLValidator.validate(xml) === true
}

// The pretty-printer only adds inter-element indentation/newlines, which — unlike the
// hostile-value round-trip above — this comparison doesn't care about, so whitespace-only
// text nodes are trimmed away instead of compared.
const structureParser = new XMLParser({ ignoreAttributes: false, htmlEntities: true })

// Grabs the first `<tag ...>...</tag>` or `<tag .../>` occurrence and parses it in
// isolation, returning both its text content (if any) and its attributes. The lookahead
// after the tag name guards against e.g. `title` matching inside an unrelated `titles`.
function elementOf(xml: string, tag: string): { text?: string; attrs: Record<string, string> } {
  const match = xml.match(new RegExp(`<${tag}(?=[\\s/>])(?:\\s[^>]*)?(?:/>|>[\\s\\S]*?</${tag}>)`))
  if (!match) throw new Error(`<${tag}> not found in: ${xml}`)
  const parsed = parser.parse(`<r>${match[0]}</r>`).r[tag]
  if (typeof parsed === 'string') return { text: parsed, attrs: {} }
  if (parsed === undefined || parsed === '') return { attrs: {} }
  const { '#text': text, ...attrs } = parsed
  return { text, attrs }
}

// Isolates the first <item>/<entry> block so element lookups inside it can't accidentally
// match the channel/feed-level element of the same name. The lookahead after the tag name
// guards against e.g. `item` matching RSS 1.0/1.1's `<items rdf:parseType="Collection">`.
function firstBlock(xml: string, tag: 'item' | 'entry'): string {
  const match = xml.match(new RegExp(`<${tag}(?=[\\s>])[^>]*>[\\s\\S]*?</${tag}>`))
  if (!match) throw new Error(`<${tag}> block not found in: ${xml}`)
  return match[0]
}

// Exercises every branch of the shared escaping pipeline (escapeText/escapeAttr/cdata in
// ../utils/xml.ts) in one string: XML-significant characters, a quote pair, the CDATA
// terminator, CR/CRLF/tab, and non-ASCII (CJK) plus astral-plane (emoji) code points.
const HOSTILE = '& < > "q" \'r\' \r\n\t 日本語 😀 ]]>'
// XML 1.0 §2.11: a CDATA section can't escape a literal CR, so a conforming parser
// normalizes any CR/CRLF inside one to LF — this is what a CDATA round-trip must produce.
const HOSTILE_IN_CDATA = HOSTILE.replace(/\r\n?/g, '\n')

// A "spec-complete" RSS input — every field a conformant document needs, across every
// RSS variant — with hostile content injected into title/description/content/category so
// the same fixture doubles as the escaping-pipeline round-trip case.
const rssComplete: FeedInput = {
  options: {
    title: 'example blog',
    link: 'https://example.com/',
    description: HOSTILE,
    language: 'en',
    updated: new Date('2026-06-29T00:00:00Z'),
    published: new Date('2026-06-29T00:00:00Z'),
    image: 'https://example.com/icon.png',
    categories: [{ term: HOSTILE, scheme: 'https://example.com/cats' }],
  },
  items: [
    {
      title: HOSTILE,
      id: 'https://example.com/1',
      link: 'https://example.com/1',
      description: HOSTILE,
      content: HOSTILE,
      published: new Date('2026-06-29T00:00:00Z'),
      categories: [{ term: HOSTILE }],
      enclosure: { url: 'https://example.com/a.mp3', type: 'audio/mpeg', length: 123 },
    },
  ],
}

const rssOpts = { baseUrl: 'https://example.com', feedUrl: 'https://example.com/feed' } as const

// A "spec-complete" Atom input — feed-level author so the RFC 4287 §4.1.1 rule is
// satisfied without relying on unvalidated fallbacks — with the same hostile content.
const atomComplete: FeedInput = {
  options: {
    title: HOSTILE,
    link: 'https://example.com/',
    description: HOSTILE,
    id: 'https://example.com/',
    updated: new Date('2026-06-29T00:00:00Z'),
    author: { name: 'otnc', email: 'otnc@example.com' },
    categories: [{ term: HOSTILE, scheme: 'https://example.com/cats' }],
    image: 'https://example.com/logo.png',
    favicon: 'https://example.com/favicon.ico',
  },
  items: [
    {
      title: HOSTILE,
      id: 'https://example.com/1',
      link: 'https://example.com/1',
      published: new Date('2026-06-29T00:00:00Z'),
      updated: new Date('2026-06-29T01:00:00Z'),
      description: HOSTILE,
      content: HOSTILE,
      categories: [{ term: HOSTILE }],
      enclosure: { url: 'https://example.com/ep1.mp3', type: 'audio/mpeg', length: 12345 },
    },
  ],
}

const atomOpts = { baseUrl: 'https://example.com', feedUrl: 'https://example.com/feed' } as const

describe('XML well-formedness for a fully-populated, hostile-content feed', () => {
  for (const rssVersion of ['2.0', '0.94', '0.93', '0.92', '0.91', '0.90', '1.0', '1.1'] as const) {
    it(`RSS ${rssVersion} parses as well-formed XML`, () => {
      const xml = toRSS(rssComplete, {
        ...rssOpts,
        rssVersion,
        suppressDeprecationWarnings: true,
      })
      expect(isWellFormed(xml)).toBe(true)
      expect(() => parser.parse(xml)).not.toThrow()
    })
  }

  for (const atomVersion of ['1.0', '0.3'] as const) {
    it(`Atom ${atomVersion} parses as well-formed XML`, () => {
      const xml = toAtom(atomComplete, {
        ...atomOpts,
        atomVersion,
        suppressDeprecationWarnings: true,
      })
      expect(isWellFormed(xml)).toBe(true)
      expect(() => parser.parse(xml)).not.toThrow()
    })
  }
})

describe('pretty: true parses identically to compact output', () => {
  it('RSS 2.0', () => {
    const compact = toRSS(rssComplete, { ...rssOpts, rssVersion: '2.0' })
    const pretty = toRSS(rssComplete, { ...rssOpts, rssVersion: '2.0', pretty: true })
    expect(structureParser.parse(pretty)).toEqual(structureParser.parse(compact))
  })

  it('RSS 1.0 (RDF)', () => {
    const compact = toRSS(rssComplete, { ...rssOpts, rssVersion: '1.0' })
    const pretty = toRSS(rssComplete, { ...rssOpts, rssVersion: '1.0', pretty: true })
    expect(structureParser.parse(pretty)).toEqual(structureParser.parse(compact))
  })

  it('Atom 1.0', () => {
    const compact = toAtom(atomComplete, atomOpts)
    const pretty = toAtom(atomComplete, { ...atomOpts, pretty: true })
    expect(structureParser.parse(pretty)).toEqual(structureParser.parse(compact))
  })
})

describe('RSS 2.0: hostile-value round-trip against the shared escaping pipeline', () => {
  const xml = toRSS(rssComplete, { ...rssOpts, rssVersion: '2.0' })
  const item = firstBlock(xml, 'item')

  it('channel category term (text) and domain (attribute) round-trip exactly', () => {
    const category = elementOf(xml.split('<item')[0], 'category')
    expect(category.text).toBe(HOSTILE)
    expect(category.attrs['@_domain']).toBe('https://example.com/cats')
  })

  it('item title (text) round-trips exactly', () => {
    expect(elementOf(item, 'title').text).toBe(HOSTILE)
  })

  it('item description (CDATA) round-trips with XML 1.0 CR normalization', () => {
    expect(elementOf(item, 'description').text).toBe(HOSTILE_IN_CDATA)
  })

  it('item content:encoded (CDATA) round-trips with XML 1.0 CR normalization', () => {
    expect(elementOf(item, 'content:encoded').text).toBe(HOSTILE_IN_CDATA)
  })

  it('item category term (text, no domain) round-trips exactly', () => {
    const category = elementOf(item, 'category')
    expect(category.text).toBe(HOSTILE)
    expect(category.attrs['@_domain']).toBeUndefined()
  })
})

describe('RSS 0.90: hostile-value round-trip (plain text only, no CDATA in this variant)', () => {
  it('channel description and item title round-trip exactly', () => {
    const xml = toRSS(rssComplete, {
      ...rssOpts,
      rssVersion: '0.90',
      suppressDeprecationWarnings: true,
    })
    expect(elementOf(xml.split('<item')[0], 'description').text).toBe(HOSTILE)
    expect(elementOf(firstBlock(xml, 'item'), 'title').text).toBe(HOSTILE)
  })
})

describe('RSS 1.0/1.1 (RDF): hostile-value round-trip against the shared escaping pipeline', () => {
  for (const rssVersion of ['1.0', '1.1'] as const) {
    it(`${rssVersion}: item title, plain-text description, CDATA content:encoded, and dc:subject round-trip exactly`, () => {
      const xml = toRSS(rssComplete, { ...rssOpts, rssVersion })
      const item = firstBlock(xml, 'item')
      expect(elementOf(item, 'title').text).toBe(HOSTILE)
      expect(elementOf(item, 'description').text).toBe(HOSTILE)
      expect(elementOf(item, 'content:encoded').text).toBe(HOSTILE_IN_CDATA)
      expect(elementOf(item, 'dc:subject').text).toBe(HOSTILE)
    })
  }
})

describe('Atom 1.0: hostile-value round-trip against the shared escaping pipeline', () => {
  const xml = toAtom(atomComplete, atomOpts)
  const entry = firstBlock(xml, 'entry')

  it('feed title (text) round-trips exactly', () => {
    expect(elementOf(xml.split('<entry')[0], 'title').text).toBe(HOSTILE)
  })

  it('feed category term/scheme (attributes) round-trip exactly', () => {
    const category = elementOf(xml.split('<entry')[0], 'category')
    expect(category.attrs['@_term']).toBe(HOSTILE)
    expect(category.attrs['@_scheme']).toBe('https://example.com/cats')
  })

  it('entry title (text) round-trips exactly', () => {
    expect(elementOf(entry, 'title').text).toBe(HOSTILE)
  })

  it('entry summary (plain text, no CDATA in Atom) round-trips exactly', () => {
    expect(elementOf(entry, 'summary').text).toBe(HOSTILE)
  })

  it('entry content type="html" (plain text, no CDATA in Atom) round-trips exactly', () => {
    const content = elementOf(entry, 'content')
    expect(content.text).toBe(HOSTILE)
    expect(content.attrs['@_type']).toBe('html')
  })

  it('entry category term (attribute, no scheme) round-trips exactly', () => {
    const category = elementOf(entry, 'category')
    expect(category.attrs['@_term']).toBe(HOSTILE)
    expect(category.attrs['@_scheme']).toBeUndefined()
  })
})

describe('Atom 0.3: hostile-value round-trip against the shared escaping pipeline', () => {
  it('feed title and entry title/summary round-trip exactly', () => {
    const xml = toAtom(atomComplete, {
      ...atomOpts,
      atomVersion: '0.3',
      suppressDeprecationWarnings: true,
    })
    const entry = firstBlock(xml, 'entry')
    expect(elementOf(xml.split('<entry')[0], 'title').text).toBe(HOSTILE)
    expect(elementOf(entry, 'title').text).toBe(HOSTILE)
    expect(elementOf(entry, 'summary').text).toBe(HOSTILE)
  })
})
