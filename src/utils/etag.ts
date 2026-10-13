// FNV-1a 64-bit synchronous hash, used for the default weak ETag. 64 bits pushes the birthday bound for an accidental collision past ~5 billion distinct bodies (vs. ~77k for a 32-bit hash), while staying synchronous instead of relying on async crypto.subtle.
// The state is two uint32 halves rather than a BigInt, which is ~30x faster on a large feed body. The prime is 2^40 + 0x1b3, so a multiply is `x * 0x1b3` plus `x << 40`, and the latter only touches the high half.
const FNV_OFFSET_HI = 0xcbf29ce4
const FNV_OFFSET_LO = 0x84222325
const FNV_PRIME_LOW = 0x1b3
const UINT32 = 0x100000000

function fnv1a64(input: string): string {
  let hi = FNV_OFFSET_HI
  let lo = FNV_OFFSET_LO
  for (let i = 0; i < input.length; i++) {
    lo = (lo ^ input.charCodeAt(i)) >>> 0
    const loProduct = lo * FNV_PRIME_LOW
    const carry = Math.floor(loProduct / UINT32)
    hi = (hi * FNV_PRIME_LOW + carry + ((lo << 8) >>> 0)) >>> 0
    lo = loProduct >>> 0
  }
  return hi.toString(16).padStart(8, '0') + lo.toString(16).padStart(8, '0')
}

/** Build the default weak ETag (`W/"<hash>"`) from the body. */
export function weakEtag(body: string): string {
  return `W/"${fnv1a64(body)}"`
}

// A value already shaped like an ETag (`"…"` or `W/"…"`), per RFC 9110 §8.8.3.
const LOOKS_LIKE_ETAG = /^(W\/)?"[^"]*"$/

/** Use a tag verbatim if it already looks like an ETag (`"…"` / `W/"…"`), otherwise wrap it as a weak validator. */
export function normalizeEtag(tag: string): string {
  return LOOKS_LIKE_ETAG.test(tag) ? tag : `W/"${tag}"`
}

/**
 * Resolve the ETag to send: the built-in weak hash by default, or — when `custom` is given — its return value for the body, normalized by `normalizeEtag`.
 */
export function resolveEtag(body: string, custom?: (body: string) => string): string {
  return custom ? normalizeEtag(custom(body)) : weakEtag(body)
}
