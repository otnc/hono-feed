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

// Guards built from the arrays in types.ts, so the accepted literals live in exactly one place.
function memberGuard<T extends string>(values: readonly T[]): (v: unknown) => v is T {
  const set = new Set<string>(values)
  return (v): v is T => typeof v === 'string' && set.has(v)
}

export const isFeedFormat: (v: unknown) => v is FeedFormat = memberGuard(FEED_FORMATS)
export const isRssVersion: (v: unknown) => v is RssVersion = memberGuard(RSS_VERSIONS)
export const isAtomVersion: (v: unknown) => v is AtomVersion = memberGuard(ATOM_VERSIONS)
export const isJsonFeedVersion: (v: unknown) => v is JsonFeedVersion =
  memberGuard(JSON_FEED_VERSIONS)

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
  const entries: AcceptEntry[] = []

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
    entries.push({ type, subtype, q, params })
  }

  // `Array.prototype.sort` has been a stable sort since ES2019, so entries with equal
  // q and specificity naturally keep their original header order without an explicit tiebreak.
  return entries.sort((a, b) => {
    if (b.q !== a.q) return b.q - a.q
    return specificity(b) - specificity(a)
  })
}

// `'all'` means a wildcard (`*/*` or `application/*`), applying to every format at once.
function resolveEntry(e: AcceptEntry): FeedFormat | 'all' | null {
  if (e.type === '*' && e.subtype === '*') return 'all'
  if (e.type === 'application' && e.subtype === '*') return 'all'
  return MIME_FORMAT[`${e.type}/${e.subtype}`] ?? null
}

/**
 * Per-format effective q, per RFC 9110 §12.5.1: the media range with the highest precedence
 * (most specific match) determines the quality value, regardless of q — an exact match
 * (`application/rss+xml`) always outranks a wildcard (any-type) for that format, even at q=0.
 * A format with no matching entry at all is left out of the map ("no opinion"), distinct from
 * an entry that matches it at q=0 (an explicit rejection).
 *
 * Ties (same specificity, same format) keep whichever entry `parseAccept` sorted first — q
 * desc, so the higher-q entry wins; this only matters for the pathological case of a client
 * listing the same effective format twice (e.g. both `application/xml` and
 * `application/rss+xml`, which are synonyms in `MIME_FORMAT`).
 */
function effectiveQs(entries: AcceptEntry[]): Map<FeedFormat, number> {
  const best = new Map<FeedFormat, { specificity: number; q: number }>()
  const consider = (format: FeedFormat, spec: number, q: number) => {
    const current = best.get(format)
    if (!current || spec > current.specificity) best.set(format, { specificity: spec, q })
  }
  for (const e of entries) {
    const r = resolveEntry(e)
    const spec = specificity(e)
    if (r === 'all') {
      for (const format of FEED_FORMATS) consider(format, spec, e.q)
    } else if (r) {
      consider(r, spec, e.q)
    }
  }
  const qs = new Map<FeedFormat, number>()
  for (const [format, { q }] of best) qs.set(format, q)
  return qs
}

/** Negotiate a format from the Accept header, honouring RFC 9110 §12.5.1 precedence. */
export function negotiateFormat(
  header: string | null | undefined,
  defaultFormat: FeedFormat,
): FeedFormat | null {
  const entries = parseAccept(header)
  if (entries.length === 0) return null

  const qs = effectiveQs(entries)
  let winner: FeedFormat | null = null
  let winnerQ = 0
  for (const format of FEED_FORMATS) {
    const q = qs.get(format)
    if (q === undefined || q <= 0) continue
    // Prefer defaultFormat on ties, so an unopinionated wildcard (`*/*` alone) still resolves
    // to it rather than an arbitrary FEED_FORMATS member.
    if (q > winnerQ || (q === winnerQ && format === defaultFormat)) {
      winner = format
      winnerQ = q
    }
  }
  return winner
}

/**
 * The format to fall back to when `negotiateFormat` returns null and `strictAccept` doesn't
 * apply (or didn't trigger). Falls back to `defaultFormat` unless the header explicitly
 * rejected it (effective q of exactly 0), in which case the first non-rejected format (in
 * `FEED_FORMATS` order) is used instead — an explicit rejection must never be silently
 * resurrected by the fallback. When every format is rejected, `defaultFormat` is returned
 * regardless (matching the documented non-`strictAccept` behaviour of falling through).
 */
export function resolveFallbackFormat(
  header: string | null | undefined,
  defaultFormat: FeedFormat,
): FeedFormat {
  const entries = parseAccept(header)
  if (entries.length === 0) return defaultFormat

  const qs = effectiveQs(entries)
  if (qs.get(defaultFormat) !== 0) return defaultFormat
  for (const format of FEED_FORMATS) {
    if (qs.get(format) !== 0) return format
  }
  return defaultFormat
}

/**
 * True when the Accept header explicitly rejects (q=0) every known feed format — as opposed
 * to simply not matching any of them (an absent header, or one that only mentions unrelated
 * types). Used to distinguish "nothing acceptable was found" from "the client actively
 * refused everything we can serve" (see `strictAccept` in `ServeFeedOptions`).
 */
export function rejectsAllFormats(header: string | null | undefined): boolean {
  const entries = parseAccept(header)
  if (entries.length === 0) return false
  const qs = effectiveQs(entries)
  return FEED_FORMATS.every((format) => qs.get(format) === 0)
}
