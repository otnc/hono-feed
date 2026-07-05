import {
  ATOM_VERSIONS,
  type AtomVersion,
  FEED_FORMATS,
  type FeedFormat,
  JSON_FEED_VERSIONS,
  type JsonFeedVersion,
  RSS_VERSIONS,
  type RssVersion,
} from './types'

export interface AcceptEntry {
  type: string
  subtype: string
  q: number
  params: Record<string, string>
}

const MIME_FORMAT: Record<string, FeedFormat> = {
  'application/rss+xml': 'rss',
  'application/atom+xml': 'atom',
  'application/feed+json': 'json',
  'application/json': 'json',
  'application/xml': 'rss',
  'text/xml': 'rss',
}

// Sets built from the arrays in types.ts, so the accepted literals live in exactly one place.
const FEED_FORMAT_SET = new Set<string>(FEED_FORMATS)
const RSS_VERSION_SET = new Set<string>(RSS_VERSIONS)
const ATOM_VERSION_SET = new Set<string>(ATOM_VERSIONS)
const JSON_FEED_VERSION_SET = new Set<string>(JSON_FEED_VERSIONS)

export function isFeedFormat(v: unknown): v is FeedFormat {
  return typeof v === 'string' && FEED_FORMAT_SET.has(v)
}

export function isRssVersion(v: unknown): v is RssVersion {
  return typeof v === 'string' && RSS_VERSION_SET.has(v)
}

export function isAtomVersion(v: unknown): v is AtomVersion {
  return typeof v === 'string' && ATOM_VERSION_SET.has(v)
}

export function isJsonFeedVersion(v: unknown): v is JsonFeedVersion {
  return typeof v === 'string' && JSON_FEED_VERSION_SET.has(v)
}

/** Resolve a format from the query. */
export function formatFromQuery(value: string | null | undefined): FeedFormat | null {
  return isFeedFormat(value) ? value : null
}

/**
 * Resolve a version from a query value against a type guard (`isRssVersion` and friends).
 * `undefined` means the query didn't carry the param at all; `'invalid'` means it did, but
 * with a value the guard rejects.
 */
export function versionFromQuery<T extends string>(
  value: string | null,
  isValid: (v: unknown) => v is T,
): T | 'invalid' | undefined {
  if (value === null) return undefined
  return isValid(value) ? value : 'invalid'
}

/** Resolve a format from the path extension. Bare `.xml` is treated as RSS. */
export function formatFromExtension(pathname: string): FeedFormat | null {
  const p = pathname.toLowerCase()
  if (p.endsWith('.rss.xml') || p.endsWith('.rss')) return 'rss'
  if (p.endsWith('.atom.xml') || p.endsWith('.atom')) return 'atom'
  if (p.endsWith('.feed.json') || p.endsWith('.json')) return 'json'
  if (p.endsWith('.xml')) return 'rss'
  return null
}

// specificity: type/subtype (2) > type/* (1) > */* (0)
function specificity(e: AcceptEntry): number {
  if (e.type === '*') return 0
  if (e.subtype === '*') return 1
  return 2
}

/** Parse an Accept header, sorted by q desc then specificity desc (stable). */
export function parseAccept(header: string | null | undefined): AcceptEntry[] {
  if (!header) return []
  const entries: { e: AcceptEntry; i: number }[] = []

  let index = 0
  for (const part of header.split(',')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const [mime = '', ...paramParts] = trimmed.split(';')
    const [type = '', subtype = ''] = mime.trim().toLowerCase().split('/')
    if (!type || !subtype) continue

    let q = 1
    const params: Record<string, string> = {}
    for (const p of paramParts) {
      const idx = p.indexOf('=')
      if (idx === -1) continue
      const key = p.slice(0, idx).trim().toLowerCase()
      const val = p.slice(idx + 1).trim()
      if (key === 'q') {
        const n = Number.parseFloat(val)
        q = Number.isNaN(n) ? 1 : Math.min(1, Math.max(0, n))
      } else {
        params[key] = val
      }
    }
    entries.push({ e: { type, subtype, q, params }, i: index++ })
  }

  return entries
    .sort((a, b) => {
      if (b.e.q !== a.e.q) return b.e.q - a.e.q
      const s = specificity(b.e) - specificity(a.e)
      return s !== 0 ? s : a.i - b.i
    })
    .map(({ e }) => e)
}

// `'all'` means a wildcard (defer to defaultFormat).
function resolveEntry(e: AcceptEntry): FeedFormat | 'all' | null {
  if (e.type === '*' && e.subtype === '*') return 'all'
  if (e.type === 'application' && e.subtype === '*') return 'all'
  return MIME_FORMAT[`${e.type}/${e.subtype}`] ?? null
}

/** Negotiate a format from the Accept header, honouring `q=0` rejections. */
export function negotiateFormat(
  header: string | null | undefined,
  defaultFormat: FeedFormat,
): FeedFormat | null {
  const entries = parseAccept(header)
  if (entries.length === 0) return null

  const rejected = new Set<FeedFormat>()
  for (const e of entries) {
    if (e.q !== 0) continue
    const r = resolveEntry(e)
    if (r === 'all') {
      rejected.add('rss')
      rejected.add('atom')
      rejected.add('json')
    } else if (r) {
      rejected.add(r)
    }
  }

  for (const e of entries) {
    if (e.q === 0) continue
    const r = resolveEntry(e)
    if (!r) continue
    const candidate = r === 'all' ? defaultFormat : r
    if (!rejected.has(candidate)) return candidate
  }

  return null
}
