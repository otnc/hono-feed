import type { FeedInput, FeedItem, SerializeOptions } from '../../types'
import { authorList } from '../../utils/author'
import { latestDate, rfc3339 } from '../../utils/date'
import { firstEnclosure } from '../../utils/enclosure'
import { absolutize, hasIriScheme } from '../../utils/url'
import { el, type Node, xmlDocument } from '../../utils/xml'
import { atomAuthorEl } from './author'
import { atomFeedIdentity } from './identity'

// Atom 0.3 (deprecated, pre-RFC). Namespace purl.org/atom/ns#; uses tagline / modified /
// issued / copyright and author <url>; content is escaped HTML.
export function toAtom03(input: FeedInput, opts: SerializeOptions): string {
  const { options, items } = input
  const base = opts.baseUrl

  const { link, feedId } = atomFeedIdentity(options, opts, 'Atom 0.3 feed')

  const feed: Node[] = [el('title', undefined, options.title)]
  if (options.description) feed.push(el('tagline', undefined, options.description))
  if (link) feed.push(el('link', { rel: 'alternate', type: 'text/html', href: link }))
  feed.push(el('modified', undefined, rfc3339(options.updated ?? latestDate(items) ?? new Date())))
  if (options.author) feed.push(atomAuthorEl(options.author, 'url'))
  feed.push(el('generator', undefined, options.generator ?? 'hono-feed'))
  if (options.copyright) feed.push(el('copyright', undefined, options.copyright))
  feed.push(el('id', undefined, feedId))

  for (const item of items) feed.push(atomEntry03(item, base))

  // renderAttrs drops undefined values, so xml:lang simply vanishes when language is unset.
  const attrs = { version: '0.3', xmlns: 'http://purl.org/atom/ns#', 'xml:lang': options.language }
  return xmlDocument(el('feed', attrs, feed), { pretty: opts.pretty, version: opts.xmlVersion })
}

function atomEntry03(item: FeedItem, base?: string): Node {
  const link = absolutize(item.link, base)
  const id = item.id ?? link
  if (!id) throw new TypeError('hono-feed: Atom 0.3 entry requires an id')
  // RFC 4287 §4.2.6: atom:id MUST be an absolute IRI. An explicit id is checked by
  // validateInput; the link fallback isn't, so a relative link with no baseUrl could
  // otherwise reach the document unchecked.
  if (!hasIriScheme(id)) {
    throw new TypeError(
      'hono-feed: Atom 0.3 entry id must be an absolute IRI (RFC 4287 §4.2.6) — set "baseUrl" or an absolute "id"/"link"',
    )
  }

  const ch: Node[] = [el('title', undefined, item.title)]
  if (link) ch.push(el('link', { rel: 'alternate', type: 'text/html', href: link }))
  ch.push(el('id', undefined, id))
  // <issued> is mandatory in 0.3 (unlike published in 1.0); fall back to updated.
  ch.push(el('issued', undefined, rfc3339(item.published ?? item.updated ?? new Date())))
  ch.push(el('modified', undefined, rfc3339(item.updated ?? item.published ?? new Date())))
  if (item.description) ch.push(el('summary', undefined, item.description))
  if (item.content) ch.push(el('content', { type: 'text/html', mode: 'escaped' }, item.content))

  for (const a of authorList(item.author)) ch.push(atomAuthorEl(a, 'url'))

  // Atom 0.3's link draft defines rel="enclosure" the same way 1.0 (RFC 4287 §4.2.7.2) does.
  // Like 1.0, at most one is supported; keep only the first.
  const enclosure = firstEnclosure(item.enclosure)
  if (enclosure) {
    ch.push(
      el('link', {
        rel: 'enclosure',
        href: absolutize(enclosure.url, base),
        type: enclosure.type,
        length: enclosure.length !== undefined ? String(enclosure.length) : undefined,
      }),
    )
  }

  return el('entry', undefined, ch)
}
