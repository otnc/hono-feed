export type FeedFormat = 'rss' | 'atom' | 'json'

/** Supported XML declaration versions (used by RSS and Atom output). */
export type XmlVersion = '1.0' | '1.1'

/**
 * Supported RSS versions.
 * - `'0.91'` / `'0.92'` / `'0.93'` / `'0.94'` / `'2.0'` — `<rss version="…">` structure
 * - `'0.90'` / `'1.0'` — RDF (`<rdf:RDF>`): Netscape 0.90 and RSS 1.0 (RDF Site Summary)
 * - `'1.1'` — RSS 1.1 (RDF, `<Channel>` in the `purl.org/net/rss1.1#` namespace)
 */
export type RssVersion = '2.0' | '0.94' | '0.93' | '0.92' | '0.91' | '1.1' | '1.0' | '0.90'

/** Supported Atom versions. `'0.3'` is the deprecated predecessor of Atom 1.0. */
export type AtomVersion = '1.0' | '0.3'

/** Supported JSON Feed versions (mapped to the canonical `version` URL). */
export type JsonFeedVersion = '1' | '1.1'

export interface Author {
  name: string
  email?: string
  url?: string
}

export interface Category {
  /** Display term. Atom `term` / RSS category body / JSON tag. */
  term: string
  /** Atom `scheme` / RSS `domain`. */
  scheme?: string
}

export interface Enclosure {
  url: string
  /** MIME type. */
  type: string
  /** Size in bytes (required by RSS; behaviour on omission is configurable). */
  length?: number
}

export interface FeedOptions {
  title: string
  /** Homepage URL (RSS link / Atom alternate / JSON home_page_url). */
  link?: string
  /** RSS description / Atom subtitle / JSON description. */
  description?: string
  /** Atom feed id. Falls back to `link`. */
  id?: string
  /** Self URL (atom:self / JSON feed_url). Falls back to the request URL. */
  feedUrl?: string
  language?: string
  /** RSS lastBuildDate / Atom updated. JSON derives it from items. */
  updated?: Date
  author?: Author
  copyright?: string
  /** RSS image.url / JSON icon. */
  image?: string
  /** JSON favicon. */
  favicon?: string
  /** Defaults to 'hono-feed'. */
  generator?: string
  /** RSS ttl in minutes. */
  ttl?: number
}

export interface FeedItem {
  title: string
  link?: string
  /** Unique id (Atom id / RSS guid / JSON id). Falls back to `link`. */
  id?: string
  /** Summary (RSS description / Atom summary / JSON summary). */
  description?: string
  /** Body HTML (RSS content:encoded / Atom content / JSON content_html). */
  content?: string
  author?: Author | Author[]
  /** RSS pubDate / Atom published / JSON date_published. */
  published?: Date
  /** Atom updated / JSON date_modified. */
  updated?: Date
  categories?: Category[]
  /** RSS enclosure / JSON attachments[0]. */
  enclosure?: Enclosure
  /** JSON image. */
  image?: string
}

export interface FeedInput {
  options: FeedOptions
  items: FeedItem[]
}

export interface SerializeOptions {
  pretty?: boolean
  baseUrl?: string
  feedUrl?: string
  /**
   * XML declaration version (RSS/Atom). Default '1.0'. `'1.1'` is rejected for Atom
   * (RFC 4287 §2 requires XML 1.0) and RSS 0.90 (its spec pins the exact declaration).
   */
  xmlVersion?: XmlVersion
  /** RSS version / structure. Default '2.0'. */
  rssVersion?: RssVersion
  /** Atom version. Default '1.0'. */
  atomVersion?: AtomVersion
  /** JSON Feed version. Default '1.1'. */
  jsonFeedVersion?: JsonFeedVersion
  /** Do not emit deprecation warnings for deprecated versions. Default false. */
  suppressDeprecationWarnings?: boolean
}

export interface ServeFeedOptions {
  /** Explicit format. When unset, negotiates query -> extension -> Accept -> default. */
  format?: FeedFormat
  /** Fallback when negotiation is inconclusive. Default 'rss'. */
  defaultFormat?: FeedFormat
  /** Detect format from the URL extension. Default true. */
  detectFromExtension?: boolean
  /** Detect format from `?format=`. Default false. */
  detectFromQuery?: boolean
  /** Cache-Control value, or false to omit. Default 'public, max-age=3600'. */
  cacheControl?: string | false
  /** Emit a weak ETag and answer conditional requests with 304. Default true. */
  etag?: boolean
  /** Emit Last-Modified (from feed.updated). Default true. */
  lastModified?: boolean
  /** Base URL for absolutizing relative URLs. Defaults to the request origin. */
  baseUrl?: string
  /** Pretty-print the output. Default false. */
  pretty?: boolean
  /**
   * XML declaration version (RSS/Atom). Default '1.0'. `'1.1'` is rejected for Atom
   * (RFC 4287 §2 requires XML 1.0) and RSS 0.90 (its spec pins the exact declaration).
   */
  xmlVersion?: XmlVersion
  /** RSS version / structure. Default '2.0'. */
  rssVersion?: RssVersion
  /** Atom version. Default '1.0'. */
  atomVersion?: AtomVersion
  /** JSON Feed version. Default '1.1'. */
  jsonFeedVersion?: JsonFeedVersion
  /** Do not emit deprecation warnings for deprecated versions. Default false. */
  suppressDeprecationWarnings?: boolean
}
