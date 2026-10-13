/** Result of pinging a single hub. `status` is `0` when the request itself failed (network
 * error, abort, …) rather than completing with a non-2xx response. */
export interface NotifyHubResult {
  hub: string
  ok: boolean
  status: number
}

export interface NotifyHubOptions {
  /** Aborts every in-flight ping. An abort is reported as a normal (non-throwing) result. */
  signal?: AbortSignal
}

/**
 * Ping one or more WebSub hubs to tell them a feed has new content (WebSub §6, Publishing).
 * §6 leaves the mechanism open, so this sends what real-world hubs accept, inherited from
 * PubSubHubbub 0.4: one form-encoded `fetch` POST per hub, `hub.mode=publish` plus a repeated
 * `hub.url` for every feed URL. Call it after publishing or updating content.
 *
 * Never throws: a non-2xx response, a network error or an abort is reported in the result, so
 * one unreachable hub can't fail the publish flow. Subscribers catch up on their next poll.
 *
 * @param hub - Hub URL, or several.
 * @param feedUrl - Feed URL that changed, or several.
 * @param options - `signal` aborts every in-flight ping.
 * @returns One result per hub, in the order given.
 *
 * @example
 * ```ts
 * const results = await notifyHub('https://pubsubhubbub.appspot.com/', 'https://example.com/feed.xml')
 * const failed = results.filter((r) => !r.ok)
 * ```
 */
export async function notifyHub(
  hub: string | string[],
  feedUrl: string | string[],
  options: NotifyHubOptions = {},
): Promise<NotifyHubResult[]> {
  const hubs = Array.isArray(hub) ? hub : [hub]
  const feedUrls = Array.isArray(feedUrl) ? feedUrl : [feedUrl]

  const body = new URLSearchParams()
  body.set('hub.mode', 'publish')
  for (const url of feedUrls) body.append('hub.url', url)
  const encodedBody = body.toString()

  return Promise.all(
    hubs.map(async (h): Promise<NotifyHubResult> => {
      try {
        const res = await fetch(h, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: encodedBody,
          signal: options.signal,
        })
        return { hub: h, ok: res.ok, status: res.status }
      } catch {
        return { hub: h, ok: false, status: 0 }
      }
    }),
  )
}
