import type { FeedFormat, FeedInput } from './types'

/** Minimal validation after the format is decided. Invalid input throws `TypeError`. */
export function validateInput(input: FeedInput, format: FeedFormat): void {
  const { options, items } = input

  if (!options || typeof options.title !== 'string' || options.title.length === 0) {
    throw new TypeError('hono-feed: feed "title" is required')
  }
  assertValidDate(options.updated, 'feed.updated')

  if (format === 'atom' && !options.id && !options.link && !options.feedUrl) {
    throw new TypeError('hono-feed: Atom feed requires "id" (or "link" / "feedUrl")')
  }

  items.forEach((item, i) => {
    if (typeof item.title !== 'string' || item.title.length === 0) {
      throw new TypeError(`hono-feed: item[${i}] "title" is required`)
    }
    assertValidDate(item.published, `item[${i}].published`)
    assertValidDate(item.updated, `item[${i}].updated`)

    if (format === 'atom') {
      if (!item.id && !item.link) {
        throw new TypeError(`hono-feed: Atom item[${i}] requires "id" (or "link")`)
      }
      if (!item.updated && !item.published) {
        throw new TypeError(`hono-feed: Atom item[${i}] requires "updated" (or "published")`)
      }
    }
  })
}

function assertValidDate(d: Date | undefined, label: string): void {
  if (d === undefined) return
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) {
    throw new TypeError(`hono-feed: ${label} must be a valid Date`)
  }
}
