import type { Enclosure } from '../types'

/** RSS/Atom emit at most one enclosure; `Enclosure | Enclosure[]` collapses to the first. */
export function firstEnclosure(
  enclosure: Enclosure | Enclosure[] | undefined,
): Enclosure | undefined {
  return Array.isArray(enclosure) ? enclosure[0] : enclosure
}

/** JSON Feed emits every attachment; normalize the single-or-array input into a list. */
export function enclosureList(enclosure: Enclosure | Enclosure[] | undefined): Enclosure[] {
  if (!enclosure) return []
  return Array.isArray(enclosure) ? enclosure : [enclosure]
}
