import type { FeedFormat, FeedInput, FeedItem } from './types'
import { hasIriScheme } from './utils/url'

/**
 * Minimal validation after the format is decided. Invalid input throws `TypeError`.
 *
 * `serveFeed` calls this with a request-derived `options.feedUrl` fallback already folded in
 * (the RSS channel `<link>` and Atom feed `id` rules accept it in place of `link`/`id`). Callers
 * validating input for the low-level serializers directly must set `options.feedUrl` themselves
 * first if they're relying on that fallback — same as they already must for serialization.
 */
export function validateInput(input: FeedInput, format: FeedFormat): void {
  const { options, items } = input

  if (!options || typeof options.title !== 'string' || options.title.length === 0) {
    throw new TypeError('hono-feed: feed "title" is required')
  }
  assertValidDate(options.updated, 'feed.updated')
  assertValidDate(options.published, 'feed.published')

  // RFC 5005 defines <fh:complete/> (§2, "this is the whole feed") and <fh:archive/> (§4,
  // "this page never changes") for different document types — a page can't be both at once.
  if (options.paging?.complete && options.paging?.archive) {
    throw new TypeError(
      'hono-feed: paging "complete" and "archive" are mutually exclusive (RFC 5005 §2/§4)',
    )
  }

  // RSS <skipHours> holds GMT hours (0–23).
  if (options.skipHours?.some((hour) => !Number.isInteger(hour) || hour < 0 || hour > 23)) {
    throw new TypeError('hono-feed: "skipHours" values must be integers between 0 and 23')
  }

  // RSS <ttl> is a number of minutes; negative or fractional values are meaningless.
  if (options.ttl !== undefined && (!Number.isInteger(options.ttl) || options.ttl < 0)) {
    throw new TypeError('hono-feed: "ttl" must be a non-negative integer')
  }

  if (format === 'atom') {
    if (!options.id && !options.link && !options.feedUrl) {
      throw new TypeError('hono-feed: Atom feed requires "id" (or "link" / "feedUrl")')
    }
    // RFC 4287 §4.2.6: an atom:id is an absolute IRI; relative references are excluded.
    if (options.id && !hasIriScheme(options.id)) {
      throw new TypeError('hono-feed: Atom feed "id" must be an absolute IRI (RFC 4287 §4.2.6)')
    }
    // Without any date the serializer would fall back to "now", changing the mandatory
    // <updated> (and the ETag) on every render.
    if (!options.updated && items.length === 0) {
      throw new TypeError('hono-feed: Atom feed requires "updated" when it has no items')
    }
    // RFC 4287 §4.1.1: the feed needs an author unless every entry carries one.
    if (!options.author) {
      const missing = items.findIndex((item) => !hasAuthor(item))
      if (missing !== -1) {
        throw new TypeError(
          `hono-feed: Atom requires an "author" on the feed or on every item (item[${missing}] has none)`,
        )
      }
    }
  }

  // Channel <link> is mandatory in every RSS version (the serializers fall back to feedUrl).
  if (format === 'rss' && !options.link && !options.feedUrl) {
    throw new TypeError('hono-feed: RSS feed requires "link" (or "feedUrl")')
  }

  items.forEach((item, i) => {
    if (typeof item.title !== 'string' || item.title.length === 0) {
      throw new TypeError(`hono-feed: item[${i}] "title" is required`)
    }
    assertValidDate(item.published, `item[${i}].published`)
    assertValidDate(item.updated, `item[${i}].updated`)

    if (format === 'atom') {
      if (!item.id && !item.link) {
        throw new TypeError(`hono-feed: Atom item[${i}] requires "id" (or "link")`)
      }
      if (item.id && !hasIriScheme(item.id)) {
        throw new TypeError(
          `hono-feed: Atom item[${i}] "id" must be an absolute IRI (RFC 4287 §4.2.6)`,
        )
      }
      if (!item.updated && !item.published) {
        throw new TypeError(`hono-feed: Atom item[${i}] requires "updated" (or "published")`)
      }
      // RFC 4287 §4.1.2: an entry without atom:content must carry a rel="alternate" link.
      if (!item.link && !item.content) {
        throw new TypeError(`hono-feed: Atom item[${i}] requires "link" (or "content")`)
      }
    }

    if (format === 'json') {
      // Readers must discard items without an id.
      if (!item.id && !item.link) {
        throw new TypeError(`hono-feed: JSON Feed item[${i}] requires "id" (or "link")`)
      }
      // Every item needs content_html or content_text (description backs content_text).
      if (!item.content && !item.description) {
        throw new TypeError(`hono-feed: JSON Feed item[${i}] requires "content" (or "description")`)
      }
    }
  })
}

function hasAuthor(item: FeedItem): boolean {
  return Array.isArray(item.author) ? item.author.length > 0 : item.author !== undefined
}

function assertValidDate(d: Date | undefined, label: string): void {
  if (d === undefined) return
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) {
    throw new TypeError(`hono-feed: ${label} must be a valid Date`)
  }
}
