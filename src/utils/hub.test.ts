import { describe, expect, it } from 'vitest'
import { hubList } from './hub'

describe('hubList', () => {
  it('wraps a single URL in a one-element array', () => {
    expect(hubList('https://hub.example.com/')).toEqual(['https://hub.example.com/'])
  })

  it('passes an array through unchanged', () => {
    expect(hubList(['a', 'b'])).toEqual(['a', 'b'])
  })

  it('returns [] for undefined', () => {
    expect(hubList(undefined)).toEqual([])
  })
})
