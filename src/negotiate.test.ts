import { describe, expect, it } from 'vitest'
import { formatFromExtension, formatFromQuery, negotiateFormat, parseAccept } from './negotiate'

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
})

describe('formatFromExtension', () => {
  it('detects known extensions', () => {
    expect(formatFromExtension('/feed.atom.xml')).toBe('atom')
    expect(formatFromExtension('/feed.json')).toBe('json')
    expect(formatFromExtension('/feed.xml')).toBe('rss')
    expect(formatFromExtension('/feed')).toBeNull()
  })
})
