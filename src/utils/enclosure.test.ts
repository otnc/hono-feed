import { describe, expect, it } from 'vitest'
import { enclosureList, firstEnclosure } from './enclosure'

const a = { url: 'https://example.com/a.mp3', type: 'audio/mpeg' }
const b = { url: 'https://example.com/a.ogg', type: 'audio/ogg' }

describe('firstEnclosure', () => {
  it('passes through a single enclosure unchanged', () => {
    expect(firstEnclosure(a)).toBe(a)
  })

  it('takes the first entry of an array', () => {
    expect(firstEnclosure([a, b])).toBe(a)
  })

  it('returns undefined for undefined and for an empty array', () => {
    expect(firstEnclosure(undefined)).toBeUndefined()
    expect(firstEnclosure([])).toBeUndefined()
  })
})

describe('enclosureList', () => {
  it('wraps a single enclosure in a one-element array', () => {
    expect(enclosureList(a)).toEqual([a])
  })

  it('passes an array through unchanged', () => {
    expect(enclosureList([a, b])).toEqual([a, b])
  })

  it('returns [] for undefined', () => {
    expect(enclosureList(undefined)).toEqual([])
  })
})
