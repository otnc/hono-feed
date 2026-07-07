/** Normalize `FeedOptions.hub` (a single URL or several) into a list. */
export function hubList(hub: string | string[] | undefined): string[] {
  if (!hub) return []
  return Array.isArray(hub) ? hub : [hub]
}
