import type { Author, FeedInput, FeedItem, SerializeOptions } from '../../types'
import { authorList } from '../../utils/author'
import { latestDate, rfc3339 } from '../../utils/date'
import { absolutize } from '../../utils/url'
import { el, type Node, xmlDocument } from '../../utils/xml'

// Atom 1.0 (RFC 4287).
export function toAtom10(input: FeedInput, opts: SerializeOptions): string {
  const { options, items } = input
  const base = opts.baseUrl

  const self = opts.feedUrl ?? absolutize(options.feedUrl, base)
  const link = absolutize(options.link, base)
  const feedId = options.id ?? link ?? self
  if (!feedId) throw new TypeError('hono-feed: Atom feed requires an id')

  const feed: Node[] = []
  feed.push(el('id', undefined, feedId))
  feed.push(el('title', undefined, options.title))
  if (options.description) feed.push(el('subtitle', undefined, options.description))
  feed.push(el('updated', undefined, rfc3339(options.updated ?? latestDate(items) ?? new Date())))
  if (link) feed.push(el('link', { rel: 'alternate', href: link }))
  if (self) feed.push(el('link', { rel: 'self', type: 'application/atom+xml', href: self }))
  if (options.author) feed.push(authorEl(options.author))
  feed.push(el('generator', undefined, options.generator ?? 'hono-feed'))
  if (options.copyright) feed.push(el('rights', undefined, options.copyright))

  for (const item of items) feed.push(atomEntry10(item, base))

  const attrs = options.language
    ? { xmlns: 'http://www.w3.org/2005/Atom', 'xml:lang': options.language }
    : { xmlns: 'http://www.w3.org/2005/Atom' }
  return xmlDocument(el('feed', attrs, feed), { pretty: opts.pretty, version: opts.xmlVersion })
}

function authorEl(a: Author): Node {
  const ch: Node[] = [el('name', undefined, a.name)]
  if (a.email) ch.push(el('email', undefined, a.email))
  if (a.url) ch.push(el('uri', undefined, a.url))
  return el('author', undefined, ch)
}

function atomEntry10(item: FeedItem, base?: string): Node {
  const link = absolutize(item.link, base)
  const id = item.id ?? link
  if (!id) throw new TypeError('hono-feed: Atom entry requires an id')

  const ch: Node[] = []
  ch.push(el('id', undefined, id))
  ch.push(el('title', undefined, item.title))
  ch.push(el('updated', undefined, rfc3339(item.updated ?? item.published ?? new Date())))
  if (item.published) ch.push(el('published', undefined, rfc3339(item.published)))
  if (link) ch.push(el('link', { rel: 'alternate', href: link }))
  if (item.description) ch.push(el('summary', undefined, item.description))
  // content type="html" body is escaped as a text node.
  if (item.content) ch.push(el('content', { type: 'html' }, item.content))

  for (const a of authorList(item.author)) ch.push(authorEl(a))

  if (item.categories) {
    for (const cat of item.categories) {
      ch.push(
        el('category', cat.scheme ? { term: cat.term, scheme: cat.scheme } : { term: cat.term }),
      )
    }
  }

  return el('entry', undefined, ch)
}
