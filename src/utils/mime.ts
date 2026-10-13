import type { FeedFormat } from '../types'

/**
 * Canonical, charset-free MIME type for each format. The single source of truth behind both `serve.ts`'s `Content-Type` header (which appends `; charset=utf-8`) and the feed-discovery helpers' `<link type>` / `Link` header values, so the two can never drift apart.
 */
export const FEED_MIME_TYPES: Record<FeedFormat, string> = {
  rss: 'application/rss+xml',
  atom: 'application/atom+xml',
  json: 'application/feed+json',
}

/** MIME type of an OPML subscription list. */
export const OPML_MIME_TYPE = 'text/x-opml'

/**
 * File extension for each feed MIME type, in the shape of the `extensionMap` option of Hono's `toSSG` (`hono/ssg`). Hono doesn't know the feed MIME types, so without it a feed is written as `feed.json.html`.
 * `toSSG` uses a given map in place of its own, so merge it with `defaultExtensionMap` to keep HTML pages as `.html`.
 *
 * @example
 * ```ts
 * import { defaultExtensionMap, toSSG } from 'hono/ssg'
 * import { feedExtensionMap } from 'hono-feed'
 *
 * await toSSG(app, fs, { extensionMap: { ...defaultExtensionMap, ...feedExtensionMap } })
 * ```
 */
export const feedExtensionMap: Record<string, string> = {
  [FEED_MIME_TYPES.rss]: 'xml',
  [FEED_MIME_TYPES.atom]: 'xml',
  [FEED_MIME_TYPES.json]: 'json',
  [OPML_MIME_TYPE]: 'opml',
}
