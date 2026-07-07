import type { FeedInput, FeedItem, SerializeOptions } from '../../types'
import { firstAuthor } from '../../utils/author'
import { rfc822 } from '../../utils/date'
import { pagingRels } from '../../utils/paging'
import { absolutize, isUrl, selfUrl } from '../../utils/url'
import { cdata, el, type Node, raw, specToNode, xmlDocument } from '../../utils/xml'

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
  if (options.updated) channel.push(el('lastBuildDate', undefined, rfc822(options.updated)))
  if (caps.rss20) {
    channel.push(el('generator', undefined, options.generator ?? 'hono-feed'))
    if (options.ttl !== undefined) channel.push(el('ttl', undefined, String(options.ttl)))
    if (self) {
      channel.push(el('atom:link', { href: self, rel: 'self', type: 'application/rss+xml' }))
    }
    if (options.paging) {
      for (const { rel, href } of pagingRels(options.paging, base)) {
        channel.push(el('atom:link', { href, rel }))
      }
    }
    // <managingEditor> requires an email, same rule as the item-level <author> (below).
    const feedAuthor = firstAuthor(options.author)
    if (feedAuthor?.email) {
      channel.push(
        el(
          'managingEditor',
          undefined,
          feedAuthor.name ? `${feedAuthor.email} (${feedAuthor.name})` : feedAuthor.email,
        ),
      )
    }
  }

  if (options.image) {
    const img: Node[] = [el('url', undefined, absolutize(options.image, base))]
    img.push(el('title', undefined, options.title))
    // <image> requires url/title/link all three.
    img.push(el('link', undefined, link))
    channel.push(el('image', undefined, img))
  }

  // Escape hatch: appended unconditionally (no caps gating) — the caller opted in explicitly.
  if (options.customXml) channel.push(...options.customXml.map(specToNode))

  for (const item of items) channel.push(rssItem(item, caps, base))

  const hasContent = caps.rss20 && items.some((item) => item.content != null)
  const root = el(
    'rss',
    {
      version,
      'xmlns:atom': caps.rss20 ? 'http://www.w3.org/2005/Atom' : undefined,
      'xmlns:content': hasContent ? 'http://purl.org/rss/1.0/modules/content/' : undefined,
      ...options.customNamespaces,
    },
    [el('channel', undefined, channel)],
  )
  return xmlDocument(root, { pretty: opts.pretty, version: opts.xmlVersion })
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

  // RSS author requires an email; skip when absent.
  if (caps.rss20) {
    const author = firstAuthor(item.author)
    if (author?.email) {
      ch.push(
        el('author', undefined, author.name ? `${author.email} (${author.name})` : author.email),
      )
    }
  }

  if (caps.itemRich092 && item.categories) {
    for (const cat of item.categories) {
      ch.push(el('category', { domain: cat.scheme }, cat.term))
    }
  }

  if (caps.itemRich092 && item.enclosure) {
    ch.push(
      el('enclosure', {
        url: absolutize(item.enclosure.url, base),
        type: item.enclosure.type,
        length: String(item.enclosure.length ?? 0),
      }),
    )
  }

  if (item.customXml) ch.push(...item.customXml.map(specToNode))

  return el('item', undefined, ch)
}
