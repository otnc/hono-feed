import type { FeedInput, SerializeOptions } from '../../types'
import { warnDeprecated } from '../../utils/deprecation'
import { toRSS2 } from './rss2'
import { toRSS10 } from './rss10'
import { toRSS11 } from './rss11'
import { toRSS090 } from './rss090'

// RSS versions superseded by RSS 2.0; selecting one logs a deprecation warning.
const OBSOLETE_RSS = new Set(['0.90', '0.91', '0.92', '0.93', '0.94'])

/**
 * Serialize the neutral model to RSS. `rssVersion` '0.90' / '1.0' / '1.1' emit RDF;
 * '2.0' / '0.94' / '0.93' / '0.92' / '0.91' emit the `<rss version="…">` structure.
 */
export function toRSS(input: FeedInput, opts: SerializeOptions = {}): string {
  const version = opts.rssVersion
  if (version && OBSOLETE_RSS.has(version) && !opts.suppressDeprecationWarnings) {
    warnDeprecated(
      `rss:${version}`,
      `RSS ${version} is an obsolete format; prefer RSS 2.0 (rssVersion: '2.0').`,
      'HONOFEED_DEP0001',
    )
  }
  switch (version) {
    case '0.90':
      return toRSS090(input, opts)
    case '1.0':
      return toRSS10(input, opts)
    case '1.1':
      return toRSS11(input, opts)
    default:
      return toRSS2(input, opts)
  }
}
