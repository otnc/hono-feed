/** Absolutize a relative URL against baseUrl. Returns the input on failure or no base. */
export function absolutize(url: string | undefined, baseUrl?: string): string | undefined {
  if (!url || !baseUrl) return url
  try {
    return new URL(url, baseUrl).href
  } catch {
    return url
  }
}

/** Whether the string is an absolute http(s) URL. */
export function isUrl(s: string): boolean {
  return /^https?:\/\//i.test(s)
}
