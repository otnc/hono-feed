import type { FeedInput, SerializeOptions } from '../../types'
import { absolutize } from '../../utils/url'
import { el, type Node, specToNode, xmlDocument } from '../../utils/xml'
import { rdfChannelNodes, rdfFeedUri, rdfItem } from './rdf-item'

// RSS 1.1: `<Channel>` root in the rss1.1# namespace. Items nest directly under `<items>` (no rdf:Seq). Uses Dublin Core + content modules like RSS 1.0.
export function toRSS11(input: FeedInput, opts: SerializeOptions): string {
  const { options, items } = input
  const base = opts.baseUrl

  const feedUri = rdfFeedUri(options, opts, '1.1')
  const home = absolutize(options.link, base)

  const itemNodes: Node[] = []
  for (const item of items) {
    itemNodes.push(rdfItem(item, base, '1.1').node)
  }

  const channel = rdfChannelNodes(options, home, feedUri, false)
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
