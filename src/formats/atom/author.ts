import type { Author } from '../../types'
import { el, type Node } from '../../utils/xml'

/**
 * Atom 0.3 and 1.0 share the same person-construct shape for both `<author>` (RFC 4287 §4.2.1)
 * and `<contributor>` (§4.2.3); only the URL element's name (and the element itself) differs.
 */
export function atomAuthorEl(
  a: Author,
  urlTag: 'uri' | 'url',
  tag: 'author' | 'contributor' = 'author',
): Node {
  const ch: Node[] = [el('name', undefined, a.name)]
  if (a.email) ch.push(el('email', undefined, a.email))
  if (a.url) ch.push(el(urlTag, undefined, a.url))
  return el(tag, undefined, ch)
}
