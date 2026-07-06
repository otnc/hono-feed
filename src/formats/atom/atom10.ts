import type { FeedInput, FeedItem, SerializeOptions } from '../../types'
import { authorList } from '../../utils/author'
import { latestDate, rfc3339 } from '../../utils/date'
import { pagingRels } from '../../utils/paging'
import { absolutize } from '../../utils/url'
import { el, type Node, xmlDocument } from '../../utils/xml'
import { atomAuthorEl } from './author'
import { atomFeedIdentity } from './identity'

// Atom 1.0 (RFC 4287).
export function toAtom10(input: FeedInput, opts: SerializeOptions): string {
  const { options, items } = input
  const base = opts.baseUrl

  const { self, link, feedId } = atomFeedIdentity(options, opts, 'Atom feed')

  const feed: Node[] = []
  feed.push(el('id', undefined, feedId))
  feed.push(el('title', undefined, options.title))
  if (options.description) feed.push(el('subtitle', undefined, options.description))
  feed.push(el('updated', undefined, rfc3339(options.updated ?? latestDate(items) ?? new Date())))
  if (link) feed.push(el('link', { rel: 'alternate', href: link }))
  if (self) feed.push(el('link', { rel: 'self', type: 'application/atom+xml', href: self }))
  if (options.paging) {
    for (const { rel, href } of pagingRels(options.paging, base)) {
      feed.push(el('link', { rel, href }))
    }
  }
  if (options.author) feed.push(atomAuthorEl(options.author, 'uri'))
  feed.push(el('generator', undefined, options.generator ?? 'hono-feed'))
  if (options.copyright) feed.push(el('rights', undefined, options.copyright))

  for (const item of items) feed.push(atomEntry10(item, base))

  // renderAttrs drops undefined values, so xml:lang simply vanishes when language is unset.
  const attrs = { xmlns: 'http://www.w3.org/2005/Atom', 'xml:lang': options.language }
  return xmlDocument(el('feed', attrs, feed), { pretty: opts.pretty, version: opts.xmlVersion })
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

  for (const a of authorList(item.author)) ch.push(atomAuthorEl(a, 'uri'))

  if (item.categories) {
    for (const cat of item.categories) {
      ch.push(el('category', { term: cat.term, scheme: cat.scheme }))
    }
  }

  return el('entry', undefined, ch)
}
