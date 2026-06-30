import { describe, expect, it } from 'vitest'
import { Feed } from './feed'

describe('Feed', () => {
  it('is chainable and collects items in order', () => {
    const input = new Feed({ title: 't' })
      .addItem({ title: 'a' })
      .addItems([{ title: 'b' }, { title: 'c' }])
      .toInput()
    expect(input.options.title).toBe('t')
    expect(input.items.map((i) => i.title)).toEqual(['a', 'b', 'c'])
  })

  it('returns a fresh items array from toInput', () => {
    const f = new Feed({ title: 't' }).addItem({ title: 'a' })
    f.toInput().items.push({ title: 'mutated' })
    expect(f.toInput().items).toHaveLength(1)
  })
})
