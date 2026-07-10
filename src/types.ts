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
  /** Author image URL. JSON Feed `avatar`; no RSS/Atom equivalent. */
  avatar?: string
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
  /** Duration in seconds. JSON Feed `duration_in_seconds`; no RSS/Atom enclosure equivalent. */
  duration?: number
}

/** `itunes:owner` — the podcast's admin contact, shown only to Apple Podcasts, never in the UI. */
export interface PodcastOwner {
  name: string
  email: string
}

/** `podcast:funding` (Podcasting 2.0) — a single funding/support link. */
export interface PodcastFunding {
  url: string
  /** Link text shown to listeners. */
  text?: string
}

/** `podcast:transcript` (Podcasting 2.0) — a transcript in a specific format. */
export interface PodcastTranscript {
  url: string
  /** MIME type, e.g. `'text/vtt'`, `'application/srt'`, `'text/html'`. */
  type: string
}

/** `podcast:chapters` (Podcasting 2.0) — a JSON Chapters file for the episode. */
export interface PodcastChapters {
  url: string
  /** Defaults to `'application/json+chapters'` when omitted, per the spec. */
  type?: string
}

/**
 * Podcast metadata for the feed as a whole (RSS 2.0 only — ignored by Atom, JSON Feed, and
 * every other RSS version). Covers the iTunes namespace and the Podcasting 2.0 namespace;
 * `xmlns:itunes` / `xmlns:podcast` are declared automatically, only when a field from that
 * namespace is actually set somewhere in the feed. An explicit `customNamespaces` entry for
 * either prefix always wins over the automatic one.
 */
export interface FeedPodcast {
  /** `itunes:author` — independent of the feed-level `author`, which iTunes doesn't read. */
  author?: string
  /** `itunes:category` — one `<itunes:category text="…"/>` per entry. */
  category?: string[]
  /** `itunes:explicit`. */
  explicit?: boolean
  /** `itunes:image` `href`. */
  image?: string
  /** `itunes:owner`. */
  owner?: PodcastOwner
  /** `itunes:type`. */
  type?: 'episodic' | 'serial'
  /** `podcast:guid` — a stable identifier for the podcast itself, distinct from any episode id. */
  guid?: string
  /** `podcast:locked` — `true` tells other hosting platforms not to import this feed. */
  locked?: boolean
  /** `podcast:funding` — one element per entry. */
  funding?: PodcastFunding[]
}

/** Podcast metadata for a single episode (RSS 2.0 only — see `FeedPodcast`). */
export interface ItemPodcast {
  /** `itunes:duration`, in seconds. Falls back to `enclosure.duration` when unset. */
  duration?: number
  /** `itunes:explicit`. */
  explicit?: boolean
  /** `itunes:episode`. */
  episode?: number
  /** `itunes:season`. */
  season?: number
  /** `itunes:episodeType`. */
  episodeType?: 'full' | 'trailer' | 'bonus'
  /** `itunes:image` `href`. */
  image?: string
  /** `podcast:transcript` — one element per entry. */
  transcript?: PodcastTranscript[]
  /** `podcast:chapters`. */
  chapters?: PodcastChapters
}

/**
 * A JSON-shaped XML element tree for the `customXml` escape hatch. Attribute values and
 * `text` are escaped exactly like built-in elements — this isn't raw string injection.
 * `name` and attribute keys are structural, not content, so they're validated against the XML
 * `Name` production instead (a `TypeError` on violation) rather than escaped.
 */
