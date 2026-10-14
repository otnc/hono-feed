import { describe, expect, it } from 'vitest'
import { absolutizeHtml } from './html'

const base = 'https://example.com/blog/'

describe('absolutizeHtml', () => {
  it('resolves relative src, href and poster against the base', () => {
    expect(
      absolutizeHtml('<img src="/a.png"><a href="post">x</a><video poster="p.jpg">', base),
    ).toBe(
      '<img src="https://example.com/a.png"><a href="https://example.com/blog/post">x</a><video poster="https://example.com/blog/p.jpg">',
    )
  })

  it('handles single-quoted and unquoted values, and normalizes them to double quotes', () => {
    expect(absolutizeHtml("<a href='/x'>a</a><a href=/y>b</a>", base)).toBe(
      '<a href="https://example.com/x">a</a><a href="https://example.com/y">b</a>',
    )
  })

  it('resolves protocol-relative URLs', () => {
    expect(absolutizeHtml('<img src="//cdn.test/a.png">', base)).toBe(
      '<img src="https://cdn.test/a.png">',
    )
  })

  it('leaves absolute URLs, fragments, empty values and other schemes alone', () => {
    const html =
      '<a href="https://a.test/">a</a><a href="#top">b</a><a href="">c</a><a href="mailto:a@b.c">d</a><img src="data:image/png;base64,AAAA"><a href="tel:1">e</a>'
    expect(absolutizeHtml(html, base)).toBe(html)
  })

  it('resolves each srcset candidate and keeps its descriptor', () => {
    expect(
      absolutizeHtml('<img srcset="a.png 1x, /b.png 2x, https://c.test/c.png 3x">', base),
    ).toBe(
      '<img srcset="https://example.com/blog/a.png 1x, https://example.com/b.png 2x, https://c.test/c.png 3x">',
    )
    expect(absolutizeHtml('<img srcset="a.png 480w,b.png 800w">', base)).toBe(
      '<img srcset="https://example.com/blog/a.png 480w,https://example.com/blog/b.png 800w">',
    )
  })

  it('does not touch text, comments, CDATA, script or style bodies', () => {
    const html =
      '<p>see href="/x" and src="/y"</p><!-- <a href="/c"> --><![CDATA[<a href="/d">]]><script>var s = \'<a href="/e">\'</script><style>a[href="/f"]{}</style>'
    expect(absolutizeHtml(html, base)).toBe(html)
  })

  it('does not end a tag early on a ">" inside a quoted attribute value', () => {
    expect(absolutizeHtml('<a title="a > b" href="/x">t</a>', base)).toBe(
      '<a title="a > b" href="https://example.com/x">t</a>',
    )
  })

  it('does not rewrite attributes that merely end in src/href', () => {
    const html = '<div data-src="/a" data-href="/b" nosrc="/c">'
    expect(absolutizeHtml(html, base)).toBe(html)
  })

  it('keeps "&amp;" in a query string intact', () => {
    expect(absolutizeHtml('<a href="/s?a=1&amp;b=2">x</a>', base)).toBe(
      '<a href="https://example.com/s?a=1&amp;b=2">x</a>',
    )
  })

  it('skips a value carrying an entity other than &amp;', () => {
    const html = '<a href="/a&#47;b">x</a>'
    expect(absolutizeHtml(html, base)).toBe(html)
  })

  it('is case-insensitive about tag and attribute names', () => {
    expect(absolutizeHtml('<IMG SRC="/a.png">', base)).toBe('<IMG SRC="https://example.com/a.png">')
  })

  it('returns an empty string unchanged', () => {
    expect(absolutizeHtml('', base)).toBe('')
  })
})
