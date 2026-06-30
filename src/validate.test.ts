import { describe, expect, it } from 'vitest'
import type { FeedInput } from './types'
import { validateInput } from './validate'

const valid: FeedInput = {
  options: { title: 't', link: 'https://example.com/' },
  items: [
    { title: 'a', link: 'https://example.com/1', published: new Date('2026-06-29T00:00:00Z') },
  ],
}

describe('validateInput', () => {
  it('passes a valid feed for every format', () => {
    expect(() => validateInput(valid, 'rss')).not.toThrow()
    expect(() => validateInput(valid, 'atom')).not.toThrow()
    expect(() => validateInput(valid, 'json')).not.toThrow()
  })

  it('requires a feed title and an item title', () => {
    expect(() => validateInput({ options: { title: '' }, items: [] }, 'rss')).toThrow(TypeError)
    expect(() => validateInput({ options: { title: 't' }, items: [{ title: '' }] }, 'rss')).toThrow(
      /item\[0\]/,
    )
  })

  it('rejects invalid dates', () => {
    const bad = { options: { title: 't' }, items: [{ title: 'a', published: new Date('nope') }] }
    expect(() => validateInput(bad, 'rss')).toThrow(/valid Date/)
  })

  it('enforces Atom id/updated requirements only for atom', () => {
    expect(() => validateInput({ options: { title: 't' }, items: [] }, 'atom')).toThrow(
      /Atom feed requires/,
    )
    const noId = { options: { title: 't', link: 'https://example.com/' }, items: [{ title: 'a' }] }
    expect(() => validateInput(noId, 'atom')).toThrow(/Atom item/)
    expect(() => validateInput(noId, 'rss')).not.toThrow()
  })
})
