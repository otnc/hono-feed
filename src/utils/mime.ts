import type { FeedFormat } from '../types'

/**
 * Canonical, charset-free MIME type for each format. The single source of truth behind both
 * `serve.ts`'s `Content-Type` header (which appends `; charset=utf-8`) and the feed-discovery
 * helpers' `<link type>` / `Link` header values, so the two can never drift apart.
 */
export const FEED_MIME_TYPES: Record<FeedFormat, string> = {
  rss: 'application/rss+xml',
  atom: 'application/atom+xml',
  json: 'application/feed+json',
}
