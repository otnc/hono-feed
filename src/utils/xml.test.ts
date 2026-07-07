import { describe, expect, it } from 'vitest'
import {
  cdata,
  el,
  escapeAttr,
  escapeText,
  raw,
  specToNode,
  stripInvalidXmlChars,
  xmlDocument,
} from './xml'

// Returns true if the string contains any character forbidden by the XML 1.0 Char production.
function hasInvalidXmlChar(s: string): boolean {
  for (const ch of s) {
    const cp = ch.codePointAt(0) as number
    const ok =
      cp === 0x09 ||
      cp === 0x0a ||
      cp === 0x0d ||
      (cp >= 0x20 && cp <= 0xd7ff) ||
      (cp >= 0xe000 && cp <= 0xfffd) ||
      cp >= 0x10000
    if (!ok) return true
  }
  return false
}

describe('xml utils', () => {
  it('renders compact, pretty, and a custom declaration version', () => {
    const doc = el('root', { a: '1' }, [el('child', undefined, 'x'), raw('<r/>')])
    expect(xmlDocument(doc)).toBe(
      '<?xml version="1.0" encoding="utf-8"?><root a="1"><child>x</child><r/></root>',
    )
    expect(xmlDocument(doc, { pretty: true })).toContain('\n  <child>x</child>')
    expect(xmlDocument(doc, { version: '1.1' }).startsWith('<?xml version="1.1"')).toBe(true)
  })

  it('omits null/undefined/false attributes and renders boolean true bare', () => {
    expect(xmlDocument(el('x', { a: undefined, b: false, c: true, d: null }))).toContain('<x c/>')
  })
})

describe('escapeText', () => {
  it('escapes the three markup-significant characters', () => {
    expect(escapeText('a & b < c > d')).toBe('a &amp; b &lt; c &gt; d')
  })

  it('escapes & before the others so output is not double-escaped', () => {
    // A literal "&lt;" must become "&amp;lt;", not "&lt;".
    expect(escapeText('&lt; &amp; &')).toBe('&amp;lt; &amp;amp; &amp;')
  })

  it('escapes every occurrence, not just the first', () => {
    expect(escapeText('&&<<>>')).toBe('&amp;&amp;&lt;&lt;&gt;&gt;')
  })

  it('leaves quotes untouched (they are only significant in attributes)', () => {
    expect(escapeText(`"'`)).toBe(`"'`)
  })

  it('preserves tab, newline and carriage return in text', () => {
    expect(escapeText('a\tb\nc\rd')).toBe('a\tb\nc\rd')
  })

  it('keeps multi-byte and astral (emoji) characters intact', () => {
    expect(escapeText('日本語 — 𝕏 😀')).toBe('日本語 — 𝕏 😀')
  })
})

describe('escapeAttr', () => {
  it('escapes quotes and apostrophes on top of the text characters', () => {
    expect(escapeAttr(`"q" 'r' & < >`)).toBe('&quot;q&quot; &apos;r&apos; &amp; &lt; &gt;')
  })

  it('escapes tab/newline/CR as numeric references so they survive parsing', () => {
    // Left literal, an XML parser would normalize these to spaces; the references round-trip.
    expect(escapeAttr('a\tb\nc\rd')).toBe('a&#x9;b&#xA;c&#xD;d')
  })

  it('does not double-escape the ampersands it introduces', () => {
    expect(escapeAttr('"')).toBe('&quot;')
    expect(escapeAttr('&"')).toBe('&amp;&quot;')
  })
})

describe('cdata', () => {
  it('splits ]]> so the section cannot be terminated early', () => {
    expect(cdata('a]]>b')).toBe('<![CDATA[a]]]]><![CDATA[>b]]>')
  })

  it('splits every ]]> occurrence', () => {
    expect(cdata(']]>]]>')).toBe('<![CDATA[]]]]><![CDATA[>]]]]><![CDATA[>]]>')
  })

  it('does not escape markup characters (that is the point of CDATA)', () => {
    expect(cdata('<b>&"</b>')).toBe('<![CDATA[<b>&"</b>]]>')
  })
})

