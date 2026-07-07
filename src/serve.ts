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
  rejectsAllFormats,
  resolveFallbackFormat,
  versionFromQuery,
} from './negotiate'
import type {
  AtomVersion,
  FeedFormat,
  FeedInput,
  JsonFeedVersion,
  RssVersion,
  ServeFeedOptions,
} from './types'
import { serializeCacheControl } from './utils/cache-control'
import { latestDate } from './utils/date'
import { resolveEtag } from './utils/etag'
import { absolutize } from './utils/url'
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
 * A `FeedInput`/`Feed`, or a function producing one (possibly asynchronously). The function
 * form defers resolving feed data until it's actually needed — a request satisfied by
 * `etagFrom` never calls it at all.
 */
export type FeedInputSource =
  | FeedInput
  | Feed
  | (() => FeedInput | Feed | Promise<FeedInput | Feed>)

/**
 * Turn a neutral feed (a `Feed` instance or `{ options, items }`) into a correct
 * `Response`, handling content negotiation, conditional requests and caching.
 *
 * Stays synchronous (returning a plain `Response`) unless `etagFrom` or a lazy `input`
 * function is used, in which case it may return a `Promise<Response>` instead — see the
 * overloads below.
 */
export function serveFeed(
  c: Context,
  input: FeedInput | Feed,
  options?: Omit<ServeFeedOptions, 'etagFrom'>,
): Response
export function serveFeed(
  c: Context,
  input: FeedInputSource,
  options?: ServeFeedOptions,
): Response | Promise<Response>
export function serveFeed(
  c: Context,
  input: FeedInputSource,
  options: ServeFeedOptions = {},
): Response | Promise<Response> {
  const negotiation = resolveNegotiation(c, options)
  if (negotiation instanceof Response) return negotiation

  const { etagFrom } = options
  if (!etagFrom) {
    return resolveInput(input, (resolved) => finishServeFeed(c, resolved, options, negotiation))
  }

  const tag = etagFrom()
  return tag instanceof Promise
    ? tag.then((resolvedTag) => serveWithEtagFrom(c, resolvedTag, input, options, negotiation))
    : serveWithEtagFrom(c, tag, input, options, negotiation)
}

/** Bind a `serveFeed` call to `c`, folding in defaults that per-call options can override. */
export function bindServeFeed(
  c: Context,
  defaults: ServeFeedOptions,
): (input: FeedInputSource, options?: ServeFeedOptions) => Response | Promise<Response> {
  return (input, options) => serveFeed(c, input, { ...defaults, ...options })
}

// Resolve a maybe-thunk, maybe-async feed source, then hand off to `cb`. Stays synchronous
// end-to-end when neither the thunk nor its result is a Promise, which is what lets the plain
// (no `etagFrom`, non-function `input`) call site keep returning an actual `Response`.
function resolveInput<R>(
  input: FeedInputSource,
  cb: (resolved: FeedInput | Feed) => R,
): R | Promise<R> {
  const value = typeof input === 'function' ? input() : input
  return value instanceof Promise ? value.then(cb) : cb(value)
}

/**
 * `etagFrom` matched: check it against `If-None-Match` before resolving `input` at all. A
 * match answers 304 immediately; otherwise `input` is resolved and served normally, with this
 * tag used as the response ETag (see `finishServeFeed`'s `etagFromValue` parameter).
 */
function serveWithEtagFrom(
  c: Context,
  tag: string,
  input: FeedInputSource,
  options: ServeFeedOptions,
  negotiation: Negotiation,
): Response | Promise<Response> {
  const etagValue = resolveEtag('', () => tag)
  const inm = c.req.header('if-none-match')
  if (inm !== undefined && etagMatches(inm, etagValue)) {
    const { cacheControl = 'public, max-age=3600' } = options
    const headers: Record<string, string> = { ETag: etagValue }
    if (cacheControl !== false) {
      headers['Cache-Control'] =
        typeof cacheControl === 'string' ? cacheControl : serializeCacheControl(cacheControl)
    }
    // RFC 9110 §15.4.5: a 304 MUST carry the same Vary a 200 for this request would have.
    if (negotiation.negotiated) headers.Vary = 'Accept'
    return c.body(null, 304, headers)
  }
  return resolveInput(input, (resolved) =>
    finishServeFeed(c, resolved, options, negotiation, etagValue),
  )
}

interface Negotiation {
  format: FeedFormat
  negotiated: boolean
  rssVersion: RssVersion | undefined
  atomVersion: AtomVersion | undefined
  jsonFeedVersion: JsonFeedVersion | undefined
  versionQueried: boolean
  base: string
  url: URL
}

