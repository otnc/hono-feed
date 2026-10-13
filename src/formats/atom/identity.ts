import type { FeedOptions, SerializeOptions } from '../../types'
import { absolutize, hasIriScheme, selfUrl } from '../../utils/url'

/**
 * Resolve the feed-level identity trio shared by Atom 0.3 and 1.0: the self URL, the alternate link, and the mandatory feed id (explicit id, else link, else self).
 */
/**
 * Return `id` after checking it exists and is an absolute IRI, naming `label` (e.g. "Atom entry") in errors.
 * RFC 4287 §4.2.6: atom:id MUST be an absolute IRI. An explicit id is checked by validateInput; a link/self fallback isn't, so a relative link with no baseUrl could otherwise reach the document unchecked.
 */
export function requireAtomId(id: string | undefined, label: string): string {
  if (!id) throw new TypeError(`hono-feed: ${label} requires an id`)
  if (!hasIriScheme(id)) {
    throw new TypeError(
      `hono-feed: ${label} id must be an absolute IRI (RFC 4287 §4.2.6) — set "baseUrl" or an absolute "id"/"link"`,
    )
  }
  return id
}

export function atomFeedIdentity(
  options: FeedOptions,
  opts: SerializeOptions,
  label: string,
): { self: string | undefined; link: string | undefined; feedId: string } {
  const self = selfUrl(opts, options)
  const link = absolutize(options.link, opts.baseUrl)
  const feedId = requireAtomId(options.id ?? link ?? self, label)
  return { self, link, feedId }
}
