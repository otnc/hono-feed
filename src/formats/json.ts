import type { Author, FeedInput, FeedItem, SerializeOptions } from '../types'
import { rfc3339 } from '../utils/date'
import { warnDeprecated } from '../utils/deprecation'
import { absolutize } from '../utils/url'

/** Serialize the neutral model to a JSON Feed 1.1 string. */
export function toJSONFeed(input: FeedInput, opts: SerializeOptions = {}): string {
  const { options, items } = input
  const base = opts.baseUrl

  if (opts.jsonFeedVersion === '1' && !opts.suppressDeprecationWarnings) {
    warnDeprecated(
      'json:1',
      "JSON Feed 1.0 is superseded by 1.1; prefer jsonFeedVersion: '1.1'.",
      'HONOFEED_DEP0003',
    )
  }

  const feed: Record<string, unknown> = {
    version: `https://jsonfeed.org/version/${opts.jsonFeedVersion ?? '1.1'}`,
    title: options.title,
  }

  const home = absolutize(options.link, base)
  if (home) feed.home_page_url = home
  const self = opts.feedUrl ?? absolutize(options.feedUrl, base)
  if (self) feed.feed_url = self
  if (options.description) feed.description = options.description
  if (options.language) feed.language = options.language
  if (options.image) feed.icon = absolutize(options.image, base) ?? options.image
  if (options.favicon) feed.favicon = absolutize(options.favicon, base) ?? options.favicon
  if (options.author) feed.authors = [jsonAuthor(options.author)]

  feed.items = items.map((item) => jsonItem(item, base))

  return JSON.stringify(feed, null, opts.pretty ? 2 : undefined)
}

function jsonAuthor(a: Author): Record<string, string> {
  const o: Record<string, string> = { name: a.name }
  if (a.url) o.url = a.url
  return o
}

function jsonItem(item: FeedItem, base?: string): Record<string, unknown> {
  const o: Record<string, unknown> = { id: String(item.id ?? item.link ?? '') }

  const url = absolutize(item.link, base)
  if (url) o.url = url
  o.title = item.title
  if (item.description) o.summary = item.description
  if (item.content) o.content_html = item.content
  if (item.published) o.date_published = rfc3339(item.published)
  if (item.updated) o.date_modified = rfc3339(item.updated)

  const authors = item.author ? (Array.isArray(item.author) ? item.author : [item.author]) : []
  if (authors.length) o.authors = authors.map(jsonAuthor)
  if (item.categories?.length) o.tags = item.categories.map((c) => c.term)
  if (item.image) o.image = absolutize(item.image, base) ?? item.image

  if (item.enclosure) {
    const attachment: Record<string, unknown> = {
      url: absolutize(item.enclosure.url, base) ?? item.enclosure.url,
      mime_type: item.enclosure.type,
    }
    if (item.enclosure.length !== undefined) attachment.size_in_bytes = item.enclosure.length
    o.attachments = [attachment]
  }

  return o
}
