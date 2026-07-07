import { describe, expect, it } from 'vitest'
import type {
  FeedPodcast,
  ItemPodcast,
  PodcastChapters,
  PodcastFunding,
  PodcastOwner,
  PodcastTranscript,
} from './index'
import { validateInput } from './index'

// validateInput is the same per-format validation serveFeed runs internally; exporting it lets
// low-level toRSS/toAtom/toJSONFeed callers opt into the same checks (see README "Low-level
// serializers"). This guards the export itself — validation behaviour is covered in validate.test.ts.
describe('validateInput (public export)', () => {
  it('is importable from the package root', () => {
    expect(typeof validateInput).toBe('function')
  })

  it('throws the documented message for missing input', () => {
    expect(() =>
      validateInput({ options: { title: '', link: 'https://example.com/' }, items: [] }, 'rss'),
    ).toThrow(/feed "title" is required/)
  })

  it('applies format-specific rules (Atom relative id) not enforced by the serializers alone', () => {
    expect(() =>
      validateInput(
        { options: { title: 'T', id: '/not-absolute', updated: new Date() }, items: [] },
        'atom',
      ),
    ).toThrow(/absolute IRI/)
  })
})

describe('podcast types (public export)', () => {
  it('are importable from the package root', () => {
    // Type-only: these have no runtime presence, so the check is that this file — importing
    // them via `import type { ... } from './index'` rather than an internal relative path —
    // still type-checks (`pnpm typecheck`). If one is ever dropped from index.ts's export list,
    // this stops compiling.
    const owner: PodcastOwner = { name: 'Ada', email: 'ada@example.com' }
    const funding: PodcastFunding = { url: 'https://example.com/support' }
    const transcript: PodcastTranscript = { url: 'https://example.com/1.vtt', type: 'text/vtt' }
    const chapters: PodcastChapters = { url: 'https://example.com/1-chapters.json' }
    const feedPodcast: FeedPodcast = { owner, funding: [funding] }
    const itemPodcast: ItemPodcast = { transcript: [transcript], chapters }
    expect(feedPodcast.owner).toEqual(owner)
    expect(itemPodcast.chapters).toEqual(chapters)
  })
})
