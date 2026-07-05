import type { Author } from '../../types'
import { el, type Node } from '../../utils/xml'

/** Atom 0.3 and 1.0 share the same `<author>` shape; only the URL element's name differs. */
export function atomAuthorEl(a: Author, urlTag: 'uri' | 'url'): Node {
  const ch: Node[] = [el('name', undefined, a.name)]
  if (a.email) ch.push(el('email', undefined, a.email))
  if (a.url) ch.push(el(urlTag, undefined, a.url))
  return el('author', undefined, ch)
}
