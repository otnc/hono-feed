# Deprecation codes

`hono-feed` logs a one-time, coded `DeprecationWarning` when you opt into a version it still
supports but no longer recommends. Each code is stable across releases, fires at most once per
process (per code), and is emitted through `process.emitWarning` on Node or `console.warn` on
edge runtimes (see `src/utils/deprecation.ts`).

To silence any of them: pass `suppressDeprecationWarnings: true`, set the
`HONO_FEED_NO_DEPRECATION` env var, or run Node with `--no-deprecation`.

| Code | Triggered by | Message | Prefer instead |
| --- | --- | --- | --- |
| `HONOFEED_DEP0001` | `rssVersion` set to `'0.90'`, `'0.91'`, `'0.92'`, `'0.93'`, or `'0.94'` | `RSS {version} is an obsolete format; prefer RSS 2.0 (rssVersion: '2.0').` | `rssVersion: '2.0'` |
| `HONOFEED_DEP0002` | `atomVersion` set to `'0.3'` | `Atom 0.3 is deprecated (superseded by Atom 1.0, RFC 4287); prefer atomVersion: '1.0'.` | `atomVersion: '1.0'` |
| `HONOFEED_DEP0003` | `jsonFeedVersion` set to `'1'` | `JSON Feed 1.0 is superseded by 1.1; prefer jsonFeedVersion: '1.1'.` | `jsonFeedVersion: '1.1'` |

Note: RSS `1.0` and `1.1` (the RDF family) are **not** deprecated — they're fully supported
alternates for consumers that specifically want RDF, so selecting them logs nothing.

## Adding a new code

See "Adding a feed version" in [CONTRIBUTING.md](CONTRIBUTING.md) — assign the next
`HONOFEED_DEP00NN` code and add a row to the table above.
