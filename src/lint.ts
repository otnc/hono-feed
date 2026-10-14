import type { FeedFormat, FeedInput, FeedItem, FeedOptions } from './types'
import { firstAuthor } from './utils/author'
import { enclosureList } from './utils/enclosure'

/** Stable identifier of a lint rule, for `LintOptions.ignore`. */
export type LintRuleId =
  | 'feed-description'
  | 'feed-language'
  | 'feed-image'
  | 'atom-feed-id'
  | 'atom-feed-link'
  | 'paging-archive-current'
  | 'podcast-incomplete'
  | 'item-id'
  | 'item-date'
  | 'item-author'
  | 'duplicate-id'
  | 'future-date'
  | 'relative-url'
  | 'enclosure'
  | 'title'
  | 'item-count'

export interface LintOptions {
  /** Rules to skip, by id. */
  ignore?: LintRuleId[]
  /** The "current time" for the `future-date` rule. Defaults to `new Date()`; set it for deterministic tests. */
  now?: Date
}

type Report = (rule: LintRuleId, message: string) => void

// Dates a little ahead of the clock are normal (timezone rounding, clock skew); anything beyond a day is almost always a timezone mix-up.
const FUTURE_TOLERANCE_MS = 24 * 60 * 60 * 1000
const LONG_TITLE_LENGTH = 150
const PAGING_SUGGESTION_ITEM_COUNT = 100

/**
 * Report recommended-but-missing fields — the "valid, but…" tier that `validateInput` doesn't cover. `validateInput` enforces hard spec requirements (missing → broken document); `lintInput` surfaces what feed validators warn about and directories/readers penalize.

 * Returns a list of human-readable warnings (empty = clean); it never throws and `serveFeed` never calls it, so it can't slow the serve path. Meant for tests/CI — `expect(lintInput(input, 'rss')).toEqual([])` — and for tightening a feed before shipping. Pass `{ ignore: [...] }` to silence individual rules by id.
 */
export function lintInput(
  input: FeedInput,
  format: FeedFormat,
  lintOptions: LintOptions = {},
): string[] {
  const { options, items } = input
  const warnings: string[] = []
  const ignored = new Set(lintOptions.ignore)
  const report: Report = (rule, message) => {
    if (!ignored.has(rule)) warnings.push(message)
  }

  lintFeed(options, items.length, format, report)
  items.forEach((item, i) => {
    lintItem(item, i, format, lintOptions.now ?? new Date(), report)
  })
  lintDuplicateIds(items, report)

  return warnings
}

function lintFeed(options: FeedOptions, itemCount: number, format: FeedFormat, warn: Report): void {
  if (!options.description) {
    warn(
      'feed-description',
      format === 'rss'
        ? 'feed: no "description" — RSS requires <description>; an empty one is emitted'
        : 'feed: no "description" — readers show it as the feed subtitle/summary',
    )
  }
  if (!options.language) {
    warn(
      'feed-language',
      'feed: no "language" — readers and directories use it for filtering and display',
    )
  }
  if (!options.image && !options.favicon) {
    warn(
      'feed-image',
      'feed: no "image" or "favicon" — directories and readers display placeholder art',
    )
  }
  // Atom's <id> falls back to link, then to the request URL at serve time; the latter changes with the host, so the feed's identity isn't stable across environments.
  if (format === 'atom' && !options.id && !options.link && !options.feedUrl) {
    warn(
      'atom-feed-id',
      'feed: no "id" (or "link"/"feedUrl") — Atom id falls back to the request URL, so the feed identity is unstable across hosts',
    )
  }
  // RFC 4287 §4.1.1: an Atom feed SHOULD carry a rel="alternate" link to a human-readable page.
  if (format === 'atom' && !options.link) {
    warn(
      'atom-feed-link',
      'feed: no "link" — Atom SHOULD have a rel="alternate" link to a human-readable page (RFC 4287 §4.1.1)',
    )
  }

  // RFC 5005 §4: an archive page SHOULD carry rel="current" back to the always-up-to-date document. Only RSS/Atom emit fh:archive/rel="current" at all — JSON Feed has no mapping.
  if (format !== 'json' && options.paging?.archive && !options.paging?.current) {
    warn(
      'paging-archive-current',
      'feed.paging: "archive" is set without "current" — RFC 5005 §4 recommends pointing archive pages at the current document',
    )
  }

  // Apple Podcasts won't list a show missing these; only worth flagging once podcast is opted in.
  if (format === 'rss' && options.podcast) {
    const p = options.podcast
    const missing: string[] = []
    if (!p.image) missing.push('image')
    if (!p.category?.length) missing.push('category')
    if (p.explicit === undefined) missing.push('explicit')
    if (missing.length) {
      warn(
        'podcast-incomplete',
        `feed.podcast: no ${missing.map((f) => `"${f}"`).join('/')} — Apple Podcasts requires ${missing.join('/')} to list a show`,
      )
    }
  }
  if (itemCount > PAGING_SUGGESTION_ITEM_COUNT && !options.paging) {
    warn(
      'item-count',
      `feed: ${itemCount} items in one document — consider "paging" (see paginate()) so readers don't download the whole archive on every poll`,
    )
  }
}

