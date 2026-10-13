import type { MiddlewareHandler } from 'hono'
import { FEED_FORMATS } from '../types'
import { FEED_MIME_TYPES } from '../utils/mime'
import { absolutize } from '../utils/url'
import { escapeAttr } from '../utils/xml'

export interface FeedLinksOptions {
  /** Shown to the reader in its "subscribe" UI, applied to every link. Omit to leave untitled. */
  title?: string
  /** RSS feed URL. */
  rss?: string
  /** Atom feed URL. */
  atom?: string
  /** JSON Feed URL. */
  json?: string
  /** Absolutizes each URL against this. Left relative (as given) when unset. */
  baseUrl?: string
}

export interface FeedLink {
  rel: 'alternate'
  /** MIME type, from the same table `serveFeed` uses for `Content-Type` — never drifts. */
  type: string
  href: string
  title?: string
}

/** Build `<link rel="alternate">` descriptors for whichever feed URLs are set. */
export function feedLinks(options: FeedLinksOptions): FeedLink[] {
  const { title, baseUrl } = options
  const links: FeedLink[] = []
  for (const format of FEED_FORMATS) {
    const href = options[format]
    if (!href) continue
    links.push({
      rel: 'alternate',
      type: FEED_MIME_TYPES[format],
      href: absolutize(href, baseUrl) as string,
      title,
    })
  }
  return links
}

/** Render `feedLinks(options)` as `<link>` tags, for splicing into an HTML `<head>`. */
export function feedLinksHtml(options: FeedLinksOptions): string {
  return feedLinks(options)
    .map((link) => {
      const attrs = [`rel="${link.rel}"`, `type="${escapeAttr(link.type)}"`]
      if (link.title) attrs.push(`title="${escapeAttr(link.title)}"`)
      attrs.push(`href="${escapeAttr(link.href)}"`)
      return `<link ${attrs.join(' ')}>`
    })
    .join('')
}

const HEADER_ENCODER = new TextEncoder()

// RFC 3986 unreserved + reserved characters stay raw, plus `%` so already-encoded hrefs pass
// through (`encodeURI` would double-encode them). Everything else is UTF-8 percent-encoded:
// a raw non-ASCII character in a header value makes `Headers.append` throw.
const HREF_UNSAFE = /[^A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]/gu

function encodeHref(href: string): string {
  return href.replace(HREF_UNSAFE, (ch) =>
    [...HEADER_ENCODER.encode(ch)]
      .map((b) => `%${b.toString(16).toUpperCase().padStart(2, '0')}`)
      .join(''),
  )
}

// Printable ASCII without `"` or `\`, so it fits an RFC 8288 quoted-string unescaped
// (receivers' quoted-pair support is spotty, so those two fall through to `title*`).
const PLAIN_TITLE = /^[ !#-[\]-~]*$/

// RFC 8187 attr-char, as what encodeURIComponent leaves raw minus what 8187 doesn't allow.
const RFC8187_EXTRA = /[*'()]/g

/**
 * Serialize the title as a plain `title="…"` when simple ASCII, otherwise as RFC 8187
 * `title*=UTF-8''…`. Only one form is sent: receivers prefer `title*` when both are present,
 * so pairing them would add bytes without changing behavior.
 */
function titleParam(title: string): string {
  if (PLAIN_TITLE.test(title)) return `title="${title}"`
  const encoded = encodeURIComponent(title).replace(
    RFC8187_EXTRA,
    (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`,
  )
  return `title*=UTF-8''${encoded}`
}

function linkHeaderValue(link: FeedLink): string {
  const parts = [`<${encodeHref(link.href)}>`, `rel="${link.rel}"`, `type="${link.type}"`]
  if (link.title) parts.push(titleParam(link.title))
  return parts.join('; ')
}

function isHtmlResponse(contentType: string | undefined): boolean {
  if (!contentType) return false
  const ct = contentType.toLowerCase()
  return ct.includes('text/html') || ct.includes('application/xhtml+xml')
}

/**
 * Middleware that appends one `Link: <…>; rel="alternate"; type="…"` header (RFC 8288) per
 * configured feed URL, but only to responses whose `Content-Type` is HTML (or XHTML) — a feed
 * response itself has no use for advertising its own alternates.
 */
export function feedLinkHeader(options: FeedLinksOptions): MiddlewareHandler {
  const links = feedLinks(options)
  return async (c, next) => {
    await next()
    if (!links.length) return
    if (!isHtmlResponse(c.res.headers.get('content-type') ?? undefined)) return
    for (const link of links) c.res.headers.append('Link', linkHeaderValue(link))
  }
}
