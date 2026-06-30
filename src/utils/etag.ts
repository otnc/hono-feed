// FNV-1a 32-bit synchronous hash, used for weak ETags (collisions tolerated)
// to keep serveFeed synchronous instead of relying on async crypto.subtle.
export function fnv1a(input: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/** Build a weak ETag (`W/"<hash>"`) from the body. */
export function weakEtag(body: string): string {
  return `W/"${fnv1a(body)}"`
}
