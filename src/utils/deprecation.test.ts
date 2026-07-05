import { describe, expect, it, vi } from 'vitest'
import { warnDeprecated } from './deprecation'

const proc = (
  globalThis as unknown as {
    process: {
      emitWarning: (warning: string, options?: unknown) => void
      env: Record<string, string | undefined>
    }
  }
).process

describe('warnDeprecated', () => {
  it('emits a coded DeprecationWarning once per key', () => {
    const spy = vi.spyOn(proc, 'emitWarning').mockImplementation(() => {})
    warnDeprecated('test:once', 'use the new thing', 'HONOFEED_TEST1')
    warnDeprecated('test:once', 'use the new thing', 'HONOFEED_TEST1')
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('use the new thing'), {
      type: 'DeprecationWarning',
      code: 'HONOFEED_TEST1',
    })
    spy.mockRestore()
  })

  it('is suppressed by the HONO_FEED_NO_DEPRECATION env var', () => {
    const spy = vi.spyOn(proc, 'emitWarning').mockImplementation(() => {})
    proc.env.HONO_FEED_NO_DEPRECATION = '1'
    warnDeprecated('test:env', 'x', 'HONOFEED_TEST2')
    delete proc.env.HONO_FEED_NO_DEPRECATION
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('is suppressed by process.noDeprecation', () => {
    const spy = vi.spyOn(proc, 'emitWarning').mockImplementation(() => {})
    ;(proc as unknown as { noDeprecation: boolean }).noDeprecation = true
    warnDeprecated('test:noDeprecation', 'x', 'HONOFEED_TEST3')
    ;(proc as unknown as { noDeprecation: boolean }).noDeprecation = false
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('falls back to console.warn when process.emitWarning is unavailable (edge runtimes)', () => {
    const original = proc.emitWarning
    // @ts-expect-error simulating an edge runtime without process.emitWarning
    proc.emitWarning = undefined
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    warnDeprecated('test:noEmitWarning', 'use the new thing', 'HONOFEED_TEST4')
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('[HONOFEED_TEST4] DeprecationWarning: hono-feed: use the new thing'),
    )
    spy.mockRestore()
    proc.emitWarning = original
  })
})
