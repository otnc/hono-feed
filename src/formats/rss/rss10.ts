import type { FeedInput, SerializeOptions } from '../../types'
import { absolutize } from '../../utils/url'
import { el, type Node, specToNode, tag, xmlDocument } from '../../utils/xml'
import { rdfChannelNodes, rdfFeedUri, rdfItem } from './rdf-item'

// RSS 1.0 (RDF Site Summary): `<rdf:RDF>` root with an `<items>`/`rdf:Seq` table of contents plus Dublin Core + content modules.
export function toRSS10(input: FeedInput, opts: SerializeOptions): string {
  const { options, items } = input
  const base = opts.baseUrl

  const feedUri = rdfFeedUri(options, opts, '1.0')
  const home = absolutize(options.link, base)
  const imageUrl = options.image ? absolutize(options.image, base) : undefined

  const seq: Node[] = []
  const itemNodes: Node[] = []
  for (const item of items) {
    const { uri, node } = rdfItem(item, base, '1.0')
    seq.push(el('rdf:li', { 'rdf:resource': uri }))
    itemNodes.push(node)
  }

  const channel = rdfChannelNodes(options, home, feedUri, true)
  channel.push(tag('items', [tag('rdf:Seq', seq)]))
  if (imageUrl) channel.push(el('image', { 'rdf:resource': imageUrl }))
  // Escape hatch: appended unconditionally — RDF has no per-element gating to opt out of.
  if (options.customXml) channel.push(...options.customXml.map(specToNode))

  const nodes: Node[] = [el('channel', { 'rdf:about': feedUri }, channel)]
  if (imageUrl) {
    const img: Node[] = [tag('title', options.title), tag('url', imageUrl)]
    if (home) img.push(tag('link', home))
    nodes.push(el('image', { 'rdf:about': imageUrl }, img))
  }
  nodes.push(...itemNodes)

  const hasContent = items.some((item) => item.content)
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
