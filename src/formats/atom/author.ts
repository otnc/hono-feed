import type { Author, Category, Enclosure } from '../../types'
import { authorList } from '../../utils/author'
import { absolutize } from '../../utils/url'
import { el, type Node, tag } from '../../utils/xml'

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

/** `<author>` elements, then `<contributor>` elements when given. */
export function atomPeople(
  authors: Author | Author[] | undefined,
  contributors: Author[] | undefined,
  urlTag: 'uri' | 'url',
): Node[] {
  return [
    ...authorList(authors).map((a) => atomAuthorEl(a, urlTag)),
    ...(contributors ?? []).map((c) => atomAuthorEl(c, urlTag, 'contributor')),
  ]
}

/** One `<category>` per entry (RFC 4287 §4.2.2). */
export function atomCategories(categories: Category[] | undefined): Node[] {
  return (categories ?? []).map((cat) =>
    el('category', { term: cat.term, scheme: cat.scheme, label: cat.label }),
  )
}

/** `<link rel="enclosure">` (RFC 4287 §4.2.7.2); 0.3's link draft defines it the same way. */
export function atomEnclosureLink(enclosure: Enclosure, base: string | undefined): Node {
  return el('link', {
    rel: 'enclosure',
    href: absolutize(enclosure.url, base),
    type: enclosure.type,
    length: enclosure.length !== undefined ? String(enclosure.length) : undefined,
  })
}