describe('stripInvalidXmlChars (XML 1.0 Char production)', () => {
  it('removes NUL and the C0 control characters', () => {
    // The full forbidden C0 range, minus the three whitespace controls that are allowed.
    for (let cp = 0; cp < 0x20; cp++) {
      const allowed = cp === 0x09 || cp === 0x0a || cp === 0x0d
      const out = stripInvalidXmlChars(`x${String.fromCharCode(cp)}y`)
      expect(out).toBe(allowed ? `x${String.fromCharCode(cp)}y` : 'xy')
    }
  })

  it('keeps the three allowed whitespace controls', () => {
    expect(stripInvalidXmlChars('a\tb\nc\rd')).toBe('a\tb\nc\rd')
  })

  it('removes the U+FFFE / U+FFFF noncharacters', () => {
    expect(stripInvalidXmlChars('a\uFFFEb\uFFFFc')).toBe('abc')
  })

  it('drops unpaired surrogates but keeps valid surrogate pairs', () => {
    expect(stripInvalidXmlChars('a\uD800b')).toBe('ab') // lone high surrogate
    expect(stripInvalidXmlChars('a\uDC00b')).toBe('ab') // lone low surrogate
    expect(stripInvalidXmlChars('a\u{1F600}b')).toBe('a\u{1F600}b') // 😀 (valid pair)
  })

  it('leaves a clean string unchanged', () => {
    const clean = 'Hello, 世界! <ok> & "quoted"'
    expect(stripInvalidXmlChars(clean)).toBe(clean)
  })
})

describe('invalid characters cannot escape through any path', () => {
  // The whole point: a control character must never reach the output, regardless of the route
  // it takes (text node, attribute value, or CDATA section).
  const dirty = 'before\u0001after'

  it('is stripped from text nodes', () => {
    expect(escapeText(dirty)).toBe('beforeafter')
  })

  it('is stripped from attribute values', () => {
    expect(escapeAttr(dirty)).toBe('beforeafter')
    expect(xmlDocument(el('x', { a: dirty }))).toBe(
      '<?xml version="1.0" encoding="utf-8"?><x a="beforeafter"/>',
    )
  })

  it('is stripped from CDATA content', () => {
    expect(cdata(dirty)).toBe('<![CDATA[beforeafter]]>')
  })

  it('produces a document with no invalid characters anywhere', () => {
    const doc = xmlDocument(el('item', { title: dirty }, [el('body', undefined, dirty)]))
    expect(hasInvalidXmlChar(doc)).toBe(false)
  })
})

describe('specToNode', () => {
  it('renders a leaf spec with attrs and text, escaped like a built-in element', () => {
    const node = specToNode({ name: 'itunes:image', attrs: { href: 'a & b' }, text: '<x>' })
    expect(xmlDocument(node)).toBe(
      '<?xml version="1.0" encoding="utf-8"?><itunes:image href="a &amp; b">&lt;x&gt;</itunes:image>',
    )
  })

  it('renders nested children recursively', () => {
    const node = specToNode({
      name: 'parent',
      children: [
        { name: 'child', text: 'a' },
        { name: 'child', text: 'b' },
      ],
    })
    expect(xmlDocument(node)).toBe(
      '<?xml version="1.0" encoding="utf-8"?><parent><child>a</child><child>b</child></parent>',
    )
  })

  it('ignores text when children is set', () => {
    const node = specToNode({ name: 'x', children: [{ name: 'y' }], text: 'ignored' })
    expect(xmlDocument(node)).not.toContain('ignored')
  })

  it('renders a self-closing element when neither children nor text is set', () => {
    expect(xmlDocument(specToNode({ name: 'x' }))).toBe(
      '<?xml version="1.0" encoding="utf-8"?><x/>',
    )
  })
})
