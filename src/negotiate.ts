import type { FeedFormat } from './types'

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

export function isFeedFormat(v: unknown): v is FeedFormat {
  return v === 'rss' || v === 'atom' || v === 'json'
}

/** Resolve a format from `?format=`. */
export function formatFromQuery(value: string | null | undefined): FeedFormat | null {
  return isFeedFormat(value) ? value : null
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
