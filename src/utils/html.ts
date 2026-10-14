import { hasIriScheme } from './url'

// Everything the scanner must step over untouched, then the one thing it rewrites: a start tag. Comments, CDATA and the bodies of <script>/<style> are matched first so a "<a href>" inside them is never seen as markup. A start tag's attribute list is quote-aware, so a ">" inside a value doesn't end the tag early.
const MARKUP =
  /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<(script|style)\b[\s\S]*?<\/\1\s*>|<[a-zA-Z][^\s/>]*(?:"[^"]*"|'[^']*'|[^'">])*>/gi
const URL_ATTRIBUTE = /(\s)(src|href|poster|srcset)(\s*=\s*)(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi
const SRCSET_CANDIDATE = /(\s*)([^\s,]+)((?:\s+[^\s,]+)*)(\s*)(,|$)/g

/** Resolve one attribute value, or return `undefined` to leave it alone. */
function resolveUrl(value: string, base: string): string | undefined {
  const trimmed = value.trim()
  // A fragment, an empty value, or anything with its own scheme (https:, mailto:, data:, …) needs no base.
  if (!trimmed || trimmed.startsWith('#') || hasIriScheme(trimmed)) return undefined
  try {
    return new URL(trimmed, base).href
  } catch {
    return undefined
  }
}

// Only "&amp;" is decoded and re-encoded; a value with any other entity is too ambiguous to rewrite safely, so it's skipped.
function rewriteValue(raw: string, attribute: string, base: string): string | undefined {
  if (/&(?!amp;)[#\w]+;/.test(raw)) return undefined
  const value = raw.replace(/&amp;/g, '&')
  let resolved: string
  if (attribute === 'srcset') {
    let changed = false
    resolved = value.replace(
      SRCSET_CANDIDATE,
      (candidate, lead: string, url: string, descriptor: string, trail: string, comma: string) => {
        const absolute = resolveUrl(url, base)
        if (absolute === undefined) return candidate
        changed = true
        return `${lead}${absolute}${descriptor}${trail}${comma}`
      },
    )
    if (!changed) return undefined
  } else {
    const absolute = resolveUrl(value, base)
    if (absolute === undefined) return undefined
    resolved = absolute
  }
  return resolved.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

/**
 * Rewrite relative `src` / `href` / `poster` / `srcset` attribute values in an HTML fragment to absolute URLs against `base`. Deliberately conservative: only attribute values inside start tags are touched — never text, comments, CDATA, or `<script>` / `<style>` bodies — and anything already absolute, a fragment, or carrying an unusual entity is left exactly as written.
 */
export function absolutizeHtml(html: string, base: string): string {
  return html.replace(MARKUP, (markup) => {
    if (!markup.startsWith('<') || /^<(?:!|script|style)/i.test(markup)) return markup
    return markup.replace(
      URL_ATTRIBUTE,
      (match, space: string, name: string, eq: string, dq?: string, sq?: string, bare?: string) => {
        const raw = dq ?? sq ?? bare ?? ''
        const rewritten = rewriteValue(raw, name.toLowerCase(), base)
        return rewritten === undefined ? match : `${space}${name}${eq}"${rewritten}"`
      },
    )
  })
}
