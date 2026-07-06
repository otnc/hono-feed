// Each `*_VERSIONS`/`FEED_FORMATS` array is the single source of truth for its type: the
// type is derived from the array below it, so runtime validation (see negotiate.ts) can
// import the array instead of re-listing the literals and risking drift.

export const FEED_FORMATS = ['rss', 'atom', 'json'] as const
export type FeedFormat = (typeof FEED_FORMATS)[number]

/** Supported XML declaration versions (used by RSS and Atom output). */
export type XmlVersion = '1.0' | '1.1'

/**
 * Supported RSS versions.
 * - `'0.91'` / `'0.92'` / `'0.93'` / `'0.94'` / `'2.0'` — `<rss version="…">` structure
 * - `'0.90'` / `'1.0'` — RDF (`<rdf:RDF>`): Netscape 0.90 and RSS 1.0 (RDF Site Summary)
 * - `'1.1'` — RSS 1.1 (RDF, `<Channel>` in the `purl.org/net/rss1.1#` namespace)
 */
export const RSS_VERSIONS = ['2.0', '0.94', '0.93', '0.92', '0.91', '1.1', '1.0', '0.90'] as const
export type RssVersion = (typeof RSS_VERSIONS)[number]

/** Supported Atom versions. `'0.3'` is the deprecated predecessor of Atom 1.0. */
export const ATOM_VERSIONS = ['1.0', '0.3'] as const
export type AtomVersion = (typeof ATOM_VERSIONS)[number]

/** Supported JSON Feed versions (mapped to the canonical `version` URL). */
export const JSON_FEED_VERSIONS = ['1', '1.1'] as const
export type JsonFeedVersion = (typeof JSON_FEED_VERSIONS)[number]

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
  /** Size in bytes. RSS requires the attribute; emitted as 0 when unset, per the RSS Best Practices Profile. */
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
  /** RSS enclosure / Atom link rel="enclosure" / JSON attachments[0]. */
  enclosure?: Enclosure
  /** JSON image. */
  image?: string
}

export interface FeedInput {
  options: FeedOptions
  items: FeedItem[]
}

/** A structured alternative to hand-writing a `Cache-Control` value. */
export interface CacheControlDirectives {
  /** `public` — cacheable by shared caches even if the response would normally be private. */
  public?: boolean
  /** `private` — cacheable only by the end user's own cache. */
  private?: boolean
  /** `no-store` — must not be stored in any cache. */
  noStore?: boolean
  /** `no-cache` — may be stored, but must be revalidated before each reuse. */
  noCache?: boolean
  /** `max-age=<n>`, in seconds. */
  maxAge?: number
  /** `s-maxage=<n>`, in seconds (shared caches only; overrides `maxAge` for them). */
  sMaxAge?: number
  /** `must-revalidate` — forbid serving stale once past `max-age`. */
  mustRevalidate?: boolean
  /** `proxy-revalidate` — the shared-cache equivalent of `mustRevalidate`. */
  proxyRevalidate?: boolean
  /** `immutable` — the response body won't change while still fresh. */
  immutable?: boolean
  /** `stale-while-revalidate=<n>`, in seconds. */
  staleWhileRevalidate?: number
  /** `stale-if-error=<n>`, in seconds. */
  staleIfError?: number
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
  /**
   * Convenience switch for both `detectFormatFromQuery` and `detectVersionFromQuery`.
   * Default false.
   */
  detectFromQuery?: boolean
  /** Detect format from `?format=`. Defaults to `detectFromQuery`. */
  detectFormatFromQuery?: boolean
  /** Detect version (e.g. `rssVersion`) from `?version=`. Defaults to `detectFromQuery`. */
  detectVersionFromQuery?: boolean
  /** Query param name used to detect the format. Default 'format'. */
  formatQueryParam?: string
  /** Query param name used to detect the version. Default 'version'. */
  versionQueryParam?: string
  /**
   * When the Accept header explicitly rejects every supported format (every candidate at
   * `q=0`), answer 406 Not Acceptable instead of falling back to `defaultFormat`. An absent
   * Accept header, or one that simply doesn't match any format, still falls through to
   * `defaultFormat` regardless of this option. Default false.
   */
  strictAccept?: boolean
  /**
   * Cache-Control value — a raw string, a `CacheControlDirectives` object, or `false` to
   * omit. Default 'public, max-age=3600'.
   */
  cacheControl?: string | CacheControlDirectives | false
  /**
   * Emit an ETag and answer conditional requests with 304.
   * - `true` (default): a weak FNV-1a-64 hash of the body.
   * - a function: return your own tag for the body (e.g. from a revision you already track).
   *   Used verbatim if it looks like an ETag (`"…"` / `W/"…"`), otherwise wrapped as `W/"…"`.
   * - `false`: no ETag.
   */
  etag?: boolean | ((body: string) => string)
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
