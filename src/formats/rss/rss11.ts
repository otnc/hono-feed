import type { FeedInput, SerializeOptions } from '../../types'
import { rfc3339 } from '../../utils/date'
import { absolutize, selfUrl } from '../../utils/url'
import { el, type Node, specToNode, tag, xmlDocument } from '../../utils/xml'
import { rdfItem } from './rdf-item'

// RSS 1.1: `<Channel>` root in the rss1.1# namespace. Items nest directly under `<items>` (no rdf:Seq). Uses Dublin Core + content modules like RSS 1.0.
export function toRSS11(input: FeedInput, opts: SerializeOptions): string {
  const { options, items } = input
  const base = opts.baseUrl

  const feedUri = selfUrl(opts, options) ?? absolutize(options.link, base)
  if (!feedUri) throw new TypeError('hono-feed: RSS 1.1 requires "feedUrl" or "link"')
  const home = absolutize(options.link, base)

  const itemNodes: Node[] = []
  for (const item of items) {
    itemNodes.push(rdfItem(item, base, '1.1').node)
  }

  // Channel <link> is mandatory; fall back to the feed URI.
  const channel: Node[] = [tag('title', options.title)]
  channel.push(tag('link', home ?? feedUri))
  channel.push(tag('description', options.description ?? ''))
  if (options.updated) channel.push(tag('dc:date', rfc3339(options.updated)))
  if (options.copyright) channel.push(tag('dc:rights', options.copyright))
  if (options.categories) {
    for (const cat of options.categories) channel.push(tag('dc:subject', cat.term))
  }
  // The spec makes rdf:parseType="Collection" mandatory on <items> (it replaces 1.0's rdf:Seq).
  channel.push(el('items', { 'rdf:parseType': 'Collection' }, itemNodes))
  // Escape hatch: appended unconditionally — RDF has no per-element gating to opt out of.
  if (options.customXml) channel.push(...options.customXml.map(specToNode))

  const hasContent = items.some((item) => item.content)
  const root = el(
    'Channel',
    {
      xmlns: 'http://purl.org/net/rss1.1#',
      'xmlns:rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      'xmlns:dc': 'http://purl.org/dc/elements/1.1/',
      'xmlns:content': hasContent ? 'http://purl.org/rss/1.0/modules/content/' : undefined,
      'xml:lang': options.language,
      'rdf:about': feedUri,
      ...options.customNamespaces,
    },
    channel,
  )
  return xmlDocument(root, { pretty: opts.pretty, version: opts.xmlVersion })
}