export interface XmlElementSpec {
  /** Element name, e.g. `'itunes:author'`. Must match the XML `Name` production. */
  name: string
  /** Keys must match the XML `Name` production. */
  attrs?: Record<string, string | number | boolean | undefined>
  /** Nested elements. When set, `text` is ignored. */
  children?: XmlElementSpec[]
  text?: string
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
  /** RSS channel `<pubDate>` (0.91+). No Atom/JSON feed-level equivalent (Atom has no feed-level published). */
  published?: Date
  /** RSS managingEditor (email required) / Atom author / JSON authors. */
  author?: Author
  /** Atom `<contributor>` (RFC 4287 §4.2.3). No RSS/JSON equivalent. */
  contributors?: Author[]
  copyright?: string
  /** RSS channel category / Atom feed category / RDF dc:subject. No JSON Feed equivalent. */
  categories?: Category[]
  /** RSS image.url / Atom logo / JSON icon. */
  image?: string
  /** Atom icon / JSON favicon. */
  favicon?: string
  /** Defaults to 'hono-feed'. */
  generator?: string
  /** RSS ttl in minutes. */
  ttl?: number
  /** WebSub hub URL(s): RSS/Atom `link rel="hub"`, JSON Feed `hubs`. */
  hub?: string | string[]
  /** JSON Feed `expired` — true tells readers the feed will never update again. */
  expired?: boolean
  /** JSON Feed `user_comment` — a human-readable note about the feed. No RSS/Atom equivalent. */
  userComment?: string
  /**
   * Pagination links for a paged feed (RFC 5005 §3 via `link rel`; JSON Feed `next_url`).
   * RSS/Atom emit one `link`/`atom:link` per set field; JSON Feed only maps `next`.
   */
  paging?: {
    /** `rel="next"` (RSS/Atom) / JSON `next_url`. */
    next?: string
    /** `rel="previous"` (RFC 5005's term, not "prev"). No JSON Feed equivalent. */
    prev?: string
    /** `rel="first"`. No JSON Feed equivalent. */
    first?: string
    /** `rel="last"`. No JSON Feed equivalent. */
    last?: string
    /**
     * RFC 5005 §2 — this document contains the *entire* feed (readers may drop entries no
     * longer present). Emits `<fh:complete/>` (RSS 2.0 / Atom 1.0 only). Mutually exclusive
     * with `archive`.
     */
    complete?: boolean
    /**
     * RFC 5005 §4 — this document is an archive page whose content never changes (pairs
     * naturally with `cacheControl: { immutable: true }`). Emits `<fh:archive/>` (RSS 2.0 /
     * Atom 1.0 only). Mutually exclusive with `complete`.
     */
    archive?: boolean
    /** `rel="current"` — used together with `archive` (RFC 5005 §4) to point at the always-up-to-date document. No JSON Feed equivalent. */
    current?: string
    /** `rel="prev-archive"` — the immediately preceding archive document (RFC 5005 §4). No JSON Feed equivalent. */
    prevArchive?: string
    /** `rel="next-archive"` — the immediately following archive document (RFC 5005 §4). No JSON Feed equivalent. */
    nextArchive?: string
  }
  /**
   * Extra elements appended after the built-in channel/feed elements (XML formats only) —
   * escape hatch for namespaced modules (iTunes, Media RSS, Dublin Core, …). RDF (RSS 1.0/1.1)
   * and legacy RSS 0.9x accept these unconditionally; there's no built-in gating to opt out of.
   */
  customXml?: XmlElementSpec[]
  /** Extra `xmlns:*` declarations for the root element, e.g. `{ 'xmlns:itunes': '...' }`. */
  customNamespaces?: Record<string, string>
  /**
   * Extra keys merged into the JSON Feed object. Per the JSON Feed spec, custom keys should
   * start with `_`. A built-in key always wins on collision — this can only add, not override.
   */
  customJson?: Record<string, unknown>
  /** Podcast metadata (iTunes + Podcasting 2.0 namespaces). RSS 2.0 only — see `FeedPodcast`. */
  podcast?: FeedPodcast
  /** RSS `webMaster` (email required, same rule as `author`/`managingEditor`). No Atom/JSON equivalent. Available since RSS 0.91. */
  webmaster?: Author
  /**
   * RSS `docs` — a URL pointing at the documentation for the RSS format itself (not your feed).
   * `true` emits the canonical RSS 2.0 spec URL; a string emits that URL as-is. No Atom/JSON
   * equivalent. Available since RSS 0.91.
   */
  docs?: boolean | string
  /** RSS `skipHours` — hours (0–23, GMT) when readers can skip polling. No Atom/JSON equivalent. Available since RSS 0.91. */
  skipHours?: number[]
  /** RSS `skipDays` — days when readers can skip polling. No Atom/JSON equivalent. Available since RSS 0.91. */
  skipDays?: Array<
    'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday'
  >
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
  /** Atom `<contributor>` (RFC 4287 §4.2.3). No RSS/JSON equivalent. */
  contributors?: Author[]
  /** RSS pubDate / Atom published / JSON date_published. */
  published?: Date
  /** Atom updated / JSON date_modified. */
  updated?: Date
  categories?: Category[]
  /** RSS enclosure (first only) / Atom link rel="enclosure" (first only) / JSON attachments. */
  enclosure?: Enclosure | Enclosure[]
  /** URL of the item's comments page. RSS `<comments>` only; no Atom/JSON mapping. */
  comments?: string
  /** JSON image. */
  image?: string
  /** JSON `external_url` — the linkblog pattern: `link` is your post, this is what it links to. */
  externalUrl?: string
  /** JSON `banner_image`. */
  bannerImage?: string
  /** Per-item language override. Atom `xml:lang` on `<entry>` (1.0 only) / JSON Feed 1.1 `language`. */
  language?: string
  /** Extra elements appended after the built-in item/entry elements (XML formats only). */
  customXml?: XmlElementSpec[]
  /** Extra keys merged into the JSON Feed item object. A built-in key always wins on collision. */
  customJson?: Record<string, unknown>
  /** Podcast metadata (iTunes + Podcasting 2.0 namespaces). RSS 2.0 only — see `ItemPodcast`. */
  podcast?: ItemPodcast
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
  /**
   * A validator resolvable *before* the feed input exists — a content revision, a
   * `max(updated_at)` scalar, … — checked against `If-None-Match` ahead of resolving `input`
   * or serializing anything, so a match answers 304 without either. Only `If-None-Match` is
   * checked this early (there's no `updated` date yet for `If-Modified-Since`); per RFC 9110
   * §13.1.3 a request carrying `If-None-Match` ignores `If-Modified-Since` anyway, so this
   * still covers the common revalidation case.
   *
   * May return synchronously or asynchronously; `serveFeed`'s return type follows suit
   * (`Response` normally, `Response | Promise<Response>` once `etagFrom` or a lazy `input`
   * function is used). On a miss, the resolved value is used as the response ETag (the
   * `etag` option is ignored) — same verbatim-vs-`W/"…"`-wrapping rule as a custom `etag`
   * function.
   */
  etagFrom?: () => string | Promise<string>
}
