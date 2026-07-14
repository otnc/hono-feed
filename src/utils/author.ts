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

/** Whether an author value is actually present — an empty array doesn't count. */
export function hasAuthor(author: Author | Author[] | undefined): boolean {
  return Array.isArray(author) ? author.length > 0 : author !== undefined
}
