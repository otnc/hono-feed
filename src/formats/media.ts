import type { ItemMedia } from '../types'
import { absolutize } from '../utils/url'
import { el, type Node } from '../utils/xml'

export const MEDIA_NS = 'http://search.yahoo.com/mrss/'

/** Whether `media` carries anything that needs the `media:` namespace declared. */
export function hasMedia(media: ItemMedia | undefined): boolean {
  return !!media && ((media.thumbnails?.length ?? 0) > 0 || (media.contents?.length ?? 0) > 0)
}

/** Media RSS `<media:content>` then `<media:thumbnail>` elements for an item. */
export function mediaItemNodes(media: ItemMedia | undefined, base: string | undefined): Node[] {
  if (!media) return []
  const nodes: Node[] = []
  for (const content of media.contents ?? []) {
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
  for (const thumbnail of media.thumbnails ?? []) {
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
