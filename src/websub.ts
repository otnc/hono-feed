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
 * Ping one or more WebSub hubs to tell them a feed has new content — the publisher's
 * obligation under WebSub §6 (Publishing). §6 deliberately leaves the notification mechanism
 * up to the hub and publisher; what's sent here is the de-facto standard inherited from
 * PubSubHubbub 0.4 that real-world hubs accept: one `fetch` POST per hub, form-encoded as
 * `hub.mode=publish` with a repeated `hub.url` parameter for every feed URL. Call this after
 * publishing/updating content.
 *
 * Never throws: a non-2xx response, a network error, or an aborted request are all reported as
 * a result rather than a rejection, so one unreachable hub can't fail the whole publish flow —
 * subscribers still get the update on their next poll regardless.
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
