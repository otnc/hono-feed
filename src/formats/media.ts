import type { FeedItem, FeedOptions, MediaThumbnail } from '../types'
import { absolutize } from '../utils/url'
import { el, type Node } from '../utils/xml'

export const MEDIA_NS = 'http://search.yahoo.com/mrss/'

// An item's `image` stands in as its thumbnail when the feed opts in and the item lists no thumbnails of its own.
function thumbnailsOf(item: FeedItem, options: FeedOptions): MediaThumbnail[] {
  const explicit = item.media?.thumbnails ?? []
  if (explicit.length > 0 || !item.image || !options.itemImageAsThumbnail) return explicit
  return [{ url: item.image }]
}

/** Whether `item` carries anything that needs the `media:` namespace declared. */
export function hasMedia(item: FeedItem, options: FeedOptions): boolean {
  return thumbnailsOf(item, options).length > 0 || (item.media?.contents?.length ?? 0) > 0
}

/** Media RSS `<media:content>` then `<media:thumbnail>` elements for an item. */
export function mediaItemNodes(
  item: FeedItem,
  options: FeedOptions,
  base: string | undefined,
): Node[] {
  const nodes: Node[] = []
  for (const content of item.media?.contents ?? []) {
    nodes.push(
      el('media:content', {
        url: absolutize(content.url, base),
        type: content.type,
        medium: content.medium,
        width: content.width,
        height: content.height,
        duration: content.duration,
        fileSize: content.fileSize,
      }),
    )
  }
  for (const thumbnail of thumbnailsOf(item, options)) {
    nodes.push(
      el('media:thumbnail', {
        url: absolutize(thumbnail.url, base),
        width: thumbnail.width,
        height: thumbnail.height,
      }),
    )
  }
  return nodes
}
