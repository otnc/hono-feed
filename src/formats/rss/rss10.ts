import type { FeedInput, SerializeOptions } from '../../types'
import { rfc3339 } from '../../utils/date'
import { absolutize, selfUrl } from '../../utils/url'
import { el, type Node, specToNode, xmlDocument } from '../../utils/xml'
import { rdfItem } from './rdf-item'

// RSS 1.0 (RDF Site Summary): `<rdf:RDF>` root with an `<items>`/`rdf:Seq` table of
// contents plus Dublin Core + content modules.
export function toRSS10(input: FeedInput, opts: SerializeOptions): string {
  const { options, items } = input
  const base = opts.baseUrl

  const feedUri = selfUrl(opts, options) ?? absolutize(options.link, base)
  if (!feedUri) throw new TypeError('hono-feed: RSS 1.0 requires "feedUrl" or "link"')
  const home = absolutize(options.link, base)
  const imageUrl = options.image ? absolutize(options.image, base) : undefined

  const seq: Node[] = []
  const itemNodes: Node[] = []
  for (const item of items) {
    const { uri, node } = rdfItem(item, base, '1.0')
    seq.push(el('rdf:li', { 'rdf:resource': uri }))
    itemNodes.push(node)
  }

  // Channel <link> is mandatory; fall back to the feed URI.
  const channel: Node[] = [el('title', undefined, options.title)]
  channel.push(el('link', undefined, home ?? feedUri))
  channel.push(el('description', undefined, options.description ?? ''))
  if (options.language) channel.push(el('dc:language', undefined, options.language))
  if (options.updated) channel.push(el('dc:date', undefined, rfc3339(options.updated)))
  if (options.copyright) channel.push(el('dc:rights', undefined, options.copyright))
  if (options.categories) {
    for (const cat of options.categories) channel.push(el('dc:subject', undefined, cat.term))
  }
  channel.push(el('items', undefined, [el('rdf:Seq', undefined, seq)]))
  if (imageUrl) channel.push(el('image', { 'rdf:resource': imageUrl }))
  // Escape hatch: appended unconditionally — RDF has no per-element gating to opt out of.
  if (options.customXml) channel.push(...options.customXml.map(specToNode))

  const nodes: Node[] = [el('channel', { 'rdf:about': feedUri }, channel)]
  if (imageUrl) {
    const img: Node[] = [el('title', undefined, options.title), el('url', undefined, imageUrl)]
    if (home) img.push(el('link', undefined, home))
    nodes.push(el('image', { 'rdf:about': imageUrl }, img))
  }
  nodes.push(...itemNodes)

  const hasContent = items.some((item) => item.content != null)
  const root = el(
    'rdf:RDF',
    {
      'xmlns:rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      xmlns: 'http://purl.org/rss/1.0/',
      'xmlns:dc': 'http://purl.org/dc/elements/1.1/',
      'xmlns:content': hasContent ? 'http://purl.org/rss/1.0/modules/content/' : undefined,
      ...options.customNamespaces,
    },
    nodes,
  )
  return xmlDocument(root, { pretty: opts.pretty, version: opts.xmlVersion })
}
