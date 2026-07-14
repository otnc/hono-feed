import type { FeedOptions, SerializeOptions } from '../../types'
import { absolutize, hasIriScheme, selfUrl } from '../../utils/url'

/**
 * Resolve the feed-level identity trio shared by Atom 0.3 and 1.0: the self URL, the
 * alternate link, and the mandatory feed id (explicit id, else link, else self).
 */
export function atomFeedIdentity(
  options: FeedOptions,
  opts: SerializeOptions,
  label: string,
): { self: string | undefined; link: string | undefined; feedId: string } {
  const self = selfUrl(opts, options)
  const link = absolutize(options.link, opts.baseUrl)
  const feedId = options.id ?? link ?? self
  if (!feedId) throw new TypeError(`hono-feed: ${label} requires an id`)
  // RFC 4287 §4.2.6: atom:id MUST be an absolute IRI. An explicit id is checked by
  // validateInput; the link/self fallback isn't, so a relative link with no baseUrl could
  // otherwise reach the document unchecked.
  if (!hasIriScheme(feedId)) {
    throw new TypeError(
      `hono-feed: ${label} id must be an absolute IRI (RFC 4287 §4.2.6) — set "baseUrl" or an absolute "id"/"link"`,
    )
  }
  return { self, link, feedId }
}
