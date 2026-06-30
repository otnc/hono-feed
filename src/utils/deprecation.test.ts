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
})
