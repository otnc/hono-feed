import { describe, expect, it } from 'vitest'
import {
  formatFromExtension,
  formatFromQuery,
  isAtomVersion,
  isJsonFeedVersion,
  isRssVersion,
  negotiateFormat,
  parseAccept,
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

  it('a q=0 wildcard rejects every format, even ones explicitly listed', () => {
    expect(negotiateFormat('application/rss+xml, */*;q=0', 'rss')).toBeNull()
    expect(negotiateFormat('application/*;q=0, application/json', 'rss')).toBeNull()
  })

  it('a q=0 entry for an unmapped type is a no-op (does not reject anything)', () => {
    expect(negotiateFormat('text/plain;q=0, application/json', 'rss')).toBe('json')
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
