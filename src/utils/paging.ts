import type { FeedOptions } from '../types'
import { absolutize } from './url'

type Paging = NonNullable<FeedOptions['paging']>

// RFC 5005 §3 spells the "previous" rel out in full (not "prev"); order matches a natural
// reading order (next, previous, first, last) rather than object key order.
const RELS: Array<[keyof Paging, string]> = [
  ['next', 'next'],
  ['prev', 'previous'],
  ['first', 'first'],
  ['last', 'last'],
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
