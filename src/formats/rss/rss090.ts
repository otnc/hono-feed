import type { FeedInput, SerializeOptions } from '../../types'
import { absolutize } from '../../utils/url'
import { el, type Node, xmlDocument } from '../../utils/xml'

// RSS 0.90 (original Netscape "RDF Site Summary"): minimal `<rdf:RDF>`. Channel carries
// title/link/description; items carry only title/link. No rdf:Seq, no modules.
export function toRSS090(input: FeedInput, opts: SerializeOptions): string {
  const { options, items } = input
  const base = opts.baseUrl
  const home = absolutize(options.link, base)
  const imageUrl = options.image ? (absolutize(options.image, base) ?? options.image) : undefined

  const channel: Node[] = [el('title', undefined, options.title)]
  if (home) channel.push(el('link', undefined, home))
  channel.push(el('description', undefined, options.description ?? ''))

  const nodes: Node[] = [el('channel', undefined, channel)]
  if (imageUrl) {
    const img: Node[] = [el('title', undefined, options.title), el('url', undefined, imageUrl)]
    if (home) img.push(el('link', undefined, home))
    nodes.push(el('image', undefined, img))
  }
  for (const item of items) {
    const ch: Node[] = [el('title', undefined, item.title)]
    const link = absolutize(item.link, base) ?? item.id
    if (link) ch.push(el('link', undefined, link))
    nodes.push(el('item', undefined, ch))
  }

  const root = el(
    'rdf:RDF',
    {
      'xmlns:rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      xmlns: 'http://my.netscape.com/rdf/simple/0.9/',
    },
    nodes,
  )
  return xmlDocument(root, { pretty: opts.pretty, version: opts.xmlVersion })
}
