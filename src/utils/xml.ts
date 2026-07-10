// Minimal XML builder: build a node tree, then serialize with optional pretty-printing.
// Text nodes are auto-escaped; raw XML (e.g. CDATA) is inserted via `raw()`.

import type { XmlElementSpec } from '../types'

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

// A literal CR (or the CR half of a CRLF pair) is normalized to LF on parse (XML 1.0 §2.11 —
// end-of-line handling applies uniformly, text content included), so it's emitted as a numeric
// reference to survive round-trip; tab/LF need no such escaping in text content.
const TEXT_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '\r': '&#xD;',
}

/** Escape `& < >` (plus CR, so it survives §2.11 normalization) for text nodes, after dropping
 * characters invalid in XML. */
export function escapeText(s: string): string {
  return stripInvalidXmlChars(s).replace(/[&<>\r]/g, (ch) => TEXT_ESCAPES[ch])
}

// Attribute-value normalization (XML 1.0 §3.3.3) additionally flattens any literal tab/LF to a
// space — on top of §2.11's CR handling above — so attribute values need tab/LF as numeric
// references too, beyond what escapeText requires for text content.
const ATTR_ESCAPES: Record<string, string> = {
  ...TEXT_ESCAPES,
  '"': '&quot;',
  "'": '&apos;',
  '\t': '&#x9;',
  '\n': '&#xA;',
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

// A pragmatic ASCII subset of the XML `Name` production (letters/underscore start, then
// letters/digits/._-, with one optional namespace-prefix colon). Rejects e.g. a name
// containing `<`/`>`/whitespace, which — unlike text/attribute values — `el()` never escapes,
// since element and attribute names are structural, not content.
const XML_NAME = /^[A-Za-z_][\w.-]*(?::[A-Za-z_][\w.-]*)?$/

function assertXmlName(name: string, what: string): void {
  if (!XML_NAME.test(name)) {
    throw new TypeError(`hono-feed: invalid XML ${what}: ${JSON.stringify(name)}`)
  }
}

/**
 * Convert a public, JSON-shaped `XmlElementSpec` (the `customXml` escape hatch) into a `Node`.
 * Goes through `el()` like every built-in element, so attrs/text are escaped the same way.
 * The element name and any attribute keys are validated against the XML `Name` production —
 * unlike attribute/text values, names are never escaped, so an invalid one would inject raw
 * markup into the document.
 */
export function specToNode(spec: XmlElementSpec): Node {
  assertXmlName(spec.name, 'element name')
  for (const key of Object.keys(spec.attrs ?? {})) assertXmlName(key, 'attribute name')

  if (spec.children?.length) {
    return el(spec.name, spec.attrs, spec.children.map(specToNode))
  }
  return el(spec.name, spec.attrs, spec.text)
}

function renderAttrs(attrs?: Attrs): string {
  if (!attrs) return ''
  let out = ''
  for (const [k, v] of Object.entries(attrs)) {
    // `false` (like `null`/`undefined`) omits the attribute; `true` still needs a value —
    // XML 1.0 has no valueless/boolean attribute syntax — so it falls through to `String(v)`.
    if (v === undefined || v === null || v === false) continue
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
