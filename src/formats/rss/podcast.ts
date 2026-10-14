import type {
  Enclosure,
  FeedItem,
  FeedOptions,
  ItemPodcast,
  PodcastImages,
  PodcastLicense,
  PodcastLocation,
  PodcastPerson,
  PodcastSocialInteract,
} from '../../types'
import { rfc822 } from '../../utils/date'
import { firstEnclosure } from '../../utils/enclosure'
import { absolutize } from '../../utils/url'
import { el, type Node, tag } from '../../utils/xml'

export const ITUNES_NS = 'http://www.itunes.com/dtds/podcast-1.0.dtd'
export const PODCAST_NS = 'https://podcastindex.org/namespace/1.0'

function hasItunesFeedFields(p: NonNullable<FeedOptions['podcast']>): boolean {
  return (
    p.author !== undefined ||
    p.category !== undefined ||
    p.explicit !== undefined ||
    p.image !== undefined ||
    p.owner !== undefined ||
    p.type !== undefined ||
    p.subtitle !== undefined ||
    p.summary !== undefined ||
    // block/complete only emit an element when true (absence means no — see podcastChannelNodes).
    p.block === true ||
    p.complete === true ||
    p.newFeedUrl !== undefined
  )
}

function hasPodcastNsFeedFields(p: NonNullable<FeedOptions['podcast']>): boolean {
  return (
    p.guid !== undefined ||
    p.locked !== undefined ||
    (p.funding?.length ?? 0) > 0 ||
    (p.person?.length ?? 0) > 0 ||
    p.license !== undefined ||
    p.medium !== undefined ||
    p.location !== undefined ||
    p.images !== undefined ||
    (p.trailer?.length ?? 0) > 0 ||
    (p.socialInteract?.length ?? 0) > 0
  )
}

function hasItunesItemFields(p: ItemPodcast): boolean {
  return (
    p.duration !== undefined ||
    p.explicit !== undefined ||
    p.episode !== undefined ||
    p.season !== undefined ||
    p.episodeType !== undefined ||
    p.image !== undefined ||
    p.title !== undefined ||
    // block only emits an element when true (absence means no — see podcastItemNodes).
    p.block === true
  )
}

function hasPodcastNsItemFields(p: ItemPodcast): boolean {
  return (
    (p.transcript?.length ?? 0) > 0 ||
    p.chapters !== undefined ||
    (p.person?.length ?? 0) > 0 ||
    p.license !== undefined ||
    p.location !== undefined ||
    p.images !== undefined ||
    (p.socialInteract?.length ?? 0) > 0 ||
    p.podcastSeason !== undefined ||
    p.podcastEpisode !== undefined
  )
}

// Podcasting 2.0 elements that look the same at feed and item level.
function sharedPodcastNodes(
  p: {
    person?: PodcastPerson[]
    license?: PodcastLicense
    location?: PodcastLocation
    images?: PodcastImages
    socialInteract?: PodcastSocialInteract[]
  },
  base: string | undefined,
): Node[] {
  const nodes: Node[] = []
  for (const person of p.person ?? []) {
    nodes.push(
      el(
        'podcast:person',
        {
          role: person.role,
          group: person.group,
          img: absolutize(person.img, base),
          href: absolutize(person.href, base),
        },
        person.name,
      ),
    )
  }
  if (p.license) {
    nodes.push(
      el('podcast:license', { url: absolutize(p.license.url, base) }, p.license.identifier),
    )
  }
  if (p.location) {
    nodes.push(
      el('podcast:location', { geo: p.location.geo, osm: p.location.osm }, p.location.name),
    )
  }
  if (p.images) nodes.push(el('podcast:images', { srcset: p.images.srcset }))
  for (const social of p.socialInteract ?? []) {
    nodes.push(
      el('podcast:socialInteract', {
        protocol: social.protocol,
        uri: absolutize(social.uri, base),
        accountId: social.accountId,
        accountUrl: absolutize(social.accountUrl, base),
        priority: social.priority,
      }),
    )
  }
  return nodes
}

