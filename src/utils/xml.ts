// Minimal XML builder: build a node tree, then serialize with optional pretty-printing.
// Text nodes are auto-escaped; raw XML (e.g. CDATA) is inserted via `raw()`.

export type AttrValue = string | number | boolean | null | undefined

export type Attrs = Record<string, AttrValue>

export type Node = string | RawNode | ElNode

export interface RawNode {
  kind: 'raw'
  value: string
}

export interface ElNode {
  kind: 'el'
  name: string
  attrs?: Attrs
  children?: Node[]
}

// Characters forbidden in XML 1.0: the C0 controls except tab/LF/CR (\u0009 \u000A \u000D),
// the noncharacters \uFFFE/\uFFFF, and unpaired surrogates. None has an escaped form — not
// even a character reference — so the only valid output is to remove them. No `u` flag, so the
// surrogate alternatives match individual UTF-16 code units.
const INVALID_XML_CHARS =
  // biome-ignore lint/suspicious/noControlCharactersInRegex: matching these chars is the intent
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g

/** Drop characters that cannot legally appear anywhere in an XML 1.0 document. */
export function stripInvalidXmlChars(s: string): string {
  return s.replace(INVALID_XML_CHARS, '')
}

const TEXT_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;' }

/** Escape `& < >` for text nodes (after dropping characters invalid in XML). */
export function escapeText(s: string): string {
  return stripInvalidXmlChars(s).replace(/[&<>]/g, (ch) => TEXT_ESCAPES[ch])
}

// Beyond `& < > " '`, the whitespace characters tab/LF/CR are emitted as numeric references:
// a parser normalizes literal ones to spaces on read, so this is what preserves them round-trip.
const ATTR_ESCAPES: Record<string, string> = {
  ...TEXT_ESCAPES,
  '"': '&quot;',
  "'": '&apos;',
  '\t': '&#x9;',
  '\n': '&#xA;',
  '\r': '&#xD;',
}

/** Escape an attribute value: `& < > " '` plus tab/LF/CR as numeric references. */
export function escapeAttr(s: string): string {
  return stripInvalidXmlChars(s).replace(/[&<>"'\t\n\r]/g, (ch) => ATTR_ESCAPES[ch])
}

/**
 * Wrap in CDATA, splitting any `]]>` so the section cannot be broken. Characters invalid in
 * XML are dropped first — CDATA changes how `& < >` are read, but cannot legalize them.
 */
export function cdata(s: string): string {
  return `<![CDATA[${stripInvalidXmlChars(s).replace(/]]>/g, ']]]]><![CDATA[>')}]]>`
}

export function raw(value: string): RawNode {
  return { kind: 'raw', value }
}

export function el(name: string, attrs?: Attrs, children?: Node[] | Node): ElNode {
  const ch = children === undefined ? undefined : Array.isArray(children) ? children : [children]
  return { kind: 'el', name, attrs, children: ch }
}

function renderAttrs(attrs?: Attrs): string {
  if (!attrs) return ''
  let out = ''
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue
    if (v === true) {
      out += ` ${k}`
      continue
    }
    out += ` ${k}="${escapeAttr(String(v))}"`
  }
  return out
}

// depth < 0 renders compact (no newlines/indentation).
function render(node: Node, depth: number): string {
  if (typeof node === 'string') return escapeText(node)
  if (node.kind === 'raw') return node.value

  const pretty = depth >= 0
  const pad = pretty ? '  '.repeat(depth) : ''
  const open = `<${node.name}${renderAttrs(node.attrs)}`
  const children = node.children

  if (!children || children.length === 0) return `${pad}${open}/>`

  // Keep a single text/raw child on the same line (leaf element).
  const inlineOnly =
    children.length === 1 && (typeof children[0] === 'string' || children[0].kind === 'raw')

  if (!pretty || inlineOnly) {
    const inner = children.map((c) => render(c, -1)).join('')
    return `${pad}${open}>${inner}</${node.name}>`
  }

  const inner = children.map((c) => render(c, depth + 1)).join('\n')
  return `${pad}${open}>\n${inner}\n${pad}</${node.name}>`
}

export interface DocumentOptions {
  pretty?: boolean
  /** XML declaration version. Default '1.0'. */
  version?: string
}

/** Serialize a root node into a full document with the XML declaration. */
export function xmlDocument(root: Node, opts: DocumentOptions = {}): string {
  const decl = `<?xml version="${opts.version ?? '1.0'}" encoding="utf-8"?>`
  const body = render(root, opts.pretty ? 0 : -1)
  return opts.pretty ? `${decl}\n${body}` : `${decl}${body}`
}
