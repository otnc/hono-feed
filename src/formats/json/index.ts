import type { Author, FeedInput, FeedItem, SerializeOptions } from '../../types'
import { authorList } from '../../utils/author'
import { rfc3339 } from '../../utils/date'
import { warnDeprecated } from '../../utils/deprecation'
import { hubList } from '../../utils/hub'
import { absolutize, selfUrl } from '../../utils/url'

/** Serialize the neutral model to a JSON Feed 1.1 string. */
export function toJSONFeed(input: FeedInput, opts: SerializeOptions = {}): string {
  const { options, items } = input
  const base = opts.baseUrl
  // 1.0 uses the singular `author` and predates `language`.
  const v1 = opts.jsonFeedVersion === '1'

  if (v1 && !opts.suppressDeprecationWarnings) {
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
  const self = selfUrl(opts, options)
  if (self) feed.feed_url = self
  if (options.description) feed.description = options.description
  if (options.language && !v1) feed.language = options.language
  if (options.image) feed.icon = absolutize(options.image, base)
  if (options.favicon) feed.favicon = absolutize(options.favicon, base)
  if (options.author) {
    if (v1) feed.author = jsonAuthor(options.author)
    else feed.authors = [jsonAuthor(options.author)]
  }
  const hubs = hubList(options.hub)
  if (hubs.length) {
    feed.hubs = hubs.map((url) => ({ type: 'WebSub', url: absolutize(url, base) }))
  }

  feed.items = items.map((item) => jsonItem(item, v1, base))

  return JSON.stringify(feed, null, opts.pretty ? 2 : undefined)
}

function jsonAuthor(a: Author): Record<string, string> {
  const o: Record<string, string> = { name: a.name }
  if (a.url) o.url = a.url
  return o
}

function jsonItem(item: FeedItem, v1: boolean, base?: string): Record<string, unknown> {
  // Readers must discard items without an id, so refusing here beats emitting one.
  const id = item.id ?? item.link
  if (!id) throw new TypeError('hono-feed: JSON Feed item requires "id" (or "link")')
  const o: Record<string, unknown> = { id: String(id) }

  const url = absolutize(item.link, base)
  if (url) o.url = url
  o.title = item.title
  if (item.description) o.summary = item.description
  // At least one of content_html / content_text must be present; fall back to the summary text.
  if (item.content) o.content_html = item.content
  else if (item.description) o.content_text = item.description
  if (item.published) o.date_published = rfc3339(item.published)
  if (item.updated) o.date_modified = rfc3339(item.updated)

  const authors = authorList(item.author)
  if (authors.length) {
    if (v1) o.author = jsonAuthor(authors[0])
    else o.authors = authors.map(jsonAuthor)
  }
  if (item.categories?.length) o.tags = item.categories.map((c) => c.term)
  if (item.image) o.image = absolutize(item.image, base)

  if (item.enclosure) {
    const attachment: Record<string, unknown> = {
      url: absolutize(item.enclosure.url, base),
      mime_type: item.enclosure.type,
    }
    if (item.enclosure.length !== undefined) attachment.size_in_bytes = item.enclosure.length
    o.attachments = [attachment]
  }

  return o
}
