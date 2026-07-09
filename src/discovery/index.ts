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

// Everything that may appear raw in a URI-Reference (RFC 3986 unreserved + reserved), plus `%`
// so hrefs that are already percent-encoded (e.g. from `absolutize`/`new URL`) pass through
// untouched — which is also why `encodeURI` can't be used here (it escapes `%` itself and
// would double-encode them). Anything else — spaces, `<`/`>`/`"`, and every non-ASCII
// character — is UTF-8 percent-encoded: HTTP header values are ByteStrings, so a raw non-ASCII
// character wouldn't just be malformed, it would make `Headers.append` throw.
const HREF_UNSAFE = /[^A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]/g

function encodeHref(href: string): string {
  return href.replace(HREF_UNSAFE, (ch) =>
    [...HEADER_ENCODER.encode(ch)]
      .map((b) => `%${b.toString(16).toUpperCase().padStart(2, '0')}`)
      .join(''),
  )
}

// A title that can be carried as an RFC 8288 quoted-string as-is: printable ASCII with no `"`
// or `\` (the two characters that would need quoted-pair escaping — receivers' support for
// quoted-pairs is spotty, so those fall through to `title*` too).
const PLAIN_TITLE = /^[ !#-[\]-~]*$/

// RFC 8187 attr-char, as what encodeURIComponent leaves raw minus what 8187 doesn't allow.
const RFC8187_EXTRA = /[*'()]/g

/**
 * Serialize the title as an RFC 8288 parameter: a plain `title="…"` quoted-string when the
 * value is simple ASCII, otherwise RFC 8187 extended encoding (`title*=UTF-8''…`) — a raw
 * non-Latin-1 character in a header value would make `Headers.append` throw. Only one form is
 * sent: RFC 8187 §4.2 has receivers prefer `title*` when both are present, so pairing them
 * would add bytes without changing behavior.
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
