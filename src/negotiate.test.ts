import { describe, expect, it } from 'vitest'
import {
  formatFromExtension,
  formatFromQuery,
  isAtomVersion,
  isJsonFeedVersion,
  isRssVersion,
  negotiateFormat,
  parseAccept,
  rejectsAllFormats,
  resolveFallbackFormat,
  versionFromQuery,
} from './negotiate'

describe('parseAccept', () => {
  it('sorts by q desc then specificity desc, defaulting q to 1', () => {
    const entries = parseAccept('*/*;q=0.8, application/json, application/*;q=0.9')
    expect(entries.map((e) => `${e.type}/${e.subtype}`)).toEqual([
      'application/json',
      'application/*',
      '*/*',
    ])
    expect(entries[0].q).toBe(1)
  })

  it('clamps out-of-range q values and returns [] for an empty header', () => {
    expect(parseAccept('application/json;q=5')[0].q).toBe(1)
    expect(parseAccept('application/json;q=-1')[0].q).toBe(0)
    expect(parseAccept(undefined)).toEqual([])
  })

  it('breaks ties on equal q by specificity (type/subtype > type/* > */*)', () => {
    const entries = parseAccept('*/*;q=0.5, text/plain;q=0.5, application/*;q=0.5')
    expect(entries.map((e) => `${e.type}/${e.subtype}`)).toEqual([
      'text/plain',
      'application/*',
      '*/*',
    ])
  })

  it('preserves header order for entries tied on both q and specificity', () => {
    const entries = parseAccept('application/rss+xml, application/atom+xml')
    expect(entries.map((e) => `${e.type}/${e.subtype}`)).toEqual([
      'application/rss+xml',
      'application/atom+xml',
    ])
  })

  it('captures non-q accept-params without affecting q', () => {
    const entries = parseAccept('text/html;charset=utf-8;q=0.8')
    expect(entries[0].params).toEqual({ charset: 'utf-8' })
    expect(entries[0].q).toBe(0.8)
  })

  it('skips malformed entries missing a type or subtype', () => {
    expect(parseAccept('garbage, application/json')).toHaveLength(1)
    expect(parseAccept('application/, /json, application/json')).toHaveLength(1)
  })

  it('skips empty segments (trailing/leading/double commas)', () => {
    expect(parseAccept(', application/json, , ')).toHaveLength(1)
  })

  it('ignores a bare accept-param with no "=" ', () => {
    const entries = parseAccept('application/json;foo;q=0.5')
    expect(entries[0].params).toEqual({})
    expect(entries[0].q).toBe(0.5)
  })

  it('defaults q to 1 when the q value is not a number', () => {
    expect(parseAccept('application/json;q=abc')[0].q).toBe(1)
  })

  it('does not split a quoted parameter value on an internal comma', () => {
    const entries = parseAccept('application/feed+json;profile="a,b";q=0.9, application/atom+xml')
    expect(entries).toHaveLength(2)
    const json = entries.find((e) => e.subtype === 'feed+json')
    expect(json?.params).toEqual({ profile: 'a,b' })
    expect(json?.q).toBe(0.9)
    expect(entries.find((e) => e.subtype === 'atom+xml')?.q).toBe(1)
  })

  it('does not split a quoted parameter value on an internal semicolon', () => {
    const entries = parseAccept('application/json;profile="a;b";q=0.7')
    expect(entries[0].params).toEqual({ profile: 'a;b' })
    expect(entries[0].q).toBe(0.7)
  })

  it('unescapes a backslash-escaped quote inside a quoted parameter value', () => {
    const entries = parseAccept(String.raw`application/json;profile="a\"b"`)
    expect(entries[0].params).toEqual({ profile: 'a"b' })
  })

  it('leaves an unquoted parameter value untouched', () => {
    expect(parseAccept('text/html;charset=utf-8')[0].params).toEqual({ charset: 'utf-8' })
  })
})

describe('formatFromQuery', () => {
  it('accepts only known formats', () => {
    expect(formatFromQuery('atom')).toBe('atom')
    expect(formatFromQuery('xml')).toBeNull()
    expect(formatFromQuery(null)).toBeNull()
  })
})

