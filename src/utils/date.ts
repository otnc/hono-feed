import type { FeedItem } from '../types'

/** RFC822 for RSS. `toUTCString()` yields GMT with a 4-digit year. */
export function rfc822(date: Date): string {
  return date.toUTCString()
}

/** RFC3339 for Atom / JSON. */
export function rfc3339(date: Date): string {
  return date.toISOString()
}

/** Latest date across items (updated/published); used to backfill lastModified. */
export function latestDate(items: FeedItem[]): Date | undefined {
  let max: Date | undefined
  for (const item of items) {
    max = laterOf(max, item.updated)
    max = laterOf(max, item.published)
  }
  return max
}

// The candidate wins only when it's a valid Date newer than the current best.
function laterOf(best: Date | undefined, candidate: Date | undefined): Date | undefined {
  if (!(candidate instanceof Date) || Number.isNaN(candidate.getTime())) return best
  return !best || candidate > best ? candidate : best
}
