import type { FeedInput, SerializeOptions } from '../../types'
import { rfc3339 } from '../../utils/date'
import { absolutize } from '../../utils/url'
import { cdata, el, type Node, raw, xmlDocument } from '../../utils/xml'

// RSS 1.1: `<Channel>` root in the rss1.1# namespace. Items nest directly under
// `<items>` (no rdf:Seq). Uses Dublin Core + content modules like RSS 1.0.
export function toRSS11(input: FeedInput, opts: SerializeOptions): string {
  const { options, items } = input
  const base = opts.baseUrl

  const feedUri =
    opts.feedUrl ?? absolutize(options.feedUrl, base) ?? absolutize(options.link, base)
  if (!feedUri) throw new TypeError('hono-feed: RSS 1.1 requires "feedUrl" or "link"')
  const home = absolutize(options.link, base)

  const itemNodes: Node[] = []
  for (const item of items) {
    const uri = item.id ?? absolutize(item.link, base)
    if (!uri) throw new TypeError('hono-feed: RSS 1.1 item requires "link" or "id"')

    const ch: Node[] = [el('title', undefined, item.title)]
    const link = absolutize(item.link, base)
    if (link) ch.push(el('link', undefined, link))
    if (item.description) ch.push(el('description', undefined, item.description))
    if (item.published) ch.push(el('dc:date', undefined, rfc3339(item.published)))
    const author = Array.isArray(item.author) ? item.author[0] : item.author
    if (author?.name) ch.push(el('dc:creator', undefined, author.name))
    if (item.content) ch.push(el('content:encoded', undefined, raw(cdata(item.content))))
    if (item.categories) {
      for (const cat of item.categories) ch.push(el('dc:subject', undefined, cat.term))
    }
    itemNodes.push(el('item', { 'rdf:about': uri }, ch))
  }

  const channel: Node[] = [el('title', undefined, options.title)]
  if (home) channel.push(el('link', undefined, home))
  channel.push(el('description', undefined, options.description ?? ''))
  if (options.updated) channel.push(el('dc:date', undefined, rfc3339(options.updated)))
  if (options.copyright) channel.push(el('dc:rights', undefined, options.copyright))
  channel.push(el('items', undefined, itemNodes))

  const hasContent = items.some((item) => item.content != null)
  const root = el(
    'Channel',
    {
      xmlns: 'http://purl.org/net/rss1.1#',
      'xmlns:rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      'xmlns:dc': 'http://purl.org/dc/elements/1.1/',
      'xmlns:content': hasContent ? 'http://purl.org/rss/1.0/modules/content/' : undefined,
      ...(options.language ? { 'xml:lang': options.language } : {}),
      'rdf:about': feedUri,
    },
    channel,
  )
  return xmlDocument(root, { pretty: opts.pretty, version: opts.xmlVersion })
}
