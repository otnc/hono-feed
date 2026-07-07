import type { Enclosure, FeedItem, FeedOptions, ItemPodcast } from '../../types'
import { firstEnclosure } from '../../utils/enclosure'
import { absolutize } from '../../utils/url'
import { el, type Node } from '../../utils/xml'

export const ITUNES_NS = 'http://www.itunes.com/dtds/podcast-1.0.dtd'
export const PODCAST_NS = 'https://podcastindex.org/namespace/1.0'

function hasItunesFeedFields(p: NonNullable<FeedOptions['podcast']>): boolean {
  return (
    p.author !== undefined ||
    p.category !== undefined ||
    p.explicit !== undefined ||
    p.image !== undefined ||
    p.owner !== undefined ||
    p.type !== undefined
  )
}

function hasPodcastNsFeedFields(p: NonNullable<FeedOptions['podcast']>): boolean {
  return p.guid !== undefined || p.locked !== undefined || (p.funding?.length ?? 0) > 0
}

function hasItunesItemFields(p: ItemPodcast): boolean {
  return (
    p.duration !== undefined ||
    p.explicit !== undefined ||
    p.episode !== undefined ||
    p.season !== undefined ||
    p.episodeType !== undefined ||
    p.image !== undefined
  )
}

function hasPodcastNsItemFields(p: ItemPodcast): boolean {
  return (p.transcript?.length ?? 0) > 0 || p.chapters !== undefined
}

/**
 * Whether `xmlns:itunes` / `xmlns:podcast` are needed, across the feed and every item —
 * `itunes:duration`'s `enclosure.duration` fallback (see `podcastItemNodes`) means an item can
 * need `xmlns:itunes` from its enclosure alone, with no `item.podcast` at all.
 */
export function podcastNamespacesUsed(
  options: FeedOptions,
  items: FeedItem[],
): { itunes: boolean; podcast: boolean } {
  let itunes = false
  let podcastNs = false
  if (options.podcast) {
    if (hasItunesFeedFields(options.podcast)) itunes = true
    if (hasPodcastNsFeedFields(options.podcast)) podcastNs = true
  }
  for (const item of items) {
    if (itunesDuration(item.podcast, firstEnclosure(item.enclosure)) !== undefined) itunes = true
    if (item.podcast && hasItunesItemFields(item.podcast)) itunes = true
    if (item.podcast && hasPodcastNsItemFields(item.podcast)) podcastNs = true
  }
  return { itunes, podcast: podcastNs }
}

// itunes:duration prefers item.podcast.duration; falling back to the (first) enclosure's
// duration means a plain Enclosure.duration (#71) still reaches podcast directories without
// requiring a caller to also set item.podcast.
function itunesDuration(
  podcast: ItemPodcast | undefined,
  enclosure: Enclosure | undefined,
): number | undefined {
  return podcast?.duration ?? enclosure?.duration
}

/** Build the channel-level podcast elements (iTunes + Podcasting 2.0). RSS 2.0 only. */
export function podcastChannelNodes(p: FeedOptions['podcast'], base: string | undefined): Node[] {
  if (!p) return []
  const nodes: Node[] = []
  if (p.author) nodes.push(el('itunes:author', undefined, p.author))
  if (p.category) {
    for (const category of p.category) nodes.push(el('itunes:category', { text: category }))
  }
  if (p.explicit !== undefined) {
    nodes.push(el('itunes:explicit', undefined, p.explicit ? 'true' : 'false'))
  }
  if (p.image) nodes.push(el('itunes:image', { href: absolutize(p.image, base) }))
  if (p.owner) {
    nodes.push(
      el('itunes:owner', undefined, [
        el('itunes:name', undefined, p.owner.name),
        el('itunes:email', undefined, p.owner.email),
      ]),
    )
  }
  if (p.type) nodes.push(el('itunes:type', undefined, p.type))
  if (p.guid) nodes.push(el('podcast:guid', undefined, p.guid))
  if (p.locked !== undefined) {
    nodes.push(el('podcast:locked', undefined, p.locked ? 'yes' : 'no'))
  }
  if (p.funding) {
    for (const funding of p.funding) {
      nodes.push(el('podcast:funding', { url: absolutize(funding.url, base) }, funding.text))
    }
  }
  return nodes
}

/**
 * Build the item-level podcast elements (iTunes + Podcasting 2.0). RSS 2.0 only.
 * `itunes:duration` prefers `item.podcast.duration`, falling back to `enclosure.duration`.
 */
export function podcastItemNodes(
  podcast: ItemPodcast | undefined,
  enclosure: Enclosure | undefined,
  base: string | undefined,
): Node[] {
  const nodes: Node[] = []
  const duration = itunesDuration(podcast, enclosure)
  if (duration !== undefined) nodes.push(el('itunes:duration', undefined, String(duration)))
  if (!podcast) return nodes

  if (podcast.explicit !== undefined) {
    nodes.push(el('itunes:explicit', undefined, podcast.explicit ? 'true' : 'false'))
  }
  if (podcast.episode !== undefined) {
    nodes.push(el('itunes:episode', undefined, String(podcast.episode)))
  }
  if (podcast.season !== undefined) {
    nodes.push(el('itunes:season', undefined, String(podcast.season)))
  }
  if (podcast.episodeType) nodes.push(el('itunes:episodeType', undefined, podcast.episodeType))
  if (podcast.image) nodes.push(el('itunes:image', { href: absolutize(podcast.image, base) }))
  if (podcast.transcript) {
    for (const t of podcast.transcript) {
      nodes.push(el('podcast:transcript', { url: absolutize(t.url, base), type: t.type }))
    }
  }
  if (podcast.chapters) {
    nodes.push(
      el('podcast:chapters', {
        url: absolutize(podcast.chapters.url, base),
        // `type` is required by the Podcasting 2.0 namespace; default per PodcastChapters' doc.
        type: podcast.chapters.type ?? 'application/json+chapters',
      }),
    )
  }
  return nodes
}
