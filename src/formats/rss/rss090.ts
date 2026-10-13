import type { FeedInput, SerializeOptions } from '../../types'
import { absolutize, selfUrl } from '../../utils/url'
import { el, type Node, tag, xmlDocument } from '../../utils/xml'

// RSS 0.90 (original Netscape "RDF Site Summary"): minimal `<rdf:RDF>`. Channel carries title/link/description; items carry only title/link. No rdf:Seq, no modules.
export function toRSS090(input: FeedInput, opts: SerializeOptions): string {
  const { options, items } = input
  const base = opts.baseUrl
  // Channel <link> is mandatory; fall back to the self URL.
  const home = absolutize(options.link, base) ?? selfUrl(opts, options)
  if (!home) throw new TypeError('hono-feed: RSS 0.90 requires "link" (or "feedUrl")')
  const imageUrl = options.image ? absolutize(options.image, base) : undefined

  const channel: Node[] = [tag('title', options.title)]
  channel.push(tag('link', home))
  channel.push(tag('description', options.description ?? ''))

  const nodes: Node[] = [tag('channel', channel)]
  if (imageUrl) {
    const img: Node[] = [tag('title', options.title), tag('url', imageUrl)]
    img.push(tag('link', home))
    nodes.push(tag('image', img))
  }
  for (const item of items) {
    const link = absolutize(item.link, base) ?? item.id
    if (!link) throw new TypeError('hono-feed: RSS 0.90 item requires "link" (or "id")')
    nodes.push(tag('item', [tag('title', item.title), tag('link', link)]))
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
