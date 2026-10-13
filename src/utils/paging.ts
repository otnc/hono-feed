import type { FeedOptions } from '../types'
import { absolutize } from './url'

type Paging = NonNullable<FeedOptions['paging']>
type LinkKey = 'next' | 'prev' | 'first' | 'last' | 'current' | 'prevArchive' | 'nextArchive'

// RFC 5005 §3 spells the "previous" rel out in full (not "prev"), while §4's archive rels really are hyphenated "prev-archive"/"next-archive" — not expansions of "prev". Order matches a natural reading order rather than object key order.
const RELS: Array<[LinkKey, string]> = [
  ['next', 'next'],
  ['prev', 'previous'],
  ['first', 'first'],
  ['last', 'last'],
  ['current', 'current'],
  ['prevArchive', 'prev-archive'],
  ['nextArchive', 'next-archive'],
]

/** Resolve `FeedOptions.paging` into `{ rel, href }` pairs, absolutized, skipping unset fields. */
export function pagingRels(
  paging: Paging,
  base: string | undefined,
): { rel: string; href: string }[] {
  const out: { rel: string; href: string }[] = []
  for (const [key, rel] of RELS) {
    const url = paging[key]
    if (url) out.push({ rel, href: absolutize(url, base) as string })
  }
  return out
}

/** RFC 5005's history-namespace marker for `paging`, or `undefined` when neither is set. */
export function pagingMarker(paging: Paging): 'complete' | 'archive' | undefined {
  if (paging.complete) return 'complete'
  if (paging.archive) return 'archive'
  return undefined
}

export interface PaginateOptions {
  /** Current page, 1-based. A string (e.g. `c.req.query('page')`) is parsed; anything unparsable means page 1, and a page past the end is clamped to the last. */
  page?: number | string | null
  /** Items per page. Must be a positive integer. */
  perPage: number
  /** URL of a given 1-based page, e.g. `(page) => '/feed?page=' + page`. Relative URLs are absolutized against `baseUrl` when serving. */
  url: (page: number) => string
}

export interface Paginated<T> {
  /** The items on the current page. */
  items: T[]
  /** Ready for `FeedOptions.paging`: `next`/`prev`, plus `first`/`last` whenever there is more than one page. */
  paging: Paging
  /** The current page after parsing and clamping. */
  page: number
  totalPages: number
}

/**
 * Slice `all` into the current page and build the RFC 5005 §3 paging links for it, so a paged feed doesn't need the links assembled by hand. `all` keeps its order, so sort it newest first beforehand.
 *
 * Throws `RangeError` when `perPage` is not a positive integer.
 *
 * @example
 * ```ts
 * const { items, paging } = paginate(posts, {
 *   page: c.req.query('page'),
 *   perPage: 20,
 *   url: (page) => `/feed?page=${page}`,
 * })
 * return serveFeed(c, { options: { title: 'Blog', link: '/', paging }, items: items.map(toFeedItem) })
 * ```
 */
export function paginate<T>(all: readonly T[], options: PaginateOptions): Paginated<T> {
  const { perPage, url } = options
  if (!Number.isInteger(perPage) || perPage < 1) {
    throw new RangeError('hono-feed: paginate "perPage" must be a positive integer')
  }

  const totalPages = Math.max(1, Math.ceil(all.length / perPage))
  const requested = Number.parseInt(String(options.page ?? 1), 10)
  const page = Math.min(totalPages, Math.max(1, Number.isNaN(requested) ? 1 : requested))

  const paging: Paging = {}
  if (page < totalPages) paging.next = url(page + 1)
  if (page > 1) paging.prev = url(page - 1)
  if (totalPages > 1) {
    paging.first = url(1)
    paging.last = url(totalPages)
  }

  const start = (page - 1) * perPage
  return { items: all.slice(start, start + perPage), paging, page, totalPages }
}
