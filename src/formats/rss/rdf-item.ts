import type { FeedItem } from '../../types'
import { firstAuthor } from '../../utils/author'
import { rfc3339 } from '../../utils/date'
import { absolutize } from '../../utils/url'
import { cdata, el, type Node, raw } from '../../utils/xml'

/** Shared RSS 1.0 / 1.1 `<item rdf:about="…">` builder — both are RDF + Dublin Core. */
export function rdfItem(
  item: FeedItem,
  base: string | undefined,
  version: '1.0' | '1.1',
): { uri: string; node: Node } {
  const uri = item.id ?? absolutize(item.link, base)
  if (!uri) throw new TypeError(`hono-feed: RSS ${version} item requires "link" or "id"`)

  const ch: Node[] = [el('title', undefined, item.title)]
  // Item <link> is mandatory; fall back to the item URI (rdf:about).
  const link = absolutize(item.link, base) ?? uri
  ch.push(el('link', undefined, link))
  if (item.description) ch.push(el('description', undefined, item.description))
  if (item.published) ch.push(el('dc:date', undefined, rfc3339(item.published)))
  const author = firstAuthor(item.author)
  if (author?.name) ch.push(el('dc:creator', undefined, author.name))
  if (item.content) ch.push(el('content:encoded', undefined, raw(cdata(item.content))))
  if (item.categories) {
    for (const cat of item.categories) ch.push(el('dc:subject', undefined, cat.term))
  }

  return { uri, node: el('item', { 'rdf:about': uri }, ch) }
}
