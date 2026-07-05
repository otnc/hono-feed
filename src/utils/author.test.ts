import { describe, expect, it } from 'vitest'
import { authorList, firstAuthor } from './author'

const a = { name: 'a' }
const b = { name: 'b' }

describe('firstAuthor', () => {
  it('passes through a single author unchanged', () => {
    expect(firstAuthor(a)).toBe(a)
  })

  it('takes the first entry of an array', () => {
    expect(firstAuthor([a, b])).toBe(a)
  })

  it('returns undefined for undefined and for an empty array', () => {
    expect(firstAuthor(undefined)).toBeUndefined()
    expect(firstAuthor([])).toBeUndefined()
  })
})

describe('authorList', () => {
  it('wraps a single author in a one-element array', () => {
    expect(authorList(a)).toEqual([a])
  })

  it('passes an array through unchanged', () => {
    expect(authorList([a, b])).toEqual([a, b])
  })

  it('returns [] for undefined', () => {
    expect(authorList(undefined)).toEqual([])
  })
})