/**
 * Whether `xmlns:itunes` / `xmlns:podcast` are needed, across the feed and every item — `itunes:duration`'s `enclosure.duration` fallback (see `podcastItemNodes`) means an item can need `xmlns:itunes` from its enclosure alone, with no `item.podcast` at all.
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

// itunes:duration prefers item.podcast.duration; falling back to the (first) enclosure's duration means a plain Enclosure.duration (#71) still reaches podcast directories without requiring a caller to also set item.podcast.
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
  if (p.author) nodes.push(tag('itunes:author', p.author))
  if (p.category) {
    for (const category of p.category) {
      if (typeof category === 'string') {
        nodes.push(el('itunes:category', { text: category }))
      } else {
        nodes.push(
          el(
            'itunes:category',
            { text: category.text },
            category.subcategory
              ? [el('itunes:category', { text: category.subcategory })]
              : undefined,
          ),
        )
      }
    }
  }
  if (p.explicit !== undefined) {
    nodes.push(tag('itunes:explicit', p.explicit ? 'true' : 'false'))
  }
  if (p.image) nodes.push(el('itunes:image', { href: absolutize(p.image, base) }))
  if (p.owner) {
    nodes.push(
      tag('itunes:owner', [tag('itunes:name', p.owner.name), tag('itunes:email', p.owner.email)]),
    )
  }
  if (p.type) nodes.push(tag('itunes:type', p.type))
  if (p.subtitle) nodes.push(tag('itunes:subtitle', p.subtitle))
  if (p.summary) nodes.push(tag('itunes:summary', p.summary))
  // Apple's documented value is "Yes"; absence (false/unset) means no, so there's no "No" to emit.
  if (p.block) nodes.push(tag('itunes:block', 'Yes'))
  if (p.complete) nodes.push(tag('itunes:complete', 'Yes'))
  if (p.newFeedUrl) nodes.push(tag('itunes:new-feed-url', absolutize(p.newFeedUrl, base)))
  if (p.guid) nodes.push(tag('podcast:guid', p.guid))
  if (p.locked !== undefined) {
    nodes.push(tag('podcast:locked', p.locked ? 'yes' : 'no'))
  }
  if (p.funding) {
    for (const funding of p.funding) {
      nodes.push(el('podcast:funding', { url: absolutize(funding.url, base) }, funding.text))
    }
  }
  if (p.medium) nodes.push(tag('podcast:medium', p.medium))
  for (const trailer of p.trailer ?? []) {
    nodes.push(
      el(
        'podcast:trailer',
        {
          url: absolutize(trailer.url, base),
          pubdate: rfc822(trailer.pubDate),
          length: trailer.length,
          type: trailer.type,
          season: trailer.season,
        },
        trailer.title,
      ),
    )
  }
  nodes.push(...sharedPodcastNodes(p, base))
  return nodes
}

/**
 * Build the item-level podcast elements (iTunes + Podcasting 2.0). RSS 2.0 only. `itunes:duration` prefers `item.podcast.duration`, falling back to `enclosure.duration`.
 */
export function podcastItemNodes(
  podcast: ItemPodcast | undefined,
  enclosure: Enclosure | undefined,
  base: string | undefined,
): Node[] {
  const nodes: Node[] = []
  const duration = itunesDuration(podcast, enclosure)
  if (duration !== undefined) nodes.push(tag('itunes:duration', String(duration)))
  if (!podcast) return nodes

  if (podcast.explicit !== undefined) {
    nodes.push(tag('itunes:explicit', podcast.explicit ? 'true' : 'false'))
  }
  if (podcast.episode !== undefined) {
    nodes.push(tag('itunes:episode', String(podcast.episode)))
  }
  if (podcast.season !== undefined) {
    nodes.push(tag('itunes:season', String(podcast.season)))
  }
  if (podcast.episodeType) nodes.push(tag('itunes:episodeType', podcast.episodeType))
  if (podcast.image) nodes.push(el('itunes:image', { href: absolutize(podcast.image, base) }))
  if (podcast.title) nodes.push(tag('itunes:title', podcast.title))
  // Apple's documented value is "Yes"; absence (false/unset) means no, so there's no "No" to emit.
  if (podcast.block) nodes.push(tag('itunes:block', 'Yes'))
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
  if (podcast.podcastSeason) {
    nodes.push(
      el(
        'podcast:season',
        { name: podcast.podcastSeason.name },
        String(podcast.podcastSeason.number),
      ),
    )
  }
  if (podcast.podcastEpisode) {
    nodes.push(
      el(
        'podcast:episode',
        { display: podcast.podcastEpisode.display },
        String(podcast.podcastEpisode.number),
      ),
    )
  }
  nodes.push(...sharedPodcastNodes(podcast, base))
  return nodes
}
