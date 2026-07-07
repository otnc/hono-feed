import type { MiddlewareHandler } from 'hono'
import { bindServeFeed, type FeedInputSource } from '../serve'
import type { ServeFeedOptions } from '../types'

/** Type of `c.var.serveFeed`: a `serveFeed` with folded-in defaults. */
export type ServeFeedFn = (
  input: FeedInputSource,
  options?: ServeFeedOptions,
) => Response | Promise<Response>

/** Helper Env type for `new Hono<FeedMiddlewareEnv>()`. */
export interface FeedMiddlewareEnv {
  Variables: { serveFeed: ServeFeedFn }
}

/** Expose a preconfigured `serveFeed` on `c.var.serveFeed`. Per-call options override defaults. */
export function feed(defaults: ServeFeedOptions = {}): MiddlewareHandler<FeedMiddlewareEnv> {
  return async (c, next) => {
    c.set('serveFeed', bindServeFeed(c, defaults))
    await next()
  }
}
