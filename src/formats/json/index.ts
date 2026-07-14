import type { Author, FeedInput, FeedItem, SerializeOptions } from '../../types'
import { authorList } from '../../utils/author'
import { rfc3339 } from '../../utils/date'
import { warnDeprecated } from '../../utils/deprecation'
import { enclosureList } from '../../utils/enclosure'
import { hubList } from '../../utils/hub'
import { absolutize, selfUrl } from '../../utils/url'

export { validateInput } from '../../validate'

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
  if (options.userComment) feed.user_comment = options.userComment
  if (options.language && !v1) feed.language = options.language
  if (options.image) feed.icon = absolutize(options.image, base)
  if (options.favicon) feed.favicon = absolutize(options.favicon, base)
  // JSON Feed only has next_url; there's no equivalent for prev/first/last.
  if (options.paging?.next) feed.next_url = absolutize(options.paging.next, base)
  if (options.author) {
    if (v1) feed.author = jsonAuthor(options.author, base)
    else feed.authors = [jsonAuthor(options.author, base)]
  }
  const hubs = hubList(options.hub)
  if (hubs.length) {
    feed.hubs = hubs.map((url) => ({ type: 'WebSub', url: absolutize(url, base) }))
  }
  if (options.expired !== undefined) feed.expired = options.expired

  if (options.customJson) mergeCustomJson(feed, options.customJson)

  feed.items = items.map((item) => jsonItem(item, v1, base))

  return JSON.stringify(feed, null, opts.pretty ? 2 : undefined)
}

function jsonAuthor(a: Author, base?: string): Record<string, string> {
  const o: Record<string, string> = { name: a.name }
  // absolutize() only returns undefined for a falsy url, which a.url/a.avatar aren't here.
  if (a.url) o.url = absolutize(a.url, base) as string
  if (a.avatar) o.avatar = absolutize(a.avatar, base) as string
  return o
}

// A built-in key always wins on collision — customJson can only add keys, not override them.
function mergeCustomJson(target: Record<string, unknown>, custom: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(custom)) {
    if (!(key in target)) target[key] = value
  }
}

function jsonItem(item: FeedItem, v1: boolean, base?: string): Record<string, unknown> {
  // Readers must discard items without an id, so refusing here beats emitting one.
  const id = item.id ?? item.link
  if (!id) throw new TypeError('hono-feed: JSON Feed item requires "id" (or "link")')
  const o: Record<string, unknown> = { id: String(id) }

  const url = absolutize(item.link, base)
  if (url) o.url = url
  if (item.externalUrl) o.external_url = absolutize(item.externalUrl, base)
  o.title = item.title
  if (item.description) o.summary = item.description
  // At least one of content_html / content_text must be present; fall back to the summary text.
  if (item.content) o.content_html = item.content
  else if (item.description) o.content_text = item.description
  if (item.published) o.date_published = rfc3339(item.published)
  if (item.updated) o.date_modified = rfc3339(item.updated)

  const authors = authorList(item.author)
  if (authors.length) {
    if (v1) o.author = jsonAuthor(authors[0], base)
    else o.authors = authors.map((author) => jsonAuthor(author, base))
  }
  if (item.categories?.length) o.tags = item.categories.map((c) => c.term)
  if (item.image) o.image = absolutize(item.image, base)
  if (item.bannerImage) o.banner_image = absolutize(item.bannerImage, base)
  // Per-item language is 1.1-only, gated the same way the feed-level language already is.
  if (item.language && !v1) o.language = item.language

  const attachments = enclosureList(item.enclosure).map((enclosure) => {
    const attachment: Record<string, unknown> = {
      url: absolutize(enclosure.url, base),
      mime_type: enclosure.type,
    }
    if (enclosure.length !== undefined) attachment.size_in_bytes = enclosure.length
    if (enclosure.duration !== undefined) attachment.duration_in_seconds = enclosure.duration
    if (enclosure.title) attachment.title = enclosure.title
    return attachment
  })
  if (attachments.length) o.attachments = attachments

  if (item.customJson) mergeCustomJson(o, item.customJson)

  return o
}
