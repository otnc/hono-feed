import type { Context } from 'hono'
import { Feed } from './feed'
import { toAtom, toJSONFeed, toRSS } from './formats'
import {
  formatFromExtension,
  formatFromQuery,
  isAtomVersion,
  isJsonFeedVersion,
  isRssVersion,
  negotiateFormat,
  versionFromQuery,
} from './negotiate'
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

// Query-driven version errors aren't governed by `cacheControl` (that's for successful feed
// bodies), and whether they reproduce can change independently of the URL as the underlying
// feed data changes — so a cache must not hold onto them past this response.
const NO_STORE = { 'Cache-Control': 'no-store' }

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
    detectFormatFromQuery = detectFromQuery,
    detectVersionFromQuery = detectFromQuery,
    formatQueryParam = 'format',
    versionQueryParam = 'version',
    cacheControl = 'public, max-age=3600',
    etag = true,
    lastModified = true,
    baseUrl,
    pretty = false,
    xmlVersion,
    rssVersion: rssVersionOpt,
    atomVersion: atomVersionOpt,
    jsonFeedVersion: jsonFeedVersionOpt,
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
    if (detectFormatFromQuery) f = formatFromQuery(url.searchParams.get(formatQueryParam))
    if (!f && detectFromExtension) f = formatFromExtension(url.pathname)
    if (!f) {
      f = negotiateFormat(c.req.header('accept'), defaultFormat)
      negotiated = true
    }
    format = f ?? defaultFormat
  }

  // `rssVersion` / `atomVersion` / `jsonFeedVersion` set in code always win; the query is
  // only consulted when the caller left the option for the resolved format unset. The same
  // `?version=` param is reinterpreted against whichever version type that format expects.
  let rssVersion = rssVersionOpt
  let atomVersion = atomVersionOpt
  let jsonFeedVersion = jsonFeedVersionOpt
  let versionQueried = false

  if (detectVersionFromQuery) {
    const raw = url.searchParams.get(versionQueryParam)
    if (raw !== null) {
      if (format === 'rss' && rssVersionOpt === undefined) {
        const queried = versionFromQuery(raw, isRssVersion)
        if (queried === 'invalid') {
          return c.text(`hono-feed: invalid "${versionQueryParam}" query value`, 400, NO_STORE)
        }
        rssVersion = queried
        versionQueried = true
      } else if (format === 'atom' && atomVersionOpt === undefined) {
        const queried = versionFromQuery(raw, isAtomVersion)
        if (queried === 'invalid') {
          return c.text(`hono-feed: invalid "${versionQueryParam}" query value`, 400, NO_STORE)
        }
        atomVersion = queried
        versionQueried = true
      } else if (format === 'json' && jsonFeedVersionOpt === undefined) {
        const queried = versionFromQuery(raw, isJsonFeedVersion)
        if (queried === 'invalid') {
          return c.text(`hono-feed: invalid "${versionQueryParam}" query value`, 400, NO_STORE)
        }
        jsonFeedVersion = queried
        versionQueried = true
      }
    }
  }

  // Validate with the request-derived feedUrl folded in: rules that accept feedUrl as a
  // fallback (RSS channel <link>, Atom feed id) are satisfiable here even when the caller
  // set neither, because serving always yields a self URL.
  const feedUrl = resolved.options.feedUrl ?? url.origin + url.pathname
  validateInput({ options: { ...resolved.options, feedUrl }, items: resolved.items }, format)
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

  let body: string
  try {
    body = SERIALIZERS[format](resolved, serializeOpts)
  } catch (err) {
    // A version picked from the query (rather than pinned in code) can't be generated from
    // this data: that's the requester's fault, not a server bug, so answer 422 instead of
    // letting it bubble up as an uncaught error.
    if (versionQueried && err instanceof TypeError) {
      return c.text(err.message, 422, NO_STORE)
    }
    throw err
  }

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

/** Bind a `serveFeed` call to `c`, folding in defaults that per-call options can override. */
export function bindServeFeed(
  c: Context,
  defaults: ServeFeedOptions,
): (input: FeedInput | Feed, options?: ServeFeedOptions) => Response {
  return (input, options) => serveFeed(c, input, { ...defaults, ...options })
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
