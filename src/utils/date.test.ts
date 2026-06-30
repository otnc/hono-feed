import { describe, expect, it } from 'vitest'
import { latestDate, rfc822, rfc3339 } from './date'

describe('date utils', () => {
  it('formats RFC822 (GMT) and RFC3339', () => {
    const d = new Date('2026-06-29T00:00:00Z')
    expect(rfc822(d)).toBe('Mon, 29 Jun 2026 00:00:00 GMT')
    expect(rfc3339(d)).toBe('2026-06-29T00:00:00.000Z')
  })

  it('latestDate picks the max across updated/published', () => {
    const items = [
      { title: 'a', published: new Date('2026-01-01T00:00:00Z') },
      {
        title: 'b',
        updated: new Date('2026-03-01T00:00:00Z'),
        published: new Date('2026-02-01T00:00:00Z'),
      },
    ]
    expect(latestDate(items)?.toISOString()).toBe('2026-03-01T00:00:00.000Z')
    expect(latestDate([])).toBeUndefined()
  })
})