describe('negotiateFormat', () => {
  it('resolves explicit MIME types', () => {
    expect(negotiateFormat('application/atom+xml', 'rss')).toBe('atom')
    expect(negotiateFormat('application/json', 'rss')).toBe('json')
  })

  it('picks the winner by q value', () => {
    expect(negotiateFormat('application/rss+xml;q=0.5, application/atom+xml;q=0.9', 'rss')).toBe(
      'atom',
    )
  })

  it('honours q=0 rejection', () => {
    expect(negotiateFormat('application/rss+xml;q=0, application/atom+xml', 'rss')).toBe('atom')
  })

  it('maps */* to defaultFormat and null when absent', () => {
    expect(negotiateFormat('*/*', 'atom')).toBe('atom')
    expect(negotiateFormat(undefined, 'rss')).toBeNull()
  })

  it('returns null when no entry maps to a known format', () => {
    expect(negotiateFormat('text/plain', 'rss')).toBeNull()
  })

  it('a specific media type at q>0 overrides a q=0 wildcard (RFC 9110 §12.5.1 precedence)', () => {
    expect(negotiateFormat('application/rss+xml, */*;q=0', 'rss')).toBe('rss')
    expect(negotiateFormat('application/*;q=0, application/json', 'rss')).toBe('json')
  })

  it('a q=0 wildcard still rejects formats it is the only opinion on', () => {
    expect(negotiateFormat('application/rss+xml;q=0, */*;q=0', 'rss')).toBeNull()
  })

  it('a q=0 entry for an unmapped type is a no-op (does not reject anything)', () => {
    expect(negotiateFormat('text/plain;q=0, application/json', 'rss')).toBe('json')
  })
})

describe('resolveFallbackFormat', () => {
  it('returns defaultFormat for an absent header or one that says nothing about it', () => {
    expect(resolveFallbackFormat(undefined, 'rss')).toBe('rss')
    expect(resolveFallbackFormat('application/atom+xml;q=0', 'rss')).toBe('rss')
  })

  it('does not resurrect a format the header explicitly rejected', () => {
    expect(resolveFallbackFormat('application/rss+xml;q=0', 'rss')).toBe('atom')
    expect(resolveFallbackFormat('application/rss+xml;q=0, application/atom+xml;q=0', 'rss')).toBe(
      'json',
    )
  })

  it('falls back to defaultFormat when every format is rejected', () => {
    expect(resolveFallbackFormat('*/*;q=0', 'rss')).toBe('rss')
  })
})

describe('rejectsAllFormats', () => {
  it('true for a q=0 wildcard', () => {
    expect(rejectsAllFormats('*/*;q=0')).toBe(true)
    expect(rejectsAllFormats('application/*;q=0')).toBe(true)
  })

  it('true when every known format is individually rejected at q=0', () => {
    expect(
      rejectsAllFormats(
        'application/rss+xml;q=0, application/atom+xml;q=0, application/feed+json;q=0, application/json;q=0',
      ),
    ).toBe(true)
  })

  it('false when at least one format is still acceptable', () => {
    expect(rejectsAllFormats('application/rss+xml;q=0, application/atom+xml')).toBe(false)
  })

  it('false when a specific media type at q>0 overrides a q=0 wildcard', () => {
    expect(rejectsAllFormats('application/rss+xml, */*;q=0')).toBe(false)
  })

  it('false for an absent or empty header — that is "no match", not a rejection', () => {
    expect(rejectsAllFormats(undefined)).toBe(false)
    expect(rejectsAllFormats(null)).toBe(false)
  })

  it('false when the header simply mentions unrelated types', () => {
    expect(rejectsAllFormats('text/html')).toBe(false)
  })
})

describe('formatFromExtension', () => {
  it('detects known extensions', () => {
    expect(formatFromExtension('/feed.atom.xml')).toBe('atom')
    expect(formatFromExtension('/feed.json')).toBe('json')
    expect(formatFromExtension('/feed.xml')).toBe('rss')
    expect(formatFromExtension('/feed')).toBeNull()
  })

  it('detects the bare .rss / .atom extensions (without a further .xml suffix)', () => {
    expect(formatFromExtension('/feed.rss')).toBe('rss')
    expect(formatFromExtension('/feed.atom')).toBe('atom')
  })
})

describe('versionFromQuery', () => {
  it('returns undefined when the param is absent, the version when known, "invalid" otherwise', () => {
    expect(versionFromQuery(null, isRssVersion)).toBeUndefined()
    expect(versionFromQuery('0.91', isRssVersion)).toBe('0.91')
    expect(versionFromQuery('9.9', isRssVersion)).toBe('invalid')

    expect(versionFromQuery(null, isAtomVersion)).toBeUndefined()
    expect(versionFromQuery('0.3', isAtomVersion)).toBe('0.3')
    expect(versionFromQuery('2.0', isAtomVersion)).toBe('invalid')

    expect(versionFromQuery(null, isJsonFeedVersion)).toBeUndefined()
    expect(versionFromQuery('1', isJsonFeedVersion)).toBe('1')
    expect(versionFromQuery('2', isJsonFeedVersion)).toBe('invalid')
  })
})
