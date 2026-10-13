import type { FeedItem, FeedOptions, SerializeOptions } from '../../types'
import { firstAuthor } from '../../utils/author'
import { rfc3339 } from '../../utils/date'
import { absolutize, selfUrl } from '../../utils/url'
import { cdata, el, type Node, raw, tag } from '../../utils/xml'

/** Shared RSS 1.0 / 1.1 `<item rdf:about="…">` builder — both are RDF + Dublin Core. */
export function rdfItem(
  item: FeedItem,
  base: string | undefined,
  version: '1.0' | '1.1',
): { uri: string; node: Node } {
  const uri = item.id ?? absolutize(item.link, base)
  if (!uri) throw new TypeError(`hono-feed: RSS ${version} item requires "link" or "id"`)

  const ch: Node[] = [tag('title', item.title)]
  // Item <link> is mandatory; fall back to the item URI (rdf:about).
  const link = absolutize(item.link, base) ?? uri
  ch.push(tag('link', link))
  if (item.description) ch.push(tag('description', item.description))
  if (item.published) ch.push(tag('dc:date', rfc3339(item.published)))
  const author = firstAuthor(item.author)
  if (author?.name) ch.push(tag('dc:creator', author.name))
  if (item.content) ch.push(tag('content:encoded', raw(cdata(item.content))))
  if (item.categories) {
    for (const cat of item.categories) ch.push(tag('dc:subject', cat.term))
  }

  return { uri, node: el('item', { 'rdf:about': uri }, ch) }
}

/** The channel's `rdf:about` URI: the self URL, else the home link. */
export function rdfFeedUri(
  options: FeedOptions,
  opts: SerializeOptions,
  version: '1.0' | '1.1',
): string {
  const feedUri = selfUrl(opts, options) ?? absolutize(options.link, opts.baseUrl)
  if (!feedUri) throw new TypeError(`hono-feed: RSS ${version} requires "feedUrl" or "link"`)
  return feedUri
}

/**
 * Channel children RSS 1.0 and 1.1 share, in document order. Only 1.0 carries `dc:language` here (1.1 uses `xml:lang` on the root).
 * The channel `<link>` is mandatory, so it falls back to the feed URI.
 */
export function rdfChannelNodes(
  options: FeedOptions,
  home: string | undefined,
  feedUri: string,
  withLanguage: boolean,
): Node[] {
  const nodes: Node[] = [
    tag('title', options.title),
    tag('link', home ?? feedUri),
    tag('description', options.description ?? ''),
  ]
  if (withLanguage && options.language) nodes.push(tag('dc:language', options.language))
  if (options.updated) nodes.push(tag('dc:date', rfc3339(options.updated)))
  if (options.copyright) nodes.push(tag('dc:rights', options.copyright))
  for (const cat of options.categories ?? []) nodes.push(tag('dc:subject', cat.term))
  return nodes
}
