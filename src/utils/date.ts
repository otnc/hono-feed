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
    for (const d of [item.updated, item.published]) {
      if (d instanceof Date && !Number.isNaN(d.getTime()) && (!max || d > max)) max = d
    }
  }
  return max
}
