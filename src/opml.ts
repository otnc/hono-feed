import type { Context } from 'hono'
import type { ServeFeedOptions, XmlVersion } from './types'
import { rfc822 } from './utils/date'
import { OPML_MIME_TYPE } from './utils/mime'
import { DEFAULT_CACHE_CONTROL, respond } from './utils/respond'
import { absolutize } from './utils/url'
import { el, type Node, tag, xmlDocument } from './utils/xml'

/** One `<outline>` of an OPML document: a feed subscription, or a folder holding more outlines. */
export interface OpmlOutline {
  /** Display text. Required by OPML 2.0. */
  text: string
  /** Defaults to `'rss'` when `xmlUrl` is set; use `'atom'` or `'json'` for other formats. */
  type?: string
  /** URL of the feed itself. */
  xmlUrl?: string
  /** URL of the site the feed belongs to. */
  htmlUrl?: string
  title?: string
  description?: string
  language?: string
  /** Slash-delimited category path, e.g. `'/News/Tech'`. */
  category?: string
  /** Nested outlines, which makes this one a folder. */
  children?: OpmlOutline[]
}

export interface OpmlInput {
  title?: string
  dateCreated?: Date
  dateModified?: Date
  ownerName?: string
  ownerEmail?: string
  /** URL identifying the owner, e.g. a profile page. */
  ownerId?: string
  /** Top-level outlines; at least one is expected, but an empty list is valid. */
  outlines: OpmlOutline[]
}

export interface OpmlOptions {
  pretty?: boolean
  /** Base URL for absolutizing relative `xmlUrl` / `htmlUrl` / `ownerId`. */
  baseUrl?: string
  /** XML declaration version. Default '1.0'. */
  xmlVersion?: XmlVersion
}

function assertOutlines(outlines: OpmlOutline[], path: string): void {
  outlines.forEach((outline, i) => {
    const where = `${path}[${i}]`
    if (typeof outline.text !== 'string' || outline.text.length === 0) {
      throw new TypeError(`hono-feed: OPML ${where} "text" is required`)
    }
    if (outline.children) assertOutlines(outline.children, `${where}.children`)
  })
}

function outlineNode(outline: OpmlOutline, base: string | undefined): Node {
  const attrs = {
    text: outline.text,
    type: outline.type ?? (outline.xmlUrl ? 'rss' : undefined),
    xmlUrl: absolutize(outline.xmlUrl, base),
    htmlUrl: absolutize(outline.htmlUrl, base),
    title: outline.title,
    description: outline.description,
    language: outline.language,
    category: outline.category,
  }
  return el(
    'outline',
    attrs,
    outline.children?.map((child) => outlineNode(child, base)),
  )
}

/**
 * Serialize a list of feed subscriptions as an [OPML 2.0](http://opml.org/spec2.opml) document, the format feed readers use to import and export subscriptions.
 *
 * Throws `TypeError` when an outline has no `text`.
 *
 * @example
 * ```ts
 * const opml = toOPML({
 *   title: 'My subscriptions',
 *   outlines: [
 *     { text: 'Example Blog', xmlUrl: 'https://example.com/feed.xml', htmlUrl: 'https://example.com/' },
 *     { text: 'Tech', children: [{ text: 'Another', type: 'atom', xmlUrl: 'https://a.example/atom' }] },
 *   ],
 * })
 * ```
 */
export function toOPML(input: OpmlInput, options: OpmlOptions = {}): string {
  assertOutlines(input.outlines, 'outlines')
  const base = options.baseUrl

  const head: Node[] = []
  if (input.title) head.push(tag('title', input.title))
  if (input.dateCreated) head.push(tag('dateCreated', rfc822(input.dateCreated)))
  if (input.dateModified) head.push(tag('dateModified', rfc822(input.dateModified)))
  if (input.ownerName) head.push(tag('ownerName', input.ownerName))
  if (input.ownerEmail) head.push(tag('ownerEmail', input.ownerEmail))
  if (input.ownerId) head.push(tag('ownerId', absolutize(input.ownerId, base)))

  const root = el('opml', { version: '2.0' }, [
    tag('head', head),
    tag(
      'body',
      input.outlines.map((outline) => outlineNode(outline, base)),
    ),
  ])
  return xmlDocument(root, { pretty: options.pretty, version: options.xmlVersion })
}

export type ServeOpmlOptions = OpmlOptions &
  Pick<ServeFeedOptions, 'cacheControl' | 'etag' | 'lastModified'>

/**
 * Turn an `OpmlInput` into a `Response` with the same caching behavior as `serveFeed`: `Cache-Control`, a weak `ETag`, `Last-Modified` from `dateModified`, `304` for conditional requests and an empty body for `HEAD`.
 *
 * `baseUrl` defaults to the request origin, so relative URLs in the outlines are made absolute.
 *
 * @example
 * ```ts
 * app.get('/subscriptions.opml', (c) => serveOpml(c, { title: 'My subscriptions', outlines }))
 * ```
 */
export function serveOpml(c: Context, input: OpmlInput, options: ServeOpmlOptions = {}): Response {
  const {
    cacheControl = DEFAULT_CACHE_CONTROL,
    etag = true,
    lastModified = true,
    baseUrl = new URL(c.req.url).origin,
    ...serializeOptions
  } = options
  const body = toOPML(input, { ...serializeOptions, baseUrl })
  return respond(c, body, {
    contentType: `${OPML_MIME_TYPE}; charset=utf-8`,
    cacheControl,
    etag,
    updated: lastModified ? input.dateModified : undefined,
  })
}
