import type { MiddlewareHandler } from 'hono'
import type { Feed } from '../feed'
import { serveFeed } from '../serve'
import type { FeedInput, ServeFeedOptions } from '../types'

/** Type of `c.var.serveFeed`: a `serveFeed` with folded-in defaults. */
export type ServeFeedFn = (input: FeedInput | Feed, options?: ServeFeedOptions) => Response

/** Helper Env type for `new Hono<FeedMiddlewareEnv>()`. */
export interface FeedMiddlewareEnv {
  Variables: { serveFeed: ServeFeedFn }
}

/** Expose a preconfigured `serveFeed` on `c.var.serveFeed`. Per-call options override defaults. */
export function feed(defaults: ServeFeedOptions = {}): MiddlewareHandler<FeedMiddlewareEnv> {
  return async (c, next) => {
    const fn: ServeFeedFn = (input, options) => serveFeed(c, input, { ...defaults, ...options })
    c.set('serveFeed', fn)
    await next()
  }
}
