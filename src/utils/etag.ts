// FNV-1a 64-bit synchronous hash (via BigInt), used for the default weak ETag. 64 bits pushes
// the birthday bound for an accidental collision past ~5 billion distinct bodies (vs. ~77k for
// a 32-bit hash), while staying synchronous instead of relying on async crypto.subtle.
const FNV64_OFFSET = 0xcbf29ce484222325n
const FNV64_PRIME = 0x100000001b3n
const MASK64 = 0xffffffffffffffffn

export function fnv1a64(input: string): string {
  let hash = FNV64_OFFSET
  for (let i = 0; i < input.length; i++) {
    hash ^= BigInt(input.charCodeAt(i))
    hash = (hash * FNV64_PRIME) & MASK64
  }
  return hash.toString(16).padStart(16, '0')
}

/** Build the default weak ETag (`W/"<hash>"`) from the body. */
export function weakEtag(body: string): string {
  return `W/"${fnv1a64(body)}"`
}

// A value already shaped like an ETag (`"…"` or `W/"…"`), per RFC 9110 §8.8.3.
const LOOKS_LIKE_ETAG = /^(W\/)?"[^"]*"$/

/**
 * Resolve the ETag to send: the built-in weak hash by default, or — when `custom` is given —
 * its return value for the body, used verbatim if it already looks like an ETag (`"…"` /
 * `W/"…"`), otherwise wrapped as a weak validator.
 */
export function resolveEtag(body: string, custom?: (body: string) => string): string {
  if (!custom) return weakEtag(body)
  const tag = custom(body)
  return LOOKS_LIKE_ETAG.test(tag) ? tag : `W/"${tag}"`
}
