import type { FeedInput, SerializeOptions } from '../../types'
import { warnDeprecated } from '../../utils/deprecation'
import { toAtom03 } from './atom03'
import { toAtom10 } from './atom10'

export { validateInput } from '../../validate'

/** Serialize the neutral model to Atom. `atomVersion` '0.3' emits the deprecated 0.3. */
export function toAtom(input: FeedInput, opts: SerializeOptions = {}): string {
  // RFC 4287 §2: Atom documents are "serialized as XML 1.0".
  if (opts.xmlVersion === '1.1') {
    throw new TypeError('hono-feed: Atom must be serialized as XML 1.0 (RFC 4287 §2)')
  }
  if (opts.atomVersion === '0.3') {
    if (!opts.suppressDeprecationWarnings) {
      warnDeprecated(
        'atom:0.3',
        "Atom 0.3 is deprecated (superseded by Atom 1.0, RFC 4287); prefer atomVersion: '1.0'.",
        'HONOFEED_DEP0002',
      )
    }
    return toAtom03(input, opts)
  }
  return toAtom10(input, opts)
}
