import type { MiddlewareHandler } from 'hono'
import { bindServeFeed, type FeedInputSource } from '../serve'
import type { ServeFeedOptions } from '../types'

// Type `c.render` as a feed renderer. Global, like `jsxRenderer` — hence its own entry point.
declare module 'hono' {
  interface ContextRenderer {
    // biome-ignore lint/style/useShorthandFunctionType: must be an interface to merge with Hono's ContextRenderer
    (input: FeedInputSource, options?: ServeFeedOptions): Response | Promise<Response>
  }
}

/** Wire `serveFeed` into `c.render`, so a route can `c.render(feed, options?)`. Per-call options win. */
export function feedRenderer(defaults: ServeFeedOptions = {}): MiddlewareHandler {
  return async (c, next) => {
    c.setRenderer(bindServeFeed(c, defaults))
    await next()
  }
}
