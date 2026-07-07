import type { FeedOptions } from '../types'
import { absolutize } from './url'

type Paging = NonNullable<FeedOptions['paging']>
type LinkKey = 'next' | 'prev' | 'first' | 'last' | 'current'

// RFC 5005 §3 spells the "previous" rel out in full (not "prev"); order matches a natural
// reading order (next, previous, first, last, current) rather than object key order.
const RELS: Array<[LinkKey, string]> = [
  ['next', 'next'],
  ['prev', 'previous'],
  ['first', 'first'],
  ['last', 'last'],
  ['current', 'current'],
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