function lintItem(item: FeedItem, i: number, format: FeedFormat, now: Date, warn: Report): void {
  if (!item.id) {
    warn(
      'item-id',
      `item[${i}]: no "id" — the ${format === 'atom' ? 'atom:id' : format === 'json' ? 'json id' : 'guid'} falls back to the link, which breaks readers if the URL changes`,
    )
  }
  if (!item.published && !item.updated) {
    warn(
      'item-date',
      `item[${i}]: no "published"/"updated" date — readers sort undated items unpredictably`,
    )
  }
  // A name-only author still surfaces (Atom/JSON author, RSS dc:creator); a missing one doesn't.
  if (!firstAuthor(item.author)) {
    warn('item-author', `item[${i}]: no "author" — readers can't attribute the item`)
  }

  for (const field of ['published', 'updated'] as const) {
    const date = item[field]
    if (date && date.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) {
      warn(
        'future-date',
        `item[${i}]: "${field}" is in the future (${date.toISOString()}) — usually a timezone mix-up`,
      )
    }
  }

  for (const field of ['content', 'description'] as const) {
    const relative = relativeUrlsIn(item[field])
    if (relative.length) {
      warn(
        'relative-url',
        `item[${i}]: "${field}" has ${relative.length} relative URL(s), e.g. "${relative[0]}" — feed readers can't resolve them against your site; use absolute URLs`,
      )
    }
  }

  for (const enclosure of enclosureList(item.enclosure)) {
    if (!enclosure.type) {
      warn('enclosure', `item[${i}]: enclosure "${enclosure.url}" has no "type" (MIME type)`)
    }
    if (!enclosure.length) {
      warn(
        'enclosure',
        `item[${i}]: enclosure "${enclosure.url}" has no "length" — it is emitted as 0, and some podcast clients and validators reject that`,
      )
    }
  }

  if (item.title.length > LONG_TITLE_LENGTH) {
    warn(
      'title',
      `item[${i}]: "title" is ${item.title.length} characters — readers truncate long titles`,
    )
  }
  if (/<\/?[a-z][^>]*>/i.test(item.title)) {
    warn(
      'title',
      `item[${i}]: "title" contains HTML markup — titles are plain text and the tags would be escaped`,
    )
  }
}

function lintDuplicateIds(items: FeedItem[], warn: Report): void {
  const seen = new Map<string, number>()
  items.forEach((item, i) => {
    const key = item.id ?? item.link
    if (!key) return
    const first = seen.get(key)
    if (first === undefined) seen.set(key, i)
    else
      warn(
        'duplicate-id',
        `item[${i}]: same id/link as item[${first}] ("${key}") — readers will merge or drop one of them`,
      )
  })
}

// Attribute values that are neither absolute (`scheme:`), protocol-relative, nor a fragment.
const URL_ATTRIBUTE = /\b(?:src|href|poster)\s*=\s*(["'])(.*?)\1/gi
const NOT_RELATIVE = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i

function relativeUrlsIn(html: string | undefined): string[] {
  if (!html) return []
  const found: string[] = []
  for (const match of html.matchAll(URL_ATTRIBUTE)) {
    const url = match[2].trim()
    if (url && !NOT_RELATIVE.test(url)) found.push(url)
  }
  return found
}
