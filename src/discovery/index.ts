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

function linkHeaderValue(link: FeedLink): string {
  const parts = [`<${link.href}>`, `rel="${link.rel}"`, `type="${link.type}"`]
  if (link.title) parts.push(`title="${link.title}"`)
  return parts.join('; ')
}

/**
 * Middleware that appends one `Link: <…>; rel="alternate"; type="…"` header (RFC 8288) per
 * configured feed URL, but only to responses whose `Content-Type` is HTML — a feed response
 * itself has no use for advertising its own alternates.
 */
export function feedLinkHeader(options: FeedLinksOptions): MiddlewareHandler {
  const links = feedLinks(options)
  return async (c, next) => {
    await next()
    if (!links.length) return
    if (!c.res.headers.get('content-type')?.toLowerCase().includes('text/html')) return
    for (const link of links) c.res.headers.append('Link', linkHeaderValue(link))
  }
}
