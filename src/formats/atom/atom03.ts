import type { Author, FeedInput, FeedItem, SerializeOptions } from '../../types'
import { latestDate, rfc3339 } from '../../utils/date'
import { absolutize } from '../../utils/url'
import { el, type Node, xmlDocument } from '../../utils/xml'

// Atom 0.3 (deprecated, pre-RFC). Namespace purl.org/atom/ns#; uses tagline / modified /
// issued / copyright and author <url>; content is escaped HTML.
export function toAtom03(input: FeedInput, opts: SerializeOptions): string {
  const { options, items } = input
  const base = opts.baseUrl

  const self = opts.feedUrl ?? absolutize(options.feedUrl, base)
  const link = absolutize(options.link, base)
  const feedId = options.id ?? link ?? self
  if (!feedId) throw new TypeError('hono-feed: Atom 0.3 feed requires an id')

  const feed: Node[] = [el('title', undefined, options.title)]
  if (options.description) feed.push(el('tagline', undefined, options.description))
  if (link) feed.push(el('link', { rel: 'alternate', type: 'text/html', href: link }))
  feed.push(el('modified', undefined, rfc3339(options.updated ?? latestDate(items) ?? new Date())))
  if (options.author) feed.push(authorEl03(options.author))
  feed.push(el('generator', undefined, options.generator ?? 'hono-feed'))
  if (options.copyright) feed.push(el('copyright', undefined, options.copyright))
  feed.push(el('id', undefined, feedId))

  for (const item of items) feed.push(atomEntry03(item, base))

  const attrs = options.language
    ? { version: '0.3', xmlns: 'http://purl.org/atom/ns#', 'xml:lang': options.language }
    : { version: '0.3', xmlns: 'http://purl.org/atom/ns#' }
  return xmlDocument(el('feed', attrs, feed), { pretty: opts.pretty, version: opts.xmlVersion })
}

function authorEl03(a: Author): Node {
  const ch: Node[] = [el('name', undefined, a.name)]
  if (a.email) ch.push(el('email', undefined, a.email))
  if (a.url) ch.push(el('url', undefined, a.url))
  return el('author', undefined, ch)
}

function atomEntry03(item: FeedItem, base?: string): Node {
  const link = absolutize(item.link, base)
  const id = item.id ?? link
  if (!id) throw new TypeError('hono-feed: Atom 0.3 entry requires an id')

  const ch: Node[] = [el('title', undefined, item.title)]
  if (link) ch.push(el('link', { rel: 'alternate', type: 'text/html', href: link }))
  ch.push(el('id', undefined, id))
  if (item.published) ch.push(el('issued', undefined, rfc3339(item.published)))
  ch.push(el('modified', undefined, rfc3339(item.updated ?? item.published ?? new Date())))
  if (item.description) ch.push(el('summary', undefined, item.description))
  if (item.content) ch.push(el('content', { type: 'text/html', mode: 'escaped' }, item.content))

  const authors = item.author ? (Array.isArray(item.author) ? item.author : [item.author]) : []
  for (const a of authors) ch.push(authorEl03(a))

  return el('entry', undefined, ch)
}
