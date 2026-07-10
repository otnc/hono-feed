import type { FeedInput, FeedItem, SerializeOptions } from '../../types'
import { firstAuthor } from '../../utils/author'
import { rfc822 } from '../../utils/date'
import { firstEnclosure } from '../../utils/enclosure'
import { hubList } from '../../utils/hub'
import { pagingMarker, pagingRels } from '../../utils/paging'
import { absolutize, isUrl, selfUrl } from '../../utils/url'
import { cdata, el, type Node, raw, specToNode, xmlDocument } from '../../utils/xml'
import {
  ITUNES_NS,
  PODCAST_NS,
  podcastChannelNodes,
  podcastItemNodes,
  podcastNamespacesUsed,
} from './podcast'

// `<rss version="…">` structure (Netscape/UserLand lineage: 0.91 / 0.92 / 0.93 / 0.94 / 2.0).
//
// Older versions define smaller element sets, so emission is gated per version:
// item category/enclosure arrived in 0.92, item pubDate in 0.93, and guid, item author,
// generator, ttl and namespaced extensions (atom:link, content:encoded) are 2.0-only.
interface Caps {
  itemLinkRequired: boolean // 0.91 (0.92 made all item elements optional)
  itemPubDate: boolean
  itemRich092: boolean // category / enclosure (0.92+)
  rss20: boolean // guid / author / generator / ttl / namespaces
}

export function toRSS2(input: FeedInput, opts: SerializeOptions): string {
  const { options, items } = input
  const base = opts.baseUrl
  const version = opts.rssVersion ?? '2.0'
  const caps: Caps = {
    itemLinkRequired: version === '0.91',
    itemPubDate: version === '2.0' || version === '0.94' || version === '0.93',
    itemRich092: version !== '0.91',
    rss20: version === '2.0',
  }

  // The Netscape 0.91 spec makes channel <language> mandatory.
  if (version === '0.91' && !options.language) {
    throw new TypeError('hono-feed: RSS 0.91 requires "language"')
  }

  // Channel <link> is mandatory in every RSS version; fall back to the self URL.
  const self = selfUrl(opts, options)
  const link = absolutize(options.link, base) ?? self
  if (!link) throw new TypeError('hono-feed: RSS requires "link" (or "feedUrl")')

  const channel: Node[] = []
  channel.push(el('title', undefined, options.title))
  channel.push(el('link', undefined, link))
  channel.push(el('description', undefined, options.description ?? ''))
  if (options.language) channel.push(el('language', undefined, options.language))
  if (options.copyright) channel.push(el('copyright', undefined, options.copyright))
  // Channel <category> arrived in 0.92 alongside the item-level element (same rules apply).
  if (caps.itemRich092 && options.categories) {
    for (const cat of options.categories) {
      channel.push(el('category', { domain: cat.scheme }, cat.term))
    }
  }
  if (options.published) channel.push(el('pubDate', undefined, rfc822(options.published)))
  if (options.updated) channel.push(el('lastBuildDate', undefined, rfc822(options.updated)))
  // managingEditor/webMaster/docs/skipHours/skipDays are all part of the format since Netscape
  // 0.91; ungated here like language/copyright above.
  const feedAuthor = firstAuthor(options.author)
  if (feedAuthor?.email) {
    channel.push(el('managingEditor', undefined, emailLine(feedAuthor.email, feedAuthor.name)))
  }
  if (options.webmaster?.email) {
    channel.push(
      el('webMaster', undefined, emailLine(options.webmaster.email, options.webmaster.name)),
    )
  }
  if (options.docs) {
    channel.push(
      el(
        'docs',
        undefined,
        options.docs === true ? 'https://www.rssboard.org/rss-specification' : options.docs,
      ),
    )
  }
  if (options.skipHours?.length) {
    channel.push(
      el(
        'skipHours',
        undefined,
        options.skipHours.map((hour) => el('hour', undefined, String(hour))),
      ),
    )
  }
  if (options.skipDays?.length) {
    channel.push(
      el(
        'skipDays',
        undefined,
        options.skipDays.map((day) => el('day', undefined, day)),
      ),
    )
  }
  if (caps.rss20) {
    channel.push(el('generator', undefined, options.generator ?? 'hono-feed'))
    if (options.ttl !== undefined) channel.push(el('ttl', undefined, String(options.ttl)))
    if (self) {
      channel.push(el('atom:link', { href: self, rel: 'self', type: 'application/rss+xml' }))
    }
    for (const hub of hubList(options.hub)) {
      channel.push(el('atom:link', { href: absolutize(hub, base), rel: 'hub' }))
    }
    if (options.paging) {
      for (const { rel, href } of pagingRels(options.paging, base)) {
        channel.push(el('atom:link', { href, rel }))
      }
      // RFC 5005 §2/§4 — <fh:complete/> or <fh:archive/>; validateInput rejects setting both.
      const marker = pagingMarker(options.paging)
      if (marker) channel.push(el(`fh:${marker}`))
    }
  }

  if (options.image) {
    const img: Node[] = [el('url', undefined, absolutize(options.image, base))]
    img.push(el('title', undefined, options.title))
    // <image> requires url/title/link all three.
    img.push(el('link', undefined, link))
    channel.push(el('image', undefined, img))
  }

  // Podcast metadata (iTunes / Podcasting 2.0) is RSS 2.0-only, like the rest of caps.rss20.
  if (caps.rss20) channel.push(...podcastChannelNodes(options.podcast, base))

  // Escape hatch: appended unconditionally (no caps gating) — the caller opted in explicitly.
  if (options.customXml) channel.push(...options.customXml.map(specToNode))

  for (const item of items) channel.push(rssItem(item, caps, base))

  const hasContent = caps.rss20 && items.some((item) => item.content)
  // <dc:creator> is emitted for any item author with a name but no email (see rssItem).
  const hasDcCreator =
    caps.rss20 &&
    items.some((item) => {
      const author = firstAuthor(item.author)
      return !author?.email && !!author?.name
    })
  const podcastNs = caps.rss20
    ? podcastNamespacesUsed(options, items)
    : { itunes: false, podcast: false }
  const hasFh = caps.rss20 && options.paging !== undefined && pagingMarker(options.paging)
  const root = el(
    'rss',
    {
      version,
      'xmlns:atom': caps.rss20 ? 'http://www.w3.org/2005/Atom' : undefined,
      'xmlns:content': hasContent ? 'http://purl.org/rss/1.0/modules/content/' : undefined,
      'xmlns:dc': hasDcCreator ? 'http://purl.org/dc/elements/1.1/' : undefined,
      'xmlns:itunes': podcastNs.itunes ? ITUNES_NS : undefined,
      'xmlns:podcast': podcastNs.podcast ? PODCAST_NS : undefined,
      'xmlns:fh': hasFh ? 'http://purl.org/syndication/history/1.0' : undefined,
      ...options.customNamespaces,
    },
    [el('channel', undefined, channel)],
  )
  return xmlDocument(root, { pretty: opts.pretty, version: opts.xmlVersion })
}

