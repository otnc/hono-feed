::kiritan{switcher}

:::kiritan{locale=en}
# Deprecation codes

`hono-feed` logs a one-time, coded `DeprecationWarning` when you opt into a version it still supports but no longer recommends. Each code is stable across releases, fires at most once per process (per code), and is emitted through `process.emitWarning` on Node or `console.warn` on edge runtimes (see `src/utils/deprecation.ts`).

To silence any of them: pass `suppressDeprecationWarnings: true`, set the `HONO_FEED_NO_DEPRECATION` env var, or run Node with `--no-deprecation`.

| Code | Triggered by | Message | Prefer instead |
| --- | --- | --- | --- |
| `HONOFEED_DEP0001` | `rssVersion` set to `'0.90'`, `'0.91'`, `'0.92'`, `'0.93'`, or `'0.94'` | `RSS {version} is an obsolete format; prefer RSS 2.0 (rssVersion: '2.0').` | `rssVersion: '2.0'` |
| `HONOFEED_DEP0002` | `atomVersion` set to `'0.3'` | `Atom 0.3 is deprecated (superseded by Atom 1.0, RFC 4287); prefer atomVersion: '1.0'.` | `atomVersion: '1.0'` |
| `HONOFEED_DEP0003` | `jsonFeedVersion` set to `'1'` | `JSON Feed 1.0 is superseded by 1.1; prefer jsonFeedVersion: '1.1'.` | `jsonFeedVersion: '1.1'` |

Note: RSS `1.0` and `1.1` (the RDF family) are **not** deprecated — they're fully supported alternates for consumers that specifically want RDF, so selecting them logs nothing.

## Adding a new code

See "Adding a feed version" in [CONTRIBUTING.md](CONTRIBUTING.md) — assign the next `HONOFEED_DEP00NN` code and add a row to the table above.
:::
:::kiritan{locale=ja}
# 非推奨コード

`hono-feed` は、まだサポートしているものの推奨はしなくなったバージョンを選ぶと、コード付きの `DeprecationWarning` を一度だけ出力します。各コードはリリースをまたいで変わらず、プロセス内でコードごとに最大 1 回だけ出力されます。出力には、Node では `process.emitWarning`、エッジランタイムでは `console.warn` を使います (`src/utils/deprecation.ts` を参照)。

警告を止めるには、`suppressDeprecationWarnings: true` を指定するか、環境変数 `HONO_FEED_NO_DEPRECATION` を設定するか、Node を `--no-deprecation` で起動します。

| コード | 発生条件 | メッセージ | 代わりに使うもの |
| --- | --- | --- | --- |
| `HONOFEED_DEP0001` | `rssVersion` に `'0.90'`、`'0.91'`、`'0.92'`、`'0.93'`、`'0.94'` のいずれかを指定した | `RSS {version} is an obsolete format; prefer RSS 2.0 (rssVersion: '2.0').` | `rssVersion: '2.0'` |
| `HONOFEED_DEP0002` | `atomVersion` に `'0.3'` を指定した | `Atom 0.3 is deprecated (superseded by Atom 1.0, RFC 4287); prefer atomVersion: '1.0'.` | `atomVersion: '1.0'` |
| `HONOFEED_DEP0003` | `jsonFeedVersion` に `'1'` を指定した | `JSON Feed 1.0 is superseded by 1.1; prefer jsonFeedVersion: '1.1'.` | `jsonFeedVersion: '1.1'` |

補足: RSS `1.0` と `1.1` (RDF 系統)は非推奨では**ありません**。RDF を求める相手のための代替として完全にサポートしているので、選んでも警告は出ません。

## 新しいコードを追加する

[CONTRIBUTING.ja.md](CONTRIBUTING.ja.md) の"フィードのバージョンを追加する"を参照してください。次の `HONOFEED_DEP00NN` コードを割り当て、上の表に行を追加します。
:::
