import type { CacheControlDirectives } from '../types'

/** Serialize `CacheControlDirectives` into a `Cache-Control` header value. */
export function serializeCacheControl(directives: CacheControlDirectives): string {
  const parts: string[] = []
  if (directives.noStore) parts.push('no-store')
  if (directives.noCache) parts.push('no-cache')
  if (directives.public) parts.push('public')
  if (directives.private) parts.push('private')
  if (directives.maxAge !== undefined) parts.push(`max-age=${directives.maxAge}`)
  if (directives.sMaxAge !== undefined) parts.push(`s-maxage=${directives.sMaxAge}`)
  if (directives.mustRevalidate) parts.push('must-revalidate')
  if (directives.proxyRevalidate) parts.push('proxy-revalidate')
  if (directives.immutable) parts.push('immutable')
  if (directives.staleWhileRevalidate !== undefined) {
    parts.push(`stale-while-revalidate=${directives.staleWhileRevalidate}`)
  }
  if (directives.staleIfError !== undefined) {
    parts.push(`stale-if-error=${directives.staleIfError}`)
  }
  return parts.join(', ')
}
