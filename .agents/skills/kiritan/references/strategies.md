# Document strategies: `catalog` and `sidecar`

Detail for the two document strategies beyond `inline` (whose directive syntax is covered in SKILL.md). A project picks one per source, in its config's `sources[].strategy` — check that before adding or changing anything, and don't mix strategies within one source.

## `catalog` strategy

```md
:::kiritan{#usage-intro}
## Usage
This is the base-locale original text.
:::
```

- The id is author-assigned and stable — never auto-derived from position or content hash. Reuse the same id when rewording the surrounding prose; only change it if the segment's meaning truly changed.
- Translations live in a sibling `<base>.<locale>.catalog.json`, keyed by id: `{ "usage-intro": { "text": "...", "machine": true, "hash": "..." } }`. Don't hand-write the `hash` field — it's maintained by `kiritan extract`/`translate`.
- After adding a new `:::kiritan{#<id>}` block, run `kiritan extract` to scaffold its empty catalog entry before it can be translated.

## `sidecar` strategy

A whole separate file per locale (`README.ja.md` next to `README.base.md`), translated by hand or via `kiritan translate` (only if the source configures `translate.middlewares` **and** `translate.auto: true`). What `translate` writes carries a `<!-- kiritan:machine -->` line, which `kiritan check` reports as `machine` until you have reviewed the translation and deleted that line. A `<!-- kiritan:hash ... -->` comment near the top records the base content's hash at translation time; don't remove or hand-edit it, or `kiritan check` loses the ability to detect that file going stale.
