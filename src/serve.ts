import type { Context } from 'hono'
import { Feed } from './feed'
import { toAtom, toJSONFeed, toRSS } from './formats'
import { formatFromExtension, formatFromQuery, negotiateFormat } from './negotiate'
import type { FeedFormat, FeedInput, ServeFeedOptions } from './types'
import { latestDate } from './utils/date'
import { weakEtag } from './utils/etag'
import { validateInput } from './validate'

const CONTENT_TYPE: Record<FeedFormat, string> = {
  rss: 'application/rss+xml; charset=utf-8',
  atom: 'application/atom+xml; charset=utf-8',
  json: 'application/feed+json; charset=utf-8',
}

const ENCODER = new TextEncoder()

const SERIALIZERS: Record<FeedFormat, typeof toRSS> = {
  rss: toRSS,
  atom: toAtom,
  json: toJSONFeed,
}

/**
 * Turn a neutral feed (a `Feed` instance or `{ options, items }`) into a correct
 * `Response`, handling content negotiation, conditional requests and caching.
 */
export function serveFeed(
  c: Context,
  input: FeedInput | Feed,
  options: ServeFeedOptions = {},
): Response {
  const {
    format: explicitFormat,
    defaultFormat = 'rss',
    detectFromExtension = true,
    detectFromQuery = false,
    cacheControl = 'public, max-age=3600',
    etag = true,
    lastModified = true,
    baseUrl,
    pretty = false,
    xmlVersion,
    rssVersion,
    atomVersion,
    jsonFeedVersion,
    suppressDeprecationWarnings,
  } = options

  const resolved: FeedInput = input instanceof Feed ? input.toInput() : input

  const url = new URL(c.req.url)
  const base = baseUrl ?? url.origin

  let format: FeedFormat
  let negotiated = false
  if (explicitFormat) {
    format = explicitFormat
  } else {
    let f: FeedFormat | null = null
    if (detectFromQuery) f = formatFromQuery(url.searchParams.get('format'))
    if (!f && detectFromExtension) f = formatFromExtension(url.pathname)
    if (!f) {
      f = negotiateFormat(c.req.header('accept'), defaultFormat)
      negotiated = true
    }
    format = f ?? defaultFormat
  }

  validateInput(resolved, format)

  const feedUrl = resolved.options.feedUrl ?? url.origin + url.pathname
  const serializeOpts = {
    pretty,
    baseUrl: base,
    feedUrl,
    xmlVersion,
    rssVersion,
    atomVersion,
    jsonFeedVersion,
    suppressDeprecationWarnings,
  }

  const body = SERIALIZERS[format](resolved, serializeOpts)

  const headers: Record<string, string> = { 'Content-Type': CONTENT_TYPE[format] }
  if (cacheControl !== false) headers['Cache-Control'] = cacheControl
  if (negotiated) headers.Vary = 'Accept'

  let etagValue: string | undefined
  if (etag) {
    etagValue = weakEtag(body)
    headers.ETag = etagValue
  }

  let updatedDate: Date | undefined
  if (lastModified) {
    updatedDate = resolved.options.updated ?? latestDate(resolved.items)
    if (updatedDate) headers['Last-Modified'] = updatedDate.toUTCString()
  }

  if (isNotModified(c, etagValue, updatedDate)) {
    return c.body(null, 304, headers)
  }

  headers['Content-Length'] = String(ENCODER.encode(body).length)

  if (c.req.method === 'HEAD') return c.body(null, 200, headers)
  return c.body(body, 200, headers)
}

function isNotModified(
  c: Context,
  etagValue: string | undefined,
  updatedDate: Date | undefined,
): boolean {
  const inm = c.req.header('if-none-match')
  // If-None-Match takes precedence over If-Modified-Since (RFC 9110).
  if (etagValue && inm !== undefined) return etagMatches(inm, etagValue)

  if (updatedDate) {
    const ims = c.req.header('if-modified-since')
    if (ims) {
      const since = Date.parse(ims)
      if (!Number.isNaN(since)) {
        return Math.floor(updatedDate.getTime() / 1000) <= Math.floor(since / 1000)
      }
    }
  }
  return false
}

// Weak comparison for If-None-Match (ignore the W/ prefix; `*` always matches).
function etagMatches(headerValue: string, etag: string): boolean {
  const normalize = (t: string) => t.trim().replace(/^W\//, '')
  const target = normalize(etag)
  for (const candidate of headerValue.split(',')) {
    const normalized = candidate.trim()
    if (normalized === '*' || normalize(normalized) === target) return true
  }
  return false
}
