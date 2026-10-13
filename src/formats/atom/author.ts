import type { Author } from '../../types'
import { type Node, tag } from '../../utils/xml'

/**
 * Atom 0.3 and 1.0 share the same person-construct shape for both `<author>` (RFC 4287 §4.2.1) and `<contributor>` (§4.2.3); only the URL element's name (and the element itself) differs.
 */
export function atomAuthorEl(
  a: Author,
  urlTag: 'uri' | 'url',
  elementName: 'author' | 'contributor' = 'author',
): Node {
  const ch: Node[] = [tag('name', a.name)]
  if (a.email) ch.push(tag('email', a.email))
  if (a.url) ch.push(tag(urlTag, a.url))
  return tag(elementName, ch)
}