/**
 * Resolve the response format and version, purely from the request and `options` — no feed
 * data needed. Runs before `input` is ever touched, so an invalid `?version=` (400) or a
 * `strictAccept` rejection (406) never resolves it either. Returns the early `Response`
 * directly on either of those paths.
 */
function resolveNegotiation(c: Context, options: ServeFeedOptions): Negotiation | Response {
  const {
    format: explicitFormat,
    defaultFormat = 'rss',
    detectFromExtension = true,
    detectFromQuery = false,
    detectFormatFromQuery = detectFromQuery,
    detectVersionFromQuery = detectFromQuery,
    formatQueryParam = 'format',
    versionQueryParam = 'version',
    strictAccept = false,
    baseUrl,
    rssVersion: rssVersionOpt,
    atomVersion: atomVersionOpt,
    jsonFeedVersion: jsonFeedVersionOpt,
  } = options

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
    if (f) {
      format = f
    } else {
      const acceptHeader = c.req.header('accept')
      negotiated = true
      const winner = negotiateFormat(acceptHeader, defaultFormat)
      if (winner) {
        format = winner
      } else if (strictAccept && rejectsAllFormats(acceptHeader)) {
        // Only an Accept header that actively rejects every format (q=0) triggers this — an
        // absent header, or one that simply doesn't match anything, still falls through below.
        return c.text('hono-feed: no acceptable feed format', 406, NO_STORE)
      } else {
        // No candidate won outright (e.g. the header only rejects formats without accepting
        // any). Fall back to defaultFormat, but never resurrect a format the header explicitly
        // rejected — resolveFallbackFormat picks the first non-rejected format instead.
        format = resolveFallbackFormat(acceptHeader, defaultFormat)
      }
    }
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

  return { format, negotiated, rssVersion, atomVersion, jsonFeedVersion, versionQueried, base, url }
}

/** The rest of the response: validate, serialize, and build headers/status from resolved `input`. */
function finishServeFeed(
  c: Context,
  input: FeedInput | Feed,
  options: ServeFeedOptions,
  negotiation: Negotiation,
  etagFromValue?: string,
): Response {
  const {
    format,
    negotiated,
    rssVersion,
    atomVersion,
    jsonFeedVersion,
    versionQueried,
    base,
    url,
  } = negotiation
  const {
    cacheControl = 'public, max-age=3600',
    etag = true,
    lastModified = true,
    pretty = false,
    xmlVersion,
    suppressDeprecationWarnings,
  } = options

  const resolved: FeedInput = input instanceof Feed ? input.toInput() : input

  // Validate with the request-derived feedUrl folded in: rules that accept feedUrl as a
  // fallback (RSS channel <link>, Atom feed id) are satisfiable here even when the caller
  // set neither, because serving always yields a self URL. Absolutizing against `base`
  // (rather than the request's own origin) keeps an explicit relative `feedUrl` — and the
  // request-derived fallback itself — from leaking a relative or internal-only URL into the
  // document when `baseUrl` is set (e.g. behind a reverse proxy).
  const feedUrl = absolutize(resolved.options.feedUrl, base) ?? new URL(url.pathname, base).href
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
  if (cacheControl !== false) {
    headers['Cache-Control'] =
      typeof cacheControl === 'string' ? cacheControl : serializeCacheControl(cacheControl)
  }
  if (negotiated) headers.Vary = 'Accept'

  let etagValue: string | undefined
  if (etagFromValue !== undefined) {
    // etagFrom already gave us the canonical tag; don't also hash the body.
    etagValue = etagFromValue
    headers.ETag = etagValue
  } else if (etag) {
    etagValue = resolveEtag(body, typeof etag === 'function' ? etag : undefined)
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
  // RFC 9110 §13.1.3: a recipient MUST ignore If-Modified-Since when the request contains
  // If-None-Match — even if there's no ETag on our side to compare it against.
  if (inm !== undefined) return etagValue !== undefined && etagMatches(inm, etagValue)

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

// An entity-tag per RFC 9110 §8.8.3: `[ "W/" ] DQUOTE *etagc DQUOTE`. `etagc` legally includes
// a comma, so a list of tags must be tokenized by matching whole quoted tags — splitting on
// "," would break on a tag that itself contains one.
const ENTITY_TAG = /(?:W\/)?"[^"]*"/g

// Weak comparison for If-None-Match (ignore the W/ prefix; a bare `*` always matches).
function etagMatches(headerValue: string, etag: string): boolean {
  if (headerValue.trim() === '*') return true
  const target = etag.replace(/^W\//, '')
  for (const tag of headerValue.match(ENTITY_TAG) ?? []) {
    if (tag.replace(/^W\//, '') === target) return true
  }
  return false
}