// "email (name)" when name is present, otherwise the bare email — shared by managingEditor,
// webMaster, and item <author>, all of which require an email (checked by the caller) and
// treat the name as optional.
function emailLine(email: string, name: string | undefined): string {
  return name ? `${email} (${name})` : email
}

function rssItem(item: FeedItem, caps: Caps, base?: string): Node {
  const ch: Node[] = []
  ch.push(el('title', undefined, item.title))

  const link = absolutize(item.link, base)
  if (!link && caps.itemLinkRequired) {
    throw new TypeError('hono-feed: RSS 0.91 item requires "link"')
  }
  if (link) ch.push(el('link', undefined, link))

  if (caps.rss20) {
    const guid = item.id ?? link
    if (guid) {
      const isPermaLink = link !== undefined && guid === link && isUrl(guid)
      ch.push(el('guid', { isPermaLink: isPermaLink ? 'true' : 'false' }, guid))
    }
  }

  if (caps.itemPubDate && item.published) ch.push(el('pubDate', undefined, rfc822(item.published)))
  if (item.description) ch.push(el('description', undefined, raw(cdata(item.description))))
  if (caps.rss20 && item.content)
    ch.push(el('content:encoded', undefined, raw(cdata(item.content))))
  if (caps.itemRich092 && item.comments) {
    ch.push(el('comments', undefined, absolutize(item.comments, base)))
  }

  // RSS <author> requires an email; when it's absent, fall back to Dublin Core <dc:creator>
  // so a name-only author still appears (matching the RDF serializers and Atom/JSON output).
  if (caps.rss20) {
    const author = firstAuthor(item.author)
    if (author?.email) {
      ch.push(el('author', undefined, emailLine(author.email, author.name)))
    } else if (author?.name) {
      ch.push(el('dc:creator', undefined, author.name))
    }
  }

  if (caps.itemRich092 && item.categories) {
    for (const cat of item.categories) {
      ch.push(el('category', { domain: cat.scheme }, cat.term))
    }
  }

  // RSS supports at most one <enclosure> per item (Best Practices Profile); keep only the first.
  const enclosure = caps.itemRich092 ? firstEnclosure(item.enclosure) : undefined
  if (enclosure) {
    ch.push(
      el('enclosure', {
        url: absolutize(enclosure.url, base),
        type: enclosure.type,
        length: String(enclosure.length ?? 0),
      }),
    )
  }

  if (caps.rss20) ch.push(...podcastItemNodes(item.podcast, enclosure, base))

  if (item.customXml) ch.push(...item.customXml.map(specToNode))

  return el('item', undefined, ch)
}
