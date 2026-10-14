import type { FeedLink } from '../types'
import { absolutize } from './url'
import { el, type Node } from './xml'

// Relations hono-feed already emits from a dedicated field; accepting them here too would produce duplicate links.
export const RESERVED_LINK_RELS: ReadonlySet<string> = new Set([
  'self',
  'hub',
  'enclosure',
  'replies',
  'first',
  'last',
  'next',
  'prev',
  'previous',
  'current',
  'prev-archive',
  'next-archive',
])

/** One link element per entry, absolutized: `<link>` for Atom, `<atom:link>` for RSS 2.0. */
export function extraLinkNodes(
  links: FeedLink[] | undefined,
  elementName: 'link' | 'atom:link',
  base: string | undefined,
): Node[] {
  return (links ?? []).map((link) =>
    el(elementName, {
      rel: link.rel,
      href: absolutize(link.href, base),
      type: link.type,
      hreflang: link.hreflang,
      title: link.title,
      length: link.length,
    }),
  )
}
