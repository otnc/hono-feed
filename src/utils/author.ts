import type { Author } from '../types'

/** RSS/RDF only ever emit one author; `Author | Author[]` collapses to the first. */
export function firstAuthor(author: Author | Author[] | undefined): Author | undefined {
  return Array.isArray(author) ? author[0] : author
}

/** Atom and JSON Feed emit every author; normalize the single-or-array input into a list. */
export function authorList(author: Author | Author[] | undefined): Author[] {
  if (!author) return []
  return Array.isArray(author) ? author : [author]
}
