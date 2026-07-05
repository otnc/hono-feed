import type { FeedOptions, SerializeOptions } from '../types'

/** Absolutize a relative URL against baseUrl. Returns the input on failure or no base. */
export function absolutize(url: string | undefined, baseUrl?: string): string | undefined {
  if (!url || !baseUrl) return url
  try {
    return new URL(url, baseUrl).href
  } catch {
    return url
  }
}

/** The feed's self URL: a serialize-time feedUrl (request-derived) wins over the option. */
export function selfUrl(
  opts: Pick<SerializeOptions, 'feedUrl' | 'baseUrl'>,
  options: Pick<FeedOptions, 'feedUrl'>,
): string | undefined {
  return opts.feedUrl ?? absolutize(options.feedUrl, opts.baseUrl)
}

/** Whether the string is an absolute http(s) URL. */
export function isUrl(s: string): boolean {
  return /^https?:\/\//i.test(s)
}
