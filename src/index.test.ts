import { describe, expect, it } from 'vitest'
import { validateInput } from './index'

// validateInput is the same per-format validation serveFeed runs internally; exporting it lets
// low-level toRSS/toAtom/toJSONFeed callers opt into the same checks (see README "Low-level
// serializers"). This guards the export itself — validation behaviour is covered in validate.test.ts.
describe('validateInput (public export)', () => {
  it('is importable from the package root', () => {
    expect(typeof validateInput).toBe('function')
  })

  it('throws the documented message for missing input', () => {
    expect(() =>
      validateInput({ options: { title: '', link: 'https://example.com/' }, items: [] }, 'rss'),
    ).toThrow(/feed "title" is required/)
  })

  it('applies format-specific rules (Atom relative id) not enforced by the serializers alone', () => {
    expect(() =>
      validateInput(
        { options: { title: 'T', id: '/not-absolute', updated: new Date() }, items: [] },
        'atom',
      ),
    ).toThrow(/absolute IRI/)
  })
})
