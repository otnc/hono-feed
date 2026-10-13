import type { FeedInput, FeedItem, FeedOptions, SerializeOptions } from '../../types'
import { firstAuthor } from '../../utils/author'
import { rfc822 } from '../../utils/date'
import { firstEnclosure } from '../../utils/enclosure'
import { hubList } from '../../utils/hub'
import { pagingMarker, pagingRels } from '../../utils/paging'
import { absolutize, isUrl, selfUrl } from '../../utils/url'
import { cdata, el, type Node, raw, specToNode, tag, xmlDocument } from '../../utils/xml'
import { hasMedia, MEDIA_NS, mediaItemNodes } from '../media'
import {
  ITUNES_NS,
  PODCAST_NS,
  podcastChannelNodes,
  podcastItemNodes,
  podcastNamespacesUsed,
} from './podcast'

// `<rss version="…">` structure (Netscape/UserLand lineage: 0.91 / 0.92 / 0.93 / 0.94 / 2.0).

// Older versions define smaller element sets, so emission is gated per version: item category/enclosure arrived in 0.92, item pubDate in 0.93, and guid, item author, generator, ttl and namespaced extensions (atom:link, content:encoded) are 2.0-only.
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

  const channel = channelNodes(options, caps, base, link, self)
  for (const item of items) channel.push(rssItem(item, caps, base))

  const root = el(
    'rss',
    { version, ...rootNamespaces(options, items, caps), ...options.customNamespaces },
    [tag('channel', channel)],
  )
  return xmlDocument(root, { pretty: opts.pretty, version: opts.xmlVersion })
}

// Channel children before the items: metadata, then the `<image>`, podcast and custom elements.
function channelNodes(
  options: FeedOptions,
  caps: Caps,
  base: string | undefined,
  link: string,
  self: string | undefined,
): Node[] {
  const channel: Node[] = []
  channel.push(tag('title', options.title))
  channel.push(tag('link', link))
  channel.push(tag('description', options.description ?? ''))
  if (options.language) channel.push(tag('language', options.language))
  if (options.copyright) channel.push(tag('copyright', options.copyright))
  // Channel <category> is RSS 2.0-only; 0.92 only added the item-level element (see below).
  if (caps.rss20 && options.categories) {
    for (const cat of options.categories) {
      channel.push(el('category', { domain: cat.scheme }, cat.term))
    }
  }
  if (options.published) channel.push(tag('pubDate', rfc822(options.published)))
  if (options.updated) channel.push(tag('lastBuildDate', rfc822(options.updated)))
  // managingEditor/webMaster/docs/skipHours/skipDays are all part of the format since Netscape 0.91; ungated here like language/copyright above.
  const feedAuthor = firstAuthor(options.author)
  if (feedAuthor?.email) {
    channel.push(tag('managingEditor', emailLine(feedAuthor.email, feedAuthor.name)))
  }
  if (options.webmaster?.email) {
    channel.push(tag('webMaster', emailLine(options.webmaster.email, options.webmaster.name)))
  }
  if (options.docs) {
    channel.push(
      tag(
        'docs',
        options.docs === true ? 'https://www.rssboard.org/rss-specification' : options.docs,
      ),
    )
  }
  if (options.skipHours?.length) {
    channel.push(
      tag(
        'skipHours',
        options.skipHours.map((hour) => tag('hour', String(hour))),
      ),
    )
  }
  if (options.skipDays?.length) {
    channel.push(
      tag(
        'skipDays',
        options.skipDays.map((day) => tag('day', day)),
      ),
    )
  }
  if (caps.rss20) {
    channel.push(tag('generator', options.generator ?? 'hono-feed'))
    if (options.ttl !== undefined) channel.push(tag('ttl', String(options.ttl)))
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
    const img: Node[] = [tag('url', absolutize(options.image, base))]
    img.push(tag('title', options.title))
    // <image> requires url/title/link all three.
    img.push(tag('link', link))
    channel.push(tag('image', img))
  }

  // Podcast metadata (iTunes / Podcasting 2.0) is RSS 2.0-only, like the rest of caps.rss20.
  if (caps.rss20) channel.push(...podcastChannelNodes(options.podcast, base))

  // Escape hatch: appended unconditionally (no caps gating) — the caller opted in explicitly.
  if (options.customXml) channel.push(...options.customXml.map(specToNode))
  return channel
}

// `xmlns:*` declarations the document needs, each only when something in it uses the namespace.
function rootNamespaces(
  options: FeedOptions,
  items: FeedItem[],
  caps: Caps,
): Record<string, string | undefined> {
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
  return {
    'xmlns:atom': caps.rss20 ? 'http://www.w3.org/2005/Atom' : undefined,
    'xmlns:content': hasContent ? 'http://purl.org/rss/1.0/modules/content/' : undefined,
    'xmlns:dc': hasDcCreator ? 'http://purl.org/dc/elements/1.1/' : undefined,
    'xmlns:itunes': podcastNs.itunes ? ITUNES_NS : undefined,
    'xmlns:podcast': podcastNs.podcast ? PODCAST_NS : undefined,
    'xmlns:fh': hasFh ? 'http://purl.org/syndication/history/1.0' : undefined,
    'xmlns:media': caps.rss20 && items.some((item) => hasMedia(item.media)) ? MEDIA_NS : undefined,
  }
}

// "email (name)" when name is present, otherwise the bare email — shared by managingEditor, webMaster, and item <author>, all of which require an email (checked by the caller) and treat the name as optional.
function emailLine(email: string, name: string | undefined): string {
  return name ? `${email} (${name})` : email
}

function rssItem(item: FeedItem, caps: Caps, base?: string): Node {
  const ch: Node[] = []
  ch.push(tag('title', item.title))

  const link = absolutize(item.link, base)
  if (!link && caps.itemLinkRequired) {
    throw new TypeError('hono-feed: RSS 0.91 item requires "link"')
  }
  if (link) ch.push(tag('link', link))

  if (caps.rss20) {
    const guid = item.id ?? link
    if (guid) {
      const isPermaLink = link !== undefined && guid === link && isUrl(guid)
      ch.push(el('guid', { isPermaLink: isPermaLink ? 'true' : 'false' }, guid))
    }
  }

  if (caps.itemPubDate && item.published) ch.push(tag('pubDate', rfc822(item.published)))
  if (item.description) ch.push(tag('description', raw(cdata(item.description))))
  if (caps.rss20 && item.content) ch.push(tag('content:encoded', raw(cdata(item.content))))
  // <comments> was introduced in RSS 2.0 (not 0.92, unlike category/enclosure below).
  if (caps.rss20 && item.comments) {
    ch.push(tag('comments', absolutize(item.comments, base)))
  }

  // <source> is RSS 2.0-only; the spec requires its url attribute (validateInput checks both fields).
  if (caps.rss20 && item.source) {
    ch.push(el('source', { url: absolutize(item.source.url, base) }, item.source.title))
  }

  // RSS <author> requires an email; when it's absent, fall back to Dublin Core <dc:creator> so a name-only author still appears (matching the RDF serializers and Atom/JSON output).
  if (caps.rss20) {
    const author = firstAuthor(item.author)
    if (author?.email) {
      ch.push(tag('author', emailLine(author.email, author.name)))
    } else if (author?.name) {
      ch.push(tag('dc:creator', author.name))
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
  if (caps.rss20) ch.push(...mediaItemNodes(item.media, base))

  if (item.customXml) ch.push(...item.customXml.map(specToNode))

  return tag('item', ch)
}
