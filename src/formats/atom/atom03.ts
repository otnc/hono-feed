import type { FeedInput, FeedItem, SerializeOptions } from '../../types'
import { latestDate, rfc3339 } from '../../utils/date'
import { firstEnclosure } from '../../utils/enclosure'
import { absolutize } from '../../utils/url'
import { el, type Node, tag, xmlDocument } from '../../utils/xml'
import { atomEnclosureLink, atomPeople } from './author'
import { atomFeedIdentity, requireAtomId } from './identity'

// Atom 0.3 (deprecated, pre-RFC). Namespace purl.org/atom/ns#; uses tagline / modified / issued / copyright and author <url>; content is escaped HTML.
export function toAtom03(input: FeedInput, opts: SerializeOptions): string {
  const { options, items } = input
  const base = opts.baseUrl

  const { link, feedId } = atomFeedIdentity(options, opts, 'Atom 0.3 feed')

  const feed: Node[] = [tag('title', options.title)]
  if (options.description) feed.push(tag('tagline', options.description))
  if (link) feed.push(el('link', { rel: 'alternate', type: 'text/html', href: link }))
  feed.push(tag('modified', rfc3339(options.updated ?? latestDate(items) ?? new Date())))
  feed.push(...atomPeople(options.author, undefined, 'url'))
  feed.push(tag('generator', options.generator ?? 'hono-feed'))
  if (options.copyright) feed.push(tag('copyright', options.copyright))
  feed.push(tag('id', feedId))

  for (const item of items) feed.push(atomEntry03(item, base))

  // renderAttrs drops undefined values, so xml:lang simply vanishes when language is unset.
  const attrs = { version: '0.3', xmlns: 'http://purl.org/atom/ns#', 'xml:lang': options.language }
  return xmlDocument(el('feed', attrs, feed), { pretty: opts.pretty, version: opts.xmlVersion })
}

function atomEntry03(item: FeedItem, base?: string): Node {
  const link = absolutize(item.link, base)
  const id = requireAtomId(item.id ?? link, 'Atom 0.3 entry')

  const ch: Node[] = [tag('title', item.title)]
  if (link) ch.push(el('link', { rel: 'alternate', type: 'text/html', href: link }))
  ch.push(tag('id', id))
  // <issued> is mandatory in 0.3 (unlike published in 1.0); fall back to updated.
  ch.push(tag('issued', rfc3339(item.published ?? item.updated ?? new Date())))
  ch.push(tag('modified', rfc3339(item.updated ?? item.published ?? new Date())))
  if (item.description) ch.push(tag('summary', item.description))
  if (item.content) ch.push(el('content', { type: 'text/html', mode: 'escaped' }, item.content))

  ch.push(...atomPeople(item.author, undefined, 'url'))

  // Atom 0.3's link draft defines rel="enclosure" the same way 1.0 (RFC 4287 §4.2.7.2) does. Like 1.0, at most one is supported; keep only the first.
  const enclosure = firstEnclosure(item.enclosure)
  if (enclosure) ch.push(atomEnclosureLink(enclosure, base))

  return tag('entry', ch)
}
