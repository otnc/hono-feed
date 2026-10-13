import type { Context } from 'hono'
import type { CacheControlDirectives } from '../types'
import { serializeCacheControl } from './cache-control'
import { resolveEtag } from './etag'

const ENCODER = new TextEncoder()

export const DEFAULT_CACHE_CONTROL = 'public, max-age=3600'

export function cacheControlValue(
  cacheControl: string | CacheControlDirectives | false,
): string | undefined {
  if (cacheControl === false) return undefined
  return typeof cacheControl === 'string' ? cacheControl : serializeCacheControl(cacheControl)
}

// RFC 9110 §13.1.2/§13.1.3: conditional request headers only govern GET/HEAD requests.
export function isConditionalMethod(c: Context): boolean {
  return c.req.method === 'GET' || c.req.method === 'HEAD'
}

// An entity-tag per RFC 9110 §8.8.3: `[ "W/" ] DQUOTE *etagc DQUOTE`. `etagc` legally includes a comma, so a list of tags must be tokenized by matching whole quoted tags — splitting on "," would break on a tag that itself contains one.
const ENTITY_TAG = /(?:W\/)?"[^"]*"/g

// Weak comparison for If-None-Match (ignore the W/ prefix; a bare `*` always matches).
export function etagMatches(headerValue: string, etag: string): boolean {
  if (headerValue.trim() === '*') return true
  const target = etag.replace(/^W\//, '')
  for (const tag of headerValue.match(ENTITY_TAG) ?? []) {
    if (tag.replace(/^W\//, '') === target) return true
  }
  return false
}

function isNotModified(
  c: Context,
  etagValue: string | undefined,
  updatedDate: Date | undefined,
): boolean {
  if (!isConditionalMethod(c)) return false

  const inm = c.req.header('if-none-match')
  // RFC 9110 §13.1.3: a recipient MUST ignore If-Modified-Since when the request contains If-None-Match — even if there's no ETag on our side to compare it against.
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

export interface RespondOptions {
  contentType: string
  cacheControl: string | CacheControlDirectives | false
  etag: boolean | ((body: string) => string)
  /** A tag already known (from `etagFrom`): used as-is instead of hashing the body. */
  etagValue?: string
  /** Source of `Last-Modified` and `If-Modified-Since` handling; none when undefined. */
  updated?: Date
  /** Set `Vary: Accept` (the format was negotiated). */
  vary?: boolean
  /** A ready `Link` header value. */
  link?: string
}

/** Build the final 200 or 304 for a serialized body: caching headers, conditional requests and HEAD. */
export function respond(c: Context, body: string, options: RespondOptions): Response {
  const headers: Record<string, string> = { 'Content-Type': options.contentType }
  const cacheControl = cacheControlValue(options.cacheControl)
  if (cacheControl) headers['Cache-Control'] = cacheControl
  if (options.vary) headers.Vary = 'Accept'
  if (options.link) headers.Link = options.link

  let etagValue: string | undefined
  if (options.etagValue !== undefined) {
    // etagFrom already gave us the canonical tag; don't also hash the body.
    etagValue = options.etagValue
    headers.ETag = etagValue
  } else if (options.etag) {
    etagValue = resolveEtag(body, typeof options.etag === 'function' ? options.etag : undefined)
    headers.ETag = etagValue
  }

  if (options.updated) headers['Last-Modified'] = options.updated.toUTCString()

  if (isNotModified(c, etagValue, options.updated)) {
    return c.body(null, 304, headers)
  }

  const bytes = ENCODER.encode(body)
  headers['Content-Length'] = String(bytes.length)

  if (c.req.method === 'HEAD') return c.body(null, 200, headers)
  return c.body(bytes, 200, headers)
}
