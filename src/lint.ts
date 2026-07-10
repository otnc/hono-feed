import type { FeedFormat, FeedInput, FeedItem, FeedOptions } from './types'
import { firstAuthor } from './utils/author'

/**
 * Report recommended-but-missing fields — the "valid, but…" tier that `validateInput` doesn't
 * cover. `validateInput` enforces hard spec requirements (missing → broken document); `lintInput`
 * surfaces what feed validators warn about and directories/readers penalize.
 *
 * Returns a list of human-readable warnings (empty = clean); it never throws and `serveFeed`
 * never calls it, so it can't slow the serve path. Meant for tests/CI —
 * `expect(lintInput(input, 'rss')).toEqual([])` — and for tightening a feed before shipping.
 */
export function lintInput(input: FeedInput, format: FeedFormat): string[] {
  const { options, items } = input
  const warnings: string[] = []

  lintFeed(options, format, warnings)
  items.forEach((item, i) => {
    lintItem(item, i, format, warnings)
  })

  return warnings
}

function lintFeed(options: FeedOptions, format: FeedFormat, warnings: string[]): void {
  if (!options.description) {
    warnings.push(
      format === 'rss'
        ? 'feed: no "description" — RSS requires <description>; an empty one is emitted'
        : 'feed: no "description" — readers show it as the feed subtitle/summary',
    )
  }
  if (!options.language) {
    warnings.push('feed: no "language" — readers and directories use it for filtering and display')
  }
  if (!options.image && !options.favicon) {
    warnings.push('feed: no "image" or "favicon" — directories and readers display placeholder art')
  }
  // Atom's <id> falls back to link, then to the request URL at serve time; the latter changes
  // with the host, so the feed's identity isn't stable across environments.
  if (format === 'atom' && !options.id && !options.link && !options.feedUrl) {
    warnings.push(
      'feed: no "id" (or "link"/"feedUrl") — Atom id falls back to the request URL, so the feed identity is unstable across hosts',
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
      warnings.push(
        `feed.podcast: no ${missing.map((f) => `"${f}"`).join('/')} — Apple Podcasts requires ${missing.join('/')} to list a show`,
      )
    }
  }
}

function lintItem(item: FeedItem, i: number, format: FeedFormat, warnings: string[]): void {
  if (!item.id) {
    warnings.push(
      `item[${i}]: no "id" — the ${format === 'atom' ? 'atom:id' : format === 'json' ? 'json id' : 'guid'} falls back to the link, which breaks readers if the URL changes`,
    )
  }
  if (!item.published && !item.updated) {
    warnings.push(
      `item[${i}]: no "published"/"updated" date — readers sort undated items unpredictably`,
    )
  }
  // A name-only author still surfaces (Atom/JSON author, RSS dc:creator); a missing one doesn't.
  if (!firstAuthor(item.author)) {
    warnings.push(`item[${i}]: no "author" — readers can't attribute the item`)
  }
}
