import type { FeedInput, FeedItem, SerializeOptions } from '../../types'
import { latestDate, rfc3339 } from '../../utils/date'
import { firstEnclosure } from '../../utils/enclosure'
import { hubList } from '../../utils/hub'
import { pagingMarker, pagingRels } from '../../utils/paging'
import { absolutize } from '../../utils/url'
import { el, type Node, specToNode, tag, xmlDocument } from '../../utils/xml'
import { hasMedia, MEDIA_NS, mediaItemNodes } from '../media'
import { atomCategories, atomEnclosureLink, atomPeople } from './author'
import { atomFeedIdentity, requireAtomId } from './identity'

// Atom 1.0 (RFC 4287).
export function toAtom10(input: FeedInput, opts: SerializeOptions): string {
  const { options, items } = input
  const base = opts.baseUrl

  const { self, link, feedId } = atomFeedIdentity(options, opts, 'Atom feed')

  const feed: Node[] = []
  feed.push(tag('id', feedId))
  feed.push(tag('title', options.title))
  if (options.description) feed.push(tag('subtitle', options.description))
  feed.push(tag('updated', rfc3339(options.updated ?? latestDate(items) ?? new Date())))
  if (link) feed.push(el('link', { rel: 'alternate', href: link }))
  if (self) feed.push(el('link', { rel: 'self', type: 'application/atom+xml', href: self }))
  for (const hub of hubList(options.hub)) {
    feed.push(el('link', { rel: 'hub', href: absolutize(hub, base) }))
  }
  if (options.paging) {
    for (const { rel, href } of pagingRels(options.paging, base)) {
      feed.push(el('link', { rel, href }))
    }
    // RFC 5005 §2/§4 — <fh:complete/> or <fh:archive/>; validateInput rejects setting both.
    const marker = pagingMarker(options.paging)
    if (marker) feed.push(el(`fh:${marker}`))
  }
  feed.push(...atomPeople(options.author, options.contributors, 'uri'))
  feed.push(tag('generator', options.generator ?? 'hono-feed'))
  if (options.copyright) feed.push(tag('rights', options.copyright))
  feed.push(...atomCategories(options.categories))
  // RFC 4287 §4.2.8: icon is a small square, logo a 2:1 image — same roles as RSS <image> and JSON Feed icon/favicon.
  if (options.favicon) feed.push(tag('icon', absolutize(options.favicon, base)))
  if (options.image) feed.push(tag('logo', absolutize(options.image, base)))
  if (options.customXml) feed.push(...options.customXml.map(specToNode))

  for (const item of items) feed.push(atomEntry10(item, base))

  const hasFh = options.paging !== undefined && pagingMarker(options.paging)
  // renderAttrs drops undefined values, so xml:lang simply vanishes when language is unset.
  const attrs = {
    xmlns: 'http://www.w3.org/2005/Atom',
    'xml:lang': options.language,
    'xmlns:fh': hasFh ? 'http://purl.org/syndication/history/1.0' : undefined,
    'xmlns:media': items.some((item) => hasMedia(item.media)) ? MEDIA_NS : undefined,
    ...options.customNamespaces,
  }
  return xmlDocument(el('feed', attrs, feed), { pretty: opts.pretty, version: opts.xmlVersion })
}

function atomEntry10(item: FeedItem, base?: string): Node {
  const link = absolutize(item.link, base)
  const id = requireAtomId(item.id ?? link, 'Atom entry')

  const ch: Node[] = []
  ch.push(tag('id', id))
  ch.push(tag('title', item.title))
  ch.push(tag('updated', rfc3339(item.updated ?? item.published ?? new Date())))
  if (item.published) ch.push(tag('published', rfc3339(item.published)))
  if (link) ch.push(el('link', { rel: 'alternate', href: link }))
  if (item.description) ch.push(tag('summary', item.description))
  // content type="html" body is escaped as a text node.
  if (item.content) ch.push(el('content', { type: 'html' }, item.content))

  if (item.source) {
    const self = el('link', { rel: 'self', href: absolutize(item.source.url, base) })
    ch.push(tag('source', [tag('title', item.source.title), self]))
  }

  ch.push(...atomPeople(item.author, item.contributors, 'uri'))
  ch.push(...atomCategories(item.categories))

  // RFC 4287 §4.2.7.2: rel="enclosure" identifies a related, potentially large resource. Atom, like RSS, supports at most one; keep only the first.
  const enclosure = firstEnclosure(item.enclosure)
  if (enclosure) ch.push(atomEnclosureLink(enclosure, base))

  ch.push(...mediaItemNodes(item.media, base))

  if (item.customXml) ch.push(...item.customXml.map(specToNode))

  // renderAttrs drops undefined values, so xml:lang simply vanishes when language is unset.
  return el('entry', { 'xml:lang': item.language }, ch)
}
