import type { FeedInput, FeedItem, SerializeOptions } from '../../types'
import { rfc822 } from '../../utils/date'
import { absolutize, isUrl } from '../../utils/url'
import { cdata, el, type Node, raw, xmlDocument } from '../../utils/xml'

// `<rss version="…">` structure (Netscape/UserLand lineage: 0.91 / 0.92 / 0.93 / 0.94 / 2.0).
export function toRSS2(input: FeedInput, opts: SerializeOptions): string {
  const { options, items } = input
  const base = opts.baseUrl

  const channel: Node[] = []
  channel.push(el('title', undefined, options.title))
  const link = absolutize(options.link, base)
  if (link) channel.push(el('link', undefined, link))
  channel.push(el('description', undefined, options.description ?? ''))
  if (options.language) channel.push(el('language', undefined, options.language))
  if (options.copyright) channel.push(el('copyright', undefined, options.copyright))
  if (options.updated) channel.push(el('lastBuildDate', undefined, rfc822(options.updated)))
  channel.push(el('generator', undefined, options.generator ?? 'hono-feed'))
  if (options.ttl !== undefined) channel.push(el('ttl', undefined, String(options.ttl)))

  const self = opts.feedUrl ?? absolutize(options.feedUrl, base)
  if (self) channel.push(el('atom:link', { href: self, rel: 'self', type: 'application/rss+xml' }))

  if (options.image) {
    const img: Node[] = [el('url', undefined, absolutize(options.image, base) ?? options.image)]
    img.push(el('title', undefined, options.title))
    if (link) img.push(el('link', undefined, link))
    channel.push(el('image', undefined, img))
  }

  for (const item of items) channel.push(rssItem(item, base))

  const root = el(
    'rss',
    {
      version: opts.rssVersion ?? '2.0',
      'xmlns:atom': 'http://www.w3.org/2005/Atom',
      'xmlns:content': 'http://purl.org/rss/1.0/modules/content/',
    },
    [el('channel', undefined, channel)],
  )
  return xmlDocument(root, { pretty: opts.pretty, version: opts.xmlVersion })
}

function rssItem(item: FeedItem, base?: string): Node {
  const ch: Node[] = []
  ch.push(el('title', undefined, item.title))

  const link = absolutize(item.link, base)
  if (link) ch.push(el('link', undefined, link))

  const guid = item.id ?? link
  if (guid) {
    const isPermaLink = link !== undefined && guid === link && isUrl(guid)
    ch.push(el('guid', { isPermaLink: isPermaLink ? 'true' : 'false' }, guid))
  }

  if (item.published) ch.push(el('pubDate', undefined, rfc822(item.published)))
  if (item.description) ch.push(el('description', undefined, raw(cdata(item.description))))
  if (item.content) ch.push(el('content:encoded', undefined, raw(cdata(item.content))))

  // RSS author requires an email; skip when absent.
  const author = Array.isArray(item.author) ? item.author[0] : item.author
  if (author?.email) {
    ch.push(
      el('author', undefined, author.name ? `${author.email} (${author.name})` : author.email),
    )
  }

  if (item.categories) {
    for (const cat of item.categories) {
      ch.push(el('category', cat.scheme ? { domain: cat.scheme } : undefined, cat.term))
    }
  }

  if (item.enclosure) {
    ch.push(
      el('enclosure', {
        url: absolutize(item.enclosure.url, base) ?? item.enclosure.url,
        type: item.enclosure.type,
        length: String(item.enclosure.length ?? 0),
      }),
    )
  }

  return el('item', undefined, ch)
}
