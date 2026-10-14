<div align="center">
  <a href="https://github.com/otnc/hono-feed">
    <img src="./assets/logo.png" width="500" height="auto" alt="hono-feed"/>
  </a>
</div>

<hr />

::kiritan{switcher}

[![npm](https://img.shields.io/npm/v/hono-feed)](https://www.npmjs.com/package/hono-feed) [![npm](https://img.shields.io/npm/dm/hono-feed)](https://www.npmjs.com/package/hono-feed) [![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/otnc/hono-feed/ci.yml?branch=main)](https://github.com/otnc/hono-feed/actions) [![GitHub](https://img.shields.io/github/license/otnc/hono-feed)](https://github.com/otnc/hono-feed/blob/main/LICENSE) [![GitHub commit activity](https://img.shields.io/github/commit-activity/m/otnc/hono-feed)](https://github.com/otnc/hono-feed/pulse) [![GitHub last commit](https://img.shields.io/github/last-commit/otnc/hono-feed)](https://github.com/otnc/hono-feed/commits/main)

:::kiritan{locale=en}
> RSS, Atom and JSON Feed for [Hono](https://hono.dev) — done right.

Serving a feed sounds simple, but the details bite: dates have to be in the exact format each spec wants, text has to be XML-escaped, conditional requests should return `304`, and readers ask for different formats through the `Accept` header. `hono-feed` takes care of all of that. You describe your feed once; it returns a correct HTTP `Response`.

> [!NOTE]
> Zero runtime dependencies, built on Web Standards alone — so it runs anywhere Hono does: Cloudflare Workers, Deno, Bun and Node. `hono` itself is a peer dependency (`>=4`).
:::
:::kiritan{locale=ja}
> [Hono](https://hono.dev) のための RSS、Atom、JSON Feed。正しいものを、手間なく。

フィードの配信は簡単そうに見えて、細部でつまずきます。日付は仕様ごとに決まった形式で書く必要があり、テキストは XML エスケープが必要で、条件付きリクエストには `304` を返すべきで、リーダーは `Accept` ヘッダーでそれぞれ別のフォーマットを求めてきます。`hono-feed` はこれらをまとめて引き受けます。フィードを一度記述すれば、正しい HTTP `Response` が返ります。

> [!NOTE]
> 実行時の依存はゼロで、Web 標準だけで作られています。そのため Hono が動く場所ならどこでも動きます。Cloudflare Workers、Deno、Bun、Node が対象です。`hono` 自体は peer dependency (`>=4`)です。
:::

:::kiritan{locale=en}
## Why hono-feed?

Hono ships no feed helper, so you have two usual options — hand-roll the XML, or pull in a general feed library and wire the HTTP layer around it. hono-feed replaces both.

### vs. hand-rolling the XML
:::
:::kiritan{locale=ja}
## なぜ hono-feed か

Hono にはフィード用のヘルパーが付属していません。そのため、XML を手書きするか、汎用のフィードライブラリを導入して HTTP の層を自分で組むか、どちらかになりがちです。hono-feed はその両方を置き換えます。

### 手書き XML との比較
:::

```ts
// ESM
import { Hono } from 'hono'

// CJS
const { Hono } = require('hono')

const app = new Hono()

// Before — fine in a demo, fragile in production
app.get('/feed', (c) => {
  const items = posts
    .map(
      (p) => `<item>
      <title>${p.title}</title>
      <link>${p.url}</link>
      <pubDate>${p.date.toUTCString()}</pubDate>
      <description>${p.body}</description>
    </item>`,
    )
    .join('')

  const xml = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <title>Example Blog</title>
  ${items}
</channel></rss>`

  return c.body(xml, 200, { 'Content-Type': 'application/rss+xml' })
})
```

:::kiritan{locale=en}
It breaks the first time a title contains `&` or `<` (now it's invalid XML), `toUTCString()` isn't quite the RFC-822 date RSS expects, and you still have no Atom or JSON output, no `ETag` / `304`, no `HEAD`, and no caching headers.
:::
:::kiritan{locale=ja}
タイトルに `&` や `<` が含まれた時点で壊れます(XML として不正になります)。`toUTCString()` は RSS が期待する RFC-822 形式の日付とは厳密には一致しません。しかも Atom や JSON の出力はなく、`ETag` / `304`、`HEAD`、キャッシュヘッダーもありません。
:::

```ts
// ESM
import { Hono } from 'hono'
import { serveFeed } from 'hono-feed'

// CJS
const { Hono } = require('hono')
const { serveFeed } = require('hono-feed')

const app = new Hono()

// After — correct by construction, and shorter
app.get('/feed', (c) =>
  serveFeed(c, {
    options: { title: 'Example Blog', link: 'https://example.com/', author: { name: 'You' } },
    items: posts.map((p) => ({ title: p.title, link: p.url, published: p.date, content: p.body })),
  }),
)
```

:::kiritan{locale=en}
### vs. a feed library

Libraries like [`feed`](https://github.com/jpmonette/feed) or [`rss`](https://github.com/dylang/node-rss) do handle the escaping and date formats — but they hand you a *string*. The HTTP layer is still yours to build:
:::
:::kiritan{locale=ja}
### フィードライブラリとの比較

[`feed`](https://github.com/jpmonette/feed) や [`rss`](https://github.com/dylang/node-rss) のようなライブラリは、エスケープや日付形式を処理してくれます。ただし渡されるのは*文字列*です。HTTP の層は、やはり自分で組む必要があります。
:::

```ts
// ESM
import { Hono } from 'hono'
import { Feed as FeedKit } from 'feed'

// CJS
const { Hono } = require('hono')
const { Feed: FeedKit } = require('feed')

const app = new Hono()

// Before — the library builds the document; you build the response
app.get('/feed', (c) => {
  const feed = new FeedKit({
    title: 'Example Blog',
    id: 'https://example.com/',
    link: 'https://example.com/',
    copyright: '',
  })
  for (const p of posts) {
    feed.addItem({ title: p.title, link: p.url, date: p.date, content: p.body })
  }

  // You still choose the format, set the content type, and add content
  // negotiation, ETag/304, HEAD and caching by hand:
  return c.body(feed.rss2(), 200, { 'Content-Type': 'application/rss+xml' })
})
```

```ts
// ESM
import { Hono } from 'hono'
import { serveFeed } from 'hono-feed'

// CJS
const { Hono } = require('hono')
const { serveFeed } = require('hono-feed')

const app = new Hono()

// After — same as above: one serveFeed call, with negotiation, 304 and caching included
app.get('/feed', (c) =>
  serveFeed(c, {
    options: { title: 'Example Blog', link: 'https://example.com/', author: { name: 'You' } },
    items: posts.map((p) => ({ title: p.title, link: p.url, published: p.date, content: p.body })),
  }),
)
```

:::kiritan{locale=en}
There's also a portability catch. Many feed libraries are written for Node and either use Node built-ins (`Buffer`, `stream`, `fs`) or depend on packages that do. On Cloudflare Workers, Vercel Edge, Deno or Bun that can mean reaching for polyfills, enabling a `nodejs_compat` flag, or finding it just won't run. hono-feed has **zero dependencies** and uses only Web Standard APIs, so the same code runs unchanged on every one of them.

| | Hand-rolled | A feed library | hono-feed |
| --- | --- | --- | --- |
| XML escaping & date formats | your job | handled | handled |
| RSS + Atom + JSON | one format, more routes | usually all three | all three, negotiated |
| HTTP layer (negotiation, `ETag` / `304`, `HEAD`, caching) | DIY | DIY | built in |
| Output | a string | a string | a `Response` |
| Workers / Vercel / Deno / Bun / Node | up to your code | depends on its deps | runs everywhere (Web Standard) |
:::
:::kiritan{locale=ja}
移植性にも落とし穴があります。多くのフィードライブラリは Node 向けに書かれており、Node の組み込み (`Buffer`、`stream`、`fs`)を使うか、それらを使うパッケージに依存しています。Cloudflare Workers、Vercel Edge、Deno、Bun では、ポリフィルが必要になったり、`nodejs_compat` フラグを有効にする必要が出たり、そもそも動かなかったりします。hono-feed は**依存ゼロ**で、Web 標準 API だけを使うので、同じコードがどの環境でもそのまま動きます。

| | 手書き | フィードライブラリ | hono-feed |
| --- | --- | --- | --- |
| XML エスケープと日付形式 | 自分で対応 | 対応済み | 対応済み |
| RSS + Atom + JSON | 1 形式ごとにルートが増える | たいてい 3 つとも対応 | 3 つとも対応、ネゴシエーション付き |
| HTTP の層 (ネゴシエーション、`ETag` / `304`、`HEAD`、キャッシュ) | 自前 | 自前 | 組み込み済み |
| 出力 | 文字列 | 文字列 | `Response` |
| Workers / Vercel / Deno / Bun / Node | コード次第 | 依存パッケージ次第 | どこでも動く (Web 標準) |
:::

:::kiritan{locale=en}
## Install
:::
:::kiritan{locale=ja}
## インストール
:::

```sh
npm install hono-feed # or: pnpm add hono-feed / bun add hono-feed
```

:::kiritan{locale=en}
## Quick start

Build a feed, add your items, and hand it to `serveFeed`:
:::
:::kiritan{locale=ja}
## クイックスタート

フィードを作り、記事を追加して、`serveFeed` に渡します。
:::

```ts
// ESM
import { Hono } from 'hono'
import { Feed, serveFeed } from 'hono-feed'

// CJS
const { Hono } = require('hono')
const { Feed, serveFeed } = require('hono-feed')

const app = new Hono()

app.get('/feed', (c) => {
  const feed = new Feed({
    title: 'Example Blog',
    link: 'https://example.com/',
    description: 'Notes and writing',
    author: { name: 'You' }, // Atom requires an author on the feed or on every item
    updated: new Date(),
  })

  feed.addItem({
    title: 'Hello, world',
    link: 'https://example.com/hello',
    published: new Date('2026-06-29'),
    content: '<p>My first post.</p>',
  })

  // Looks at the Accept header and replies with RSS, Atom or JSON (RSS by default).
  return serveFeed(c, feed)
})

export default app
```

:::kiritan{locale=en}
That single endpoint now speaks all three formats. A feed reader gets RSS, a browser fetching `application/json` gets JSON Feed, and so on — no extra routes needed.

Prefer plain data over the builder? Pass an object instead:
:::
:::kiritan{locale=ja}
このエンドポイント 1 つで、3 つのフォーマットすべてに対応できます。フィードリーダーには RSS、`application/json` を要求するブラウザーには JSON Feed が返ります。ルートを増やす必要はありません。

ビルダーではなく単純なデータで渡したい場合は、オブジェクトを渡します。
:::

```ts
return serveFeed(c, { options: { title: 'Example Blog', updated: new Date() }, items: [] })
```

:::kiritan{locale=en}
## Choosing the format

By default the format is negotiated for you. If you'd rather pin an endpoint to one format — the classic `/rss.xml`, `/atom.xml`, `/feed.json` — just say so:
:::
:::kiritan{locale=ja}
## フォーマットの選び方

既定ではフォーマットが自動でネゴシエーションされます。従来どおり `/rss.xml`、`/atom.xml`、`/feed.json` のようにエンドポイントを 1 つのフォーマットに固定したい場合は、明示的に指定します。
:::

```ts
// ESM
import { Hono } from 'hono'
import { serveFeed } from 'hono-feed'

// CJS
const { Hono } = require('hono')
const { serveFeed } = require('hono-feed')

const app = new Hono()

// `buildFeed()` here is just your own helper returning a Feed (or `{ options, items }`).
app.get('/rss.xml', (c) => serveFeed(c, buildFeed(), { format: 'rss' }))
app.get('/atom.xml', (c) => serveFeed(c, buildFeed(), { format: 'atom' }))
app.get('/feed.json', (c) => serveFeed(c, buildFeed(), { format: 'json' }))
```

:::kiritan{locale=en}
When `format` isn't set, `serveFeed` works through these in order until one matches:

1. `?format=rss|atom|json` in the query — only if you opt in with `detectFromQuery: true` (or just `detectFormatFromQuery: true`)
2. A URL extension like `.rss` / `.atom` / `.json` / `.xml` — on by default
3. The `Accept` header, honouring q-values
4. `defaultFormat` (which is `'rss'`)

Negotiated responses carry `Vary: Accept` so caches behave; pinned ones don't, since they never change with the header.

### Choosing a version from the query

`detectFromQuery: true` also turns on version selection through `?version=`, interpreted against whichever version type the resolved format expects (`RssVersion` for `rss`, `AtomVersion` for `atom`, `JsonFeedVersion` for `json`). It only applies when the matching option isn't already pinned in code — `rssVersion` (etc.) set in `serveFeed(...)` always wins over the query.
:::
:::kiritan{locale=ja}
`format` を指定しない場合、`serveFeed` は次の順に確認し、最初に一致したものを使います。

1. クエリの `?format=rss|atom|json`。`detectFromQuery: true` (または `detectFormatFromQuery: true` だけ)で有効にした場合のみ
2. `.rss` / `.atom` / `.json` / `.xml` のような URL の拡張子。既定で有効
3. `Accept` ヘッダー (q 値を考慮)
4. `defaultFormat` (既定は `'rss'`)

ネゴシエーションした応答には `Vary: Accept` が付くので、キャッシュが正しく動きます。固定したエンドポイントはヘッダーで変わらないため、付きません。

### クエリでバージョンを選ぶ

`detectFromQuery: true` にすると、`?version=` によるバージョン選択も有効になります。値は、決まったフォーマットが期待するバージョンの型 (`rss` なら `RssVersion`、`atom` なら `AtomVersion`、`json` なら `JsonFeedVersion`)として解釈されます。対応するオプションがコードで固定されていない場合にだけ働き、`serveFeed(...)` に渡した `rssVersion` などは、常にクエリより優先されます。
:::

```ts
app.get('/feed', (c) => serveFeed(c, buildFeed(), { detectFromQuery: true }))
// GET /feed?format=rss&version=0.91
```

:::kiritan{locale=en}
A value outside the accepted set (see [Feed versions](#feed-versions)) answers `400 Bad Request`. A value that's valid but that the feed data can't satisfy — e.g. `?version=0.91` without `language` set — answers `422 Unprocessable Entity` instead of throwing, since the request is what made that version unreachable, not the server. A version pinned in code that fails the same way still throws, since that's a bug in the route, not something a request can trigger. Both error responses carry `Cache-Control: no-store` — they're not governed by the `cacheControl` option, since whether they reproduce can change independently of the URL as the underlying feed data changes.

`detectFromQuery` is a convenience switch for both `detectFormatFromQuery` and `detectVersionFromQuery` — set either one directly to turn on just format or just version detection:
:::
:::kiritan{locale=ja}
受け付ける値の範囲 ([フィードのバージョン](#フィードのバージョン)を参照)の外にある値には、`400 Bad Request` を返します。値自体は有効でも、フィードのデータがそれを満たせない場合は、例外を投げずに `422 Unprocessable Entity` を返します。たとえば `language` がないのに `?version=0.91` を指定したときです。そのバージョンに到達できなくしたのはリクエストであり、サーバーではないからです。コードで固定したバージョンが同じ理由で失敗する場合は、リクエストでは起こせないルート側の不具合なので、これまでどおり例外を投げます。どちらのエラー応答にも `Cache-Control: no-store` が付きます。再現するかどうかは、元のフィードデータが変わることで URL とは無関係に変わりうるため、`cacheControl` オプションの対象にはしていません。

`detectFromQuery` は `detectFormatFromQuery` と `detectVersionFromQuery` の両方をまとめて切り替えるスイッチです。どちらか一方だけを直接指定すれば、フォーマットだけ、またはバージョンだけの検出を有効にできます。
:::

```ts
// Only ?format= is honoured; ?version= (if present) is ignored.
app.get('/feed', (c) => serveFeed(c, buildFeed(), { detectFormatFromQuery: true }))
```

:::kiritan{locale=en}
Both query param names can be renamed, e.g. to keep URLs short:
:::
:::kiritan{locale=ja}
どちらのクエリパラメーター名も変更できます。たとえば URL を短くしたいときに使えます。
:::

```ts
app.get('/feed', (c) =>
  serveFeed(c, buildFeed(), {
    detectFromQuery: true,
    formatQueryParam: 'f',
    versionQueryParam: 'v',
  }),
)
// GET /feed?f=rss&v=0.91
```

:::kiritan{locale=en}
## Cache-Control

`cacheControl` takes a raw string, same as before — but hand-writing directives is easy to get subtly wrong (a missed comma, a misspelled directive), so it also accepts a `CacheControlDirectives` object:
:::
:::kiritan{locale=ja}
## Cache-Control

`cacheControl` はこれまでどおり生の文字列を受け取ります。ただ、ディレクティブを手書きすると、カンマの付け忘れやスペルミスのように、気づきにくい間違いをしがちです。そのため `CacheControlDirectives` オブジェクトも受け付けます。
:::

```ts
app.get('/feed', (c) =>
  serveFeed(c, buildFeed(), {
    cacheControl: { public: true, maxAge: 600, staleWhileRevalidate: 60 },
  }),
)
// Cache-Control: public, max-age=600, stale-while-revalidate=60
```

| Field | Directive |
| --- | --- |
| `public` / `private` | `public` / `private` |
| `noStore` / `noCache` | `no-store` / `no-cache` |
| `maxAge` / `sMaxAge` | `max-age=<n>` / `s-maxage=<n>` |
| `mustRevalidate` / `proxyRevalidate` | `must-revalidate` / `proxy-revalidate` |
| `immutable` | `immutable` |
| `staleWhileRevalidate` / `staleIfError` | `stale-while-revalidate=<n>` / `stale-if-error=<n>` |

:::kiritan{locale=en}
`false` still omits the header entirely, same as always.

The object form is recommended when the fields cover what you need — it can't typo a directive name or forget a comma. The raw string isn't deprecated, though: it's the header's own native shape, and it's still the way to reach directives (or vendor extensions) `CacheControlDirectives` doesn't model yet. Both forms are first-class and neither is going away.

## Skipping work on a 304

By default, answering a conditional request still costs a full round trip through your data: `serveFeed` needs the serialized body to compute its ETag, so a `304` only happens *after* you've already built the feed. If `input` is loaded from a database, that's a wasted query on every poll that finds nothing new — and feed readers poll a lot.

Two options fix this, and they can be used together:

- **`etagFrom`** — a cheap, pre-serialization validator (a content revision, a `max(updated_at)` scalar, …). `serveFeed` checks it against `If-None-Match` *before* touching `input` at all; a match answers `304` immediately.
- **A lazy `input` function** — `(): FeedInput | Feed | Promise<...>` instead of a plain value. It's only called when a response body is actually needed, so it's never invoked when `etagFrom` already short-circuited.
:::
:::kiritan{locale=ja}
`false` を指定すると、これまでどおりヘッダーを完全に省略します。

必要な項目がオブジェクトで足りるなら、オブジェクト形式をおすすめします。ディレクティブ名のタイプミスやカンマの付け忘れが起こりません。ただし生の文字列が非推奨になったわけではありません。ヘッダー本来の形であり、`CacheControlDirectives` がまだ扱っていないディレクティブ (やベンダー拡張)を使う手段として残っています。どちらの形式も正式にサポートしていて、どちらかをなくす予定はありません。

## 304 で処理を省く

既定では、条件付きリクエストに答えるときでも、データを取得し直すためのやり取りが毎回丸ごと発生します。`serveFeed` は ETag の計算にシリアライズ済みの本文を必要とするので、`304` を返せるのはフィードを組み立てた*後*になるからです。`input` をデータベースから読み込んでいる場合、新しい内容がないポーリングのたびに無駄なクエリが走ります。しかもフィードリーダーは頻繁にポーリングします。

これを解消する 2 つのオプションがあり、併用できます。

- **`etagFrom`**: シリアライズ前に取れる軽量なバリデーターです。コンテンツのリビジョンや `max(updated_at)` の値などを使います。`serveFeed` は `input` に触れる*前*に、これを `If-None-Match` と照合し、一致すれば即座に `304` を返します。
- **遅延評価の `input` 関数**: 値そのものではなく `(): FeedInput | Feed | Promise<...>` を渡します。応答の本文が実際に必要になったときにだけ呼ばれるので、`etagFrom` ですでに応答を返した場合は呼ばれません。
:::

```ts
app.get('/feed', (c) =>
  serveFeed(
    c,
    () => db.getFeedInput(), // only called when a body is actually needed
    { etagFrom: () => db.getRevision() }, // cheap — no need to load the full feed
  ),
)
```

:::kiritan{locale=en}
`etagFrom` may return synchronously or as a `Promise`; either way, `serveFeed`'s return type becomes `Response | Promise<Response>` once `etagFrom` or a lazy `input` is used (TypeScript picks this up automatically via overloads — the plain, synchronous call shown everywhere else in this README is unaffected and keeps returning a plain `Response`).

A few things worth knowing:

- Only `If-None-Match` can be checked this early — there's no `updated` date yet for `If-Modified-Since`. Per RFC 9110 §13.1.3, a request carrying `If-None-Match` ignores `If-Modified-Since` anyway, so this still covers the common revalidation case; a request with only `If-Modified-Since` resolves `input` normally.
- On a miss, the `etagFrom` value becomes the response's `ETag` (the `etag` option is ignored) — same verbatim-vs-`W/"…"` wrapping rule as a custom `etag` function.
- `strictAccept`'s `406` and an invalid `?version=`'s `400` are both resolved before `etagFrom` or `input` are ever touched.

## Sharing options with middleware

Setting the same options on every route gets repetitive. `feedMiddleware` lets you set them once; each route can still override them per call.
:::
:::kiritan{locale=ja}
`etagFrom` は同期でも `Promise` でも返せます。どちらの場合でも、`etagFrom` か遅延評価の `input` を使うと、`serveFeed` の戻り値の型は `Response | Promise<Response>` になります (TypeScript がオーバーロードで自動的に判別します。この README のほかの箇所で示している同期的な呼び出しには影響せず、これまでどおり `Response` を返します)。

知っておくとよい点がいくつかあります。

- この段階で確認できるのは `If-None-Match` だけです。`If-Modified-Since` に使う `updated` の日付がまだ存在しないためです。RFC 9110 §13.1.3 では、`If-None-Match` を含むリクエストは `If-Modified-Since` を無視するので、よくある再検証のケースはこれで網羅できます。`If-Modified-Since` だけを持つリクエストでは、通常どおり `input` を解決します。
- 一致しなかった場合は、`etagFrom` の値が応答の `ETag` になります (`etag` オプションは無視されます)。値をそのまま使うか `W/"…"` で包むかは、独自の `etag` 関数と同じ規則です。
- `strictAccept` による `406` と、不正な `?version=` による `400` は、`etagFrom` や `input` に触れる前に判定されます。

## ミドルウェアでオプションを共有する

すべてのルートに同じオプションを書くのは面倒です。`feedMiddleware` を使えば一度だけ設定でき、ルートごとの呼び出しで上書きもできます。
:::

```ts
// ESM
import { Hono } from 'hono'
import { feedMiddleware, type FeedMiddlewareEnv } from 'hono-feed'

// CJS — types are compile-time only, so require just the runtime value
const { Hono } = require('hono')
const { feedMiddleware } = require('hono-feed')

const app = new Hono<FeedMiddlewareEnv>()

app.use('*', feedMiddleware({ cacheControl: 'public, max-age=600' }))

// Use the preconfigured helper from c.var — no need to repeat the options.
app.get('/feed', (c) => c.var.serveFeed(buildFeed()))
```

:::kiritan{locale=en}
## Using `c.render()`

Prefer Hono's renderer convention? `feedRenderer` wires `serveFeed` into `c.render`, the same way `jsxRenderer` wires up HTML. Pass it as route middleware and return `c.render(input)`:
:::
:::kiritan{locale=ja}
## `c.render()` を使う

Hono のレンダラーの流儀が好みなら、`feedRenderer` が `serveFeed` を `c.render` に結び付けます。`jsxRenderer` が HTML を結び付けるのと同じ仕組みです。ルートのミドルウェアとして渡し、`c.render(input)` を返します。
:::

```ts
// ESM
import { Hono } from 'hono'
import { feedRenderer } from 'hono-feed/renderer'

// CJS
const { Hono } = require('hono')
const { feedRenderer } = require('hono-feed/renderer')

const app = new Hono()

// `buildFeed()` is just your own helper returning a Feed (or `{ options, items }`).
app.get('/feed', feedRenderer({ baseUrl: 'https://example.com' }), (c) =>
  c.render(buildFeed(), { format: 'atom' }),
)
```

:::kiritan{locale=en}
> [!NOTE]
> `feedRenderer` augments Hono's global `ContextRenderer` type, so importing `hono-feed/renderer` anywhere makes `c.render()` take a feed across your whole project — the same trade-off `jsxRenderer` makes. Keeping it on its own entry point is what makes that opt-in: you get the augmentation only if you import it. If you'd rather keep the helper scoped to a route, use [`feedMiddleware`](#sharing-options-with-middleware) instead.

## Static site generation

Hono's [`toSSG`](https://hono.dev/docs/helpers/ssg) can write feeds to disk at build time. It picks the file extension from the response's `Content-Type`, and it doesn't know the feed MIME types, so an unmapped feed would be saved as `feed.json.html`. `feedExtensionMap` maps them to `.xml` (RSS and Atom) and `.json`. Merge it with Hono's `defaultExtensionMap`, because `toSSG` uses a map you give it in place of its own:
:::
:::kiritan{locale=ja}
> [!NOTE]
> `feedRenderer` は Hono のグローバルな `ContextRenderer` 型を拡張します。そのため、どこかで `hono-feed/renderer` を import すると、プロジェクト全体で `c.render()` がフィードを受け取る型になります。これは `jsxRenderer` と同じトレードオフです。専用のエントリーポイントに分けてあるので、import したときだけ拡張が有効になります。ヘルパーの影響をルート単位に留めたい場合は、代わりに [`feedMiddleware`](#ミドルウェアでオプションを共有する) を使ってください。

## 静的サイト生成

Hono の [`toSSG`](https://hono.dev/docs/helpers/ssg) を使うと、ビルド時にフィードをファイルとして書き出せます。`toSSG` は応答の `Content-Type` からファイルの拡張子を決めますが、フィードの MIME タイプは知らないため、対応づけがないと `feed.json.html` として保存されてしまいます。`feedExtensionMap` は、これらを `.xml` (RSS と Atom)と `.json` に対応づけます。`toSSG` は渡されたマップを自身のマップの代わりに使うので、Hono の `defaultExtensionMap` と合成して渡してください。
:::

```ts
import { Hono } from 'hono'
import { defaultExtensionMap, toSSG } from 'hono/ssg'
import { feedExtensionMap, serveFeed } from 'hono-feed'

const app = new Hono()
app.get('/rss', (c) => serveFeed(c, buildFeed(), { format: 'rss' })) // -> rss.xml
app.get('/feed.json', (c) => serveFeed(c, buildFeed(), { format: 'json' })) // -> feed.json

await toSSG(app, fs, { extensionMap: { ...defaultExtensionMap, ...feedExtensionMap } })
```

:::kiritan{locale=en}
## What goes in a feed

`new Feed(options)` describes the channel; `feed.addItem(item)` adds an entry. Only `title` is required everywhere — the other fields are optional in the neutral model and map to the right field in every format. On top of that, each format enforces the fields *its spec* makes mandatory (see the table below the example).
:::
:::kiritan{locale=ja}
## フィードに含める内容

`new Feed(options)` でチャンネルを記述し、`feed.addItem(item)` で記事を追加します。どのフォーマットでも必須なのは `title` だけです。ほかの項目は共通モデルでは省略可能で、各フォーマットの正しい項目に対応づけられます。そのうえで、各フォーマットは*その仕様*が必須とする項目を検証します (例の下の表を参照)。
:::

```ts
// ESM
import { Feed } from 'hono-feed'

// CJS
const { Feed } = require('hono-feed')

const feed = new Feed({
  title: 'Example Blog', // required
  link: 'https://example.com/',
  description: 'Notes and writing',
  language: 'en',
  author: { name: 'Ada', email: 'ada@example.com' },
  updated: new Date(),
})

feed.addItem({
  title: 'Hello, world', // required
  link: 'https://example.com/hello',
  description: 'A short summary',
  content: '<p>The full HTML body.</p>',
  published: new Date('2026-06-29'),
  categories: [{ term: 'intro' }],
})
```

:::kiritan{locale=en}
Rather than emit a document that violates its spec, `serveFeed` checks these per-format requirements up front and throws a `TypeError` when one is missing:

| Format | The feed needs | Every item needs |
| --- | --- | --- |
| RSS | `link` (falls back to `feedUrl`, then the request URL) | — |
| Atom | an `author` (here, or on every item) · `updated` when there are no items · `id` must be an absolute IRI | `id` or `link` (ids must be absolute IRIs) · `updated` or `published` · `link` or `content` |
| JSON Feed | — | `id` or `link` · `content` or `description` |

(Deprecated versions add a couple more — e.g. RSS 0.91 requires `language` — with equally explicit error messages.)

`Enclosure.length` is optional in the neutral model, but RSS's `<enclosure>` requires the attribute — when it's unset, RSS emits `length="0"`, per the RSS Best Practices Profile ("If the length of an enclosure cannot be determined, a publisher SHOULD use a length of zero"). JSON Feed omits `size_in_bytes` instead, since it's optional there.

An item's `comments` URL becomes `<comments>` in RSS 2.0 and `<link rel="replies">` (RFC 4685) in Atom 1.0; JSON Feed has no equivalent.

> [!TIP]
> hono-feed does the XML escaping for you, but it doesn't HTML-encode entities. If you need that — e.g. to turn arbitrary text into a safe HTML `content`/`description` value — reach for [`he`](https://www.npmjs.com/package/he) (`he.encode(text)`), plus [`@types/he`](https://www.npmjs.com/package/@types/he) for its TypeScript types.
:::
:::kiritan{locale=ja}
仕様に反するドキュメントを出力しないよう、`serveFeed` は事前にフォーマットごとの要件を確認し、満たされていなければ `TypeError` を投げます。

| フォーマット | フィードに必要なもの | 各記事に必要なもの |
| --- | --- | --- |
| RSS | `link` (なければ `feedUrl`、さらにリクエスト URL で代替) | なし |
| Atom | `author` (フィードか、すべての記事のどちらかに) · 記事がないときは `updated` · `id` は絶対 IRI | `id` または `link` (id は絶対 IRI) · `updated` または `published` · `link` または `content` |
| JSON Feed | なし | `id` または `link` · `content` または `description` |

(非推奨のバージョンでは要件がいくつか増えます。たとえば RSS 0.91 は `language` が必須で、エラーメッセージも同じく具体的です。)

`Enclosure.length` は共通モデルでは省略可能ですが、RSS の `<enclosure>` ではこの属性が必須です。未設定の場合、RSS Best Practices Profile ("If the length of an enclosure cannot be determined, a publisher SHOULD use a length of zero")に従い、RSS は `length="0"` を出力します。JSON Feed では省略可能なので、代わりに `size_in_bytes` を出力しません。

記事の `comments` の URL は、RSS 2.0 では `<comments>`、Atom 1.0 では `<link rel="replies">` (RFC 4685)になります。JSON Feed には対応するものがありません。

> [!TIP]
> hono-feed は XML エスケープを行いますが、HTML エンティティのエンコードは行いません。必要な場合、たとえば任意のテキストを安全な HTML の `content` / `description` に変換したいときは、[`he`](https://www.npmjs.com/package/he) (`he.encode(text)`)と、その TypeScript の型定義の [`@types/he`](https://www.npmjs.com/package/@types/he) を使ってください。
:::

:::kiritan{locale=en}
## Options

All options for `serveFeed(c, input, options?)`:

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `format` | `FeedFormat` | – | Pin the format and skip negotiation |
| `defaultFormat` | `FeedFormat` | `'rss'` | Used when negotiation finds no match |
| `detectFromExtension` | `boolean` | `true` | Read the format from `.rss` / `.atom` / `.json` / `.xml` |
| `detectFromQuery` | `boolean` | `false` | Convenience switch for both `detectFormatFromQuery` and `detectVersionFromQuery` |
| `detectFormatFromQuery` | `boolean` | `detectFromQuery` | Read the format from `?format=` |
| `detectVersionFromQuery` | `boolean` | `detectFromQuery` | Read the version from `?version=` |
| `formatQueryParam` | `string` | `'format'` | Query param name used to detect the format |
| `versionQueryParam` | `string` | `'version'` | Query param name used to detect the version |
| `strictAccept` | `boolean` | `false` | Answer `406 Not Acceptable` when the Accept header explicitly rejects every format (`q=0`), instead of falling back to `defaultFormat` |
| `cacheControl` | `string \| CacheControlDirectives \| false` | `'public, max-age=3600'` | `Cache-Control` header (see [Cache-Control](#cache-control); `false` to omit) |
| `etag` | `boolean \| ((body: string) => string)` | `true` | Send an `ETag` and answer `304` on a match — `true` for the built-in weak FNV-1a-64 hash, a function for your own tag (e.g. from a revision you already track), or `false` to omit |
| `etagFrom` | `() => string \| Promise<string>` | – | Answer `If-None-Match` from a cheap, pre-serialization value, without resolving `input` or serializing anything (see [Skipping work on a 304](#skipping-work-on-a-304)) |
| `lastModified` | `boolean` | `true` | Send `Last-Modified` from `feed.updated` |
| `baseUrl` | `string` | request origin | Base used to turn relative URLs into absolute ones |
| `pretty` | `boolean` | `false` | Indent the output for readability |
| `rssVersion` | `RssVersion` | `'2.0'` | Which RSS version / structure to emit |
| `atomVersion` | `AtomVersion` | `'1.0'` | Which Atom version to emit |
| `jsonFeedVersion` | `JsonFeedVersion` | `'1.1'` | Which JSON Feed version to emit |
| `xmlVersion` | `XmlVersion` | `'1.0'` | XML declaration version. `'1.1'` is rejected for Atom and RSS 0.90 (their specs require XML 1.0) |
| `suppressDeprecationWarnings` | `boolean` | `false` | Mute warnings for deprecated versions |
:::
:::kiritan{locale=ja}
## オプション

`serveFeed(c, input, options?)` のオプションの一覧です。

| オプション | 型 | 既定値 | 内容 |
| --- | --- | --- | --- |
| `format` | `FeedFormat` | – | フォーマットを固定し、ネゴシエーションを行わない |
| `defaultFormat` | `FeedFormat` | `'rss'` | ネゴシエーションで一致するものがないときに使う |
| `detectFromExtension` | `boolean` | `true` | `.rss` / `.atom` / `.json` / `.xml` からフォーマットを読み取る |
| `detectFromQuery` | `boolean` | `false` | `detectFormatFromQuery` と `detectVersionFromQuery` をまとめて切り替えるスイッチ |
| `detectFormatFromQuery` | `boolean` | `detectFromQuery` | `?format=` からフォーマットを読み取る |
| `detectVersionFromQuery` | `boolean` | `detectFromQuery` | `?version=` からバージョンを読み取る |
| `formatQueryParam` | `string` | `'format'` | フォーマットの検出に使うクエリパラメーター名 |
| `versionQueryParam` | `string` | `'version'` | バージョンの検出に使うクエリパラメーター名 |
| `strictAccept` | `boolean` | `false` | Accept ヘッダーがすべてのフォーマットを明示的に拒否している (`q=0`)とき、`defaultFormat` に戻さず `406 Not Acceptable` を返す |
| `cacheControl` | `string \| CacheControlDirectives \| false` | `'public, max-age=3600'` | `Cache-Control` ヘッダー ([Cache-Control](#cache-control) を参照。`false` で省略) |
| `etag` | `boolean \| ((body: string) => string)` | `true` | `ETag` を送り、一致したら `304` を返す。`true` は組み込みの弱い FNV-1a-64 ハッシュ、関数は独自のタグ (すでに管理しているリビジョンなど)、`false` は送らない |
| `etagFrom` | `() => string \| Promise<string>` | – | `input` の解決やシリアライズをせずに、シリアライズ前の軽量な値で `If-None-Match` に答える ([304 で処理を省く](#304-で処理を省く)を参照) |
| `lastModified` | `boolean` | `true` | `feed.updated` から `Last-Modified` を送る |
| `baseUrl` | `string` | リクエストの origin | 相対 URL を絶対 URL に変換するときの基準 |
| `pretty` | `boolean` | `false` | 出力をインデントして読みやすくする |
| `rssVersion` | `RssVersion` | `'2.0'` | 出力する RSS のバージョンと構造 |
| `atomVersion` | `AtomVersion` | `'1.0'` | 出力する Atom のバージョン |
| `jsonFeedVersion` | `JsonFeedVersion` | `'1.1'` | 出力する JSON Feed のバージョン |
| `xmlVersion` | `XmlVersion` | `'1.0'` | XML 宣言のバージョン。Atom と RSS 0.90 では `'1.1'` を拒否する (仕様が XML 1.0 を要求するため) |
| `suppressDeprecationWarnings` | `boolean` | `false` | 非推奨バージョンの警告を出さない |
:::

:::kiritan{locale=en}
## Feed versions

The defaults — **RSS 2.0**, **Atom 1.0**, **JSON Feed 1.1** — are the modern, recommended formats, so most projects never touch these. They're typed unions, so your editor only offers valid values:
:::
:::kiritan{locale=ja}
## フィードのバージョン

既定の **RSS 2.0**、**Atom 1.0**、**JSON Feed 1.1** は、現代的で推奨されるフォーマットなので、ほとんどのプロジェクトでは変更する必要がありません。これらは型付きのユニオン型なので、エディターは有効な値だけを候補に出します。
:::

| Option | Accepted values | Default |
| --- | --- | --- |
| `rssVersion` | `'2.0'`, `'1.1'`, `'1.0'`, `'0.94'`, `'0.93'`, `'0.92'`, `'0.91'`, `'0.90'` | `'2.0'` |
| `atomVersion` | `'1.0'`, `'0.3'` | `'1.0'` |
| `jsonFeedVersion` | `'1.1'`, `'1'` | `'1.1'` |
| `xmlVersion` | `'1.0'`, `'1.1'` | `'1.0'` |

:::kiritan{locale=en}
A bit of history, in case you need an older version: **RSS comes in two families.** `0.91` through `0.94` and `2.0` share the familiar `<rss version="…">` shape. The RDF family is a different document entirely — `0.90` is Netscape's original "RDF Site Summary", `1.0` adds Dublin Core and content modules, and `1.1` uses a `<Channel>` root. RSS 1.0 and 1.1 are fully **supported, not deprecated** — reach for them when a consumer specifically wants RDF.

> [!WARNING]
> **RSS 0.9x, Atom 0.3 and JSON Feed 1.0 are deprecated.** They still produce valid output, but each logs a one-time, coded `DeprecationWarning` (`HONOFEED_DEP000N`, see [HONOFEED_DEP.md](HONOFEED_DEP.md) for the full list) — through `process.emitWarning` on Node, or `console.warn` on edge runtimes. To silence it, set `suppressDeprecationWarnings: true`, the `HONO_FEED_NO_DEPRECATION` env var, or run Node with `--no-deprecation`.

## Podcasts

RSS 2.0 gets typed podcast metadata — the iTunes namespace (what Apple Podcasts, Spotify, and most directories require) and the Podcasting 2.0 namespace — via a `podcast` field on `FeedOptions` (feed-level) and `FeedItem` (episode-level). `xmlns:itunes` / `xmlns:podcast` are declared automatically, only when a field from that namespace is actually used somewhere in the feed:
:::
:::kiritan{locale=ja}
古いバージョンが必要になった場合に備えて、少し歴史を説明します。**RSS には 2 つの系統があります。** `0.91` から `0.94` と `2.0` は、おなじみの `<rss version="…">` という形を共有しています。RDF 系統はまったく別のドキュメントです。`0.90` は Netscape による最初の "RDF Site Summary"、`1.0` は Dublin Core とコンテンツモジュールを加えたもの、`1.1` は `<Channel>` をルートにしたものです。RSS 1.0 と 1.1 は**サポート対象で、非推奨ではありません**。RDF を求める相手に使ってください。

> [!WARNING]
> **RSS 0.9x、Atom 0.3、JSON Feed 1.0 は非推奨です。** 有効な出力は引き続き生成しますが、それぞれコード付きの `DeprecationWarning` (`HONOFEED_DEP000N`。一覧は [HONOFEED_DEP.ja.md](HONOFEED_DEP.ja.md) を参照)を一度だけ出力します。Node では `process.emitWarning`、エッジランタイムでは `console.warn` を使います。警告を止めるには、`suppressDeprecationWarnings: true` を指定するか、環境変数 `HONO_FEED_NO_DEPRECATION` を設定するか、Node を `--no-deprecation` で起動します。

## ポッドキャスト

RSS 2.0 では、型付きのポッドキャストメタデータを使えます。iTunes 名前空間 (Apple Podcasts、Spotify、ほとんどのディレクトリが要求するもの)と、Podcasting 2.0 名前空間が対象で、`FeedOptions` (フィード単位)と `FeedItem` (エピソード単位)の `podcast` フィールドに指定します。`xmlns:itunes` / `xmlns:podcast` は、その名前空間の項目がフィード内のどこかで実際に使われているときだけ、自動的に宣言されます。
:::

```ts
const feed = new Feed({
  title: 'My Show',
  link: 'https://example.com/',
  podcast: {
    author: 'Ada',
    category: ['Technology'],
    explicit: false,
    image: 'https://example.com/cover.jpg',
    owner: { name: 'Ada', email: 'ada@example.com' },
    type: 'episodic',
    subtitle: 'A show about things',
    summary: 'A longer description of the show, shown in place of <description> by some apps.',
    // block/complete only emit an element when true — Apple's documented value is "Yes";
    // absence (false/unset) means no.
    block: false,
    complete: false,
    // newFeedUrl: 'https://example.com/new-feed.xml', // set only once the feed has moved
    // Podcasting 2.0:
    guid: '917393e3-1b1e-5cef-ace4-edaa54e1f810',
    locked: true,
    funding: [{ url: 'https://example.com/support', text: 'Support the show' }],
  },
})

feed.addItem({
  title: 'Episode 1',
  link: 'https://example.com/1',
  enclosure: { url: 'https://example.com/1.mp3', type: 'audio/mpeg' },
  podcast: {
    duration: 1800, // itunes:duration, in seconds
    episode: 1,
    season: 1,
    episodeType: 'full',
    title: 'Pilot', // itunes:title — episode title without numbering
    block: false,
    // Podcasting 2.0:
    transcript: [{ url: 'https://example.com/1.vtt', type: 'text/vtt' }],
    chapters: { url: 'https://example.com/1-chapters.json' },
  },
})
```

:::kiritan{locale=en}
`item.podcast.duration` is optional — when unset, `itunes:duration` falls back to the item's `enclosure.duration` ([above](#what-goes-in-a-feed)), so a plain `Enclosure` with a `duration` still reaches podcast directories without repeating it under `podcast`.

`podcast` is ignored outside RSS 2.0 (every other RSS version, Atom, and JSON Feed) — there's no equivalent to map it to. An explicit `customNamespaces` entry for `xmlns:itunes` / `xmlns:podcast` always wins over the automatic declaration.

## Feed discovery

Serving a feed is half the story — it also has to be *findable*. `hono-feed/discovery` generates the `<link rel="alternate">` tags browsers and feed readers look for, and an HTTP `Link` header equivalent, from the same MIME-type table `serveFeed` itself uses (so they can never drift apart).

For an HTML `<head>`:
:::
:::kiritan{locale=ja}
`item.podcast.duration` は省略可能です。未設定の場合、`itunes:duration` は記事の `enclosure.duration` ([前述](#フィードに含める内容))にフォールバックします。そのため、`duration` を持つ通常の `Enclosure` だけで、`podcast` に同じ値を重ねて書かなくても、ポッドキャストのディレクトリに届きます。

`podcast` は RSS 2.0 以外 (ほかのすべての RSS バージョン、Atom、JSON Feed)では無視されます。対応づけられる項目がないためです。`xmlns:itunes` / `xmlns:podcast` を `customNamespaces` に明示した場合は、自動の宣言より常にそちらが優先されます。

## フィードの発見

フィードを配信するだけでは半分です。*見つけてもらえる*ようにする必要もあります。`hono-feed/discovery` は、ブラウザーやフィードリーダーが探す `<link rel="alternate">` タグと、それに相当する HTTP の `Link` ヘッダーを生成します。`serveFeed` 自身が使うのと同じ MIME タイプの表から作るので、両者がずれることはありません。

HTML の `<head>` に入れる場合は次のようにします。
:::

```ts
// ESM
import { feedLinksHtml } from 'hono-feed/discovery'

// CJS
const { feedLinksHtml } = require('hono-feed/discovery')

app.get('/', (c) =>
  c.html(`
    <head>
      ${feedLinksHtml({ title: 'My Blog', rss: '/feed.rss', atom: '/feed.atom' })}
    </head>
  `),
)
// <link rel="alternate" type="application/rss+xml" title="My Blog" href="/feed.rss">
// <link rel="alternate" type="application/atom+xml" title="My Blog" href="/feed.atom">
```

:::kiritan{locale=en}
`feedLinks(options)` returns the same data as a plain array (`{ rel, type, href, title? }[]`) instead of a string, for JSX or any other templating you already use. Both accept `baseUrl` to absolutize relative feed URLs; left unset, hrefs stay exactly as given (relative, resolved by the browser against the current page — which is usually what you want).

For the HTTP-header equivalent ([RFC 8288](https://www.rfc-editor.org/rfc/rfc8288)), `feedLinkHeader` is middleware that appends one `Link` header per configured format, but only to responses whose `Content-Type` is HTML — a feed response has no use for advertising its own alternates:
:::
:::kiritan{locale=ja}
`feedLinks(options)` は同じデータを文字列ではなく単純な配列 (`{ rel, type, href, title? }[]`)で返します。JSX など、すでに使っているテンプレートの仕組みで使えます。どちらも `baseUrl` を受け取り、相対のフィード URL を絶対 URL にできます。未指定の場合、href は指定したままになります。相対 URL はブラウザーが現在のページを基準に解決するので、多くの場合はそれで問題ありません。

HTTP ヘッダーで同じことをするには ([RFC 8288](https://www.rfc-editor.org/rfc/rfc8288))、ミドルウェアの `feedLinkHeader` を使います。設定したフォーマットごとに `Link` ヘッダーを 1 つ追加しますが、対象は `Content-Type` が HTML の応答だけです。フィードの応答が自分の別形式を宣伝しても意味がないためです。
:::

```ts
// ESM
import { feedLinkHeader } from 'hono-feed/discovery'

// CJS
const { feedLinkHeader } = require('hono-feed/discovery')

app.use('*', feedLinkHeader({ rss: '/feed.rss' }))
// Link: </feed.rss>; rel="alternate"; type="application/rss+xml"
```

:::kiritan{locale=en}
## OPML

Sites that publish several feeds, or aggregate other people's, can offer an [OPML](http://opml.org/spec2.opml) subscription list — the file feed readers import to subscribe in one step. `serveOpml` serves it with the same caching behavior as `serveFeed` (`Cache-Control`, a weak `ETag`, `Last-Modified` from `dateModified`, `304` and `HEAD`), and `toOPML` returns just the string:
:::
:::kiritan{locale=ja}
## OPML

複数のフィードを公開しているサイトや、他の人のフィードをまとめているサイトは、[OPML](http://opml.org/spec2.opml) の購読リストを提供できます。フィードリーダーがこのファイルを取り込めば、一度に購読できます。`serveOpml` は `serveFeed` と同じキャッシュの挙動 (`Cache-Control`、弱い `ETag`、`dateModified` からの `Last-Modified`、`304`、`HEAD`)で配信し、`toOPML` は文字列だけを返します。
:::

```ts
import { serveOpml } from 'hono-feed'

app.get('/subscriptions.opml', (c) =>
  serveOpml(c, {
    title: 'My subscriptions',
    ownerName: 'Ada',
    dateModified: new Date('2026-06-29'),
    outlines: [
      { text: 'Example Blog', xmlUrl: '/feed.xml', htmlUrl: '/' }, // type defaults to "rss"
      {
        text: 'Tech', // an outline with children is a folder
        children: [{ text: 'Another', type: 'atom', xmlUrl: 'https://a.example/atom' }],
      },
    ],
  }),
)
```

:::kiritan{locale=en}
Relative `xmlUrl`/`htmlUrl`/`ownerId` are absolutized against `baseUrl` (default: the request origin), and every outline needs `text`. `feedExtensionMap` maps `text/x-opml` to `.opml`, so the route also works with [static site generation](#static-site-generation).

## WebSub

Two independent halves make up [WebSub](https://www.w3.org/TR/websub/) (formerly PubSubHubbub) support — subscribing readers can discover a hub, and you can tell that hub about new content.

**Discovery** — `hub` on `FeedOptions` emits `rel="hub"` links so readers know where to subscribe (RSS/Atom `<atom:link rel="hub">`, JSON Feed `hubs`):
:::
:::kiritan{locale=ja}
相対の `xmlUrl` / `htmlUrl` / `ownerId` は `baseUrl` (既定はリクエストの origin)を基準に絶対 URL になります。すべてのアウトラインに `text` が必要です。`feedExtensionMap` は `text/x-opml` を `.opml` に対応づけるので、このルートは[静的サイト生成](#静的サイト生成)でも使えます。

## WebSub

[WebSub](https://www.w3.org/TR/websub/) (旧 PubSubHubbub)への対応は、独立した 2 つの機能でできています。購読するリーダーがハブを見つけられるようにすることと、ハブに新しいコンテンツを知らせることです。

**発見**: `FeedOptions` の `hub` は `rel="hub"` のリンクを出力し、リーダーが購読先を判別できるようにします (RSS / Atom は `<atom:link rel="hub">`、JSON Feed は `hubs`)。
:::

```ts
const feed = new Feed({
  title: 'My Blog',
  link: 'https://example.com/',
  hub: 'https://pubsubhubbub.appspot.com/', // or string[] for more than one hub
})
```

:::kiritan{locale=en}
`serveFeed` also advertises the hub and the feed's own URL in an HTTP `Link` header (`<…>; rel="hub", <…>; rel="self"`), the header form of WebSub discovery, so a hub or subscriber can find them without parsing the document.
:::
:::kiritan{locale=ja}
`serveFeed` は、WebSub の発見のヘッダー形式として、ハブとフィード自身の URL を HTTP の `Link` ヘッダー (`<…>; rel="hub", <…>; rel="self"`)でも通知します。ハブや購読者は、ドキュメントを解析しなくても見つけられます。
:::

:::kiritan{locale=en}
**Notification** — `notifyHub()` tells the hub a feed changed, so subscribers get the update in real time instead of waiting for their next poll. This is the publisher's obligation under WebSub §6 (Publishing); the spec leaves the mechanism open, so `notifyHub` sends the de-facto standard PubSubHubbub 0.4 "publish" ping that real-world hubs accept:
:::
:::kiritan{locale=ja}
**通知**: `notifyHub()` はフィードが更新されたことをハブに伝えます。購読者は次のポーリングを待たず、リアルタイムに更新を受け取れます。これは WebSub §6 (Publishing)でパブリッシャーに課されている義務です。仕様は方法を定めていないため、`notifyHub` は実際のハブが受け付ける事実上の標準、PubSubHubbub 0.4 の "publish" ping を送ります。
:::

```ts
import { notifyHub } from 'hono-feed'

const results = await notifyHub(
  'https://pubsubhubbub.appspot.com/', // hub(s) — string or string[]
  'https://example.com/feed.rss', // feed URL(s) that changed — string or string[]
)
// [{ hub: 'https://pubsubhubbub.appspot.com/', ok: true, status: 204 }]
```

:::kiritan{locale=en}
`notifyHub` never throws — a non-2xx response, a network error, and an aborted request (pass `{ signal }` to time one out) are all reported as a result rather than a rejection, so one unreachable hub can't fail your publish flow. Subscribers still get the update on their next poll either way.

## Pagination

`paging` on `FeedOptions` covers [RFC 5005](https://www.rfc-editor.org/rfc/rfc5005) (Feed Paging and Archiving) end to end — for a feed too large to send in one document:
:::
:::kiritan{locale=ja}
`notifyHub` は例外を投げません。2xx 以外の応答、ネットワークエラー、中断されたリクエスト (タイムアウトさせたいときは `{ signal }` を渡します)は、すべて拒否(rejection)ではなく結果として報告されます。そのため、到達できないハブが 1 つあっても、公開の流れ全体が失敗することはありません。いずれの場合も、購読者は次のポーリングで更新を受け取れます。

## ページネーション

`FeedOptions` の `paging` は、[RFC 5005](https://www.rfc-editor.org/rfc/rfc5005) (Feed Paging and Archiving)を最初から最後まで扱います。1 つのドキュメントで送るには大きすぎるフィード向けです。
:::

```ts
const feed = new Feed({
  title: 'My Blog',
  link: 'https://example.com/',
  paging: {
    next: '/feed?page=3', // rel="next"
    prev: '/feed?page=1', // rel="previous" — RFC 5005's own term, not "prev"
    first: '/feed?page=1', // rel="first"
    last: '/feed?page=10', // rel="last"
  },
})
```

:::kiritan{locale=en}
RSS 2.0 and Atom 1.0 emit one `atom:link`/`link` per set field; JSON Feed only maps `next` (to `next_url` — the spec has no equivalent for the others).

Rather than assembling those links yourself, `paginate()` slices the items for the current page and builds `paging` for it. It takes the 1-based `page` (a query string value is fine; anything unparsable means page 1 and a page past the end is clamped to the last), `perPage`, and a `url(page)` function:
:::
:::kiritan{locale=ja}
RSS 2.0 と Atom 1.0 は、設定した項目ごとに `atom:link` / `link` を 1 つ出力します。JSON Feed が対応するのは `next` だけで、`next_url` になります。仕様にほかの項目に相当するものがないためです。

これらのリンクを自分で組み立てる代わりに、`paginate()` が現在のページの記事を切り出し、そのための `paging` を作ります。1 始まりの `page` (クエリ文字列の値でも構いません。解釈できない値はページ 1 とみなし、末尾を超えたページは最後のページに丸めます)、`perPage`、`url(page)` 関数を渡します。
:::

```ts
import { paginate, serveFeed } from 'hono-feed'

app.get('/feed', (c) => {
  const { items, paging } = paginate(posts, {
    page: c.req.query('page'),
    perPage: 20,
    url: (page) => `/feed?page=${page}`,
  })
  return serveFeed(c, { options: { title: 'My Blog', link: 'https://example.com/', paging }, items })
})
```

:::kiritan{locale=en}
`next` and `prev` appear only where there is a page to go to, and `first`/`last` whenever there is more than one page. It also returns `page` and `totalPages`, in case you want to answer an out-of-range page with a 404 instead of the clamped one.

Two more fields complete §2/§4: `complete` (§2) marks a document as containing the *entire* feed, and `archive` (§4) marks an archive page whose content never changes — pairs naturally with `cacheControl: { immutable: true }`. They emit `<fh:complete/>` / `<fh:archive/>` (the `xmlns:fh` namespace is declared automatically, only when one is set), and are mutually exclusive — setting both throws:
:::
:::kiritan{locale=ja}
`next` と `prev` は、移動先のページがあるときだけ出力されます。`first` と `last` は、ページが複数あるときに出力されます。丸められたページではなく 404 を返したい場合に備えて、`page` と `totalPages` も返します。

§2 と §4 を完成させる項目がさらに 2 つあります。`complete` (§2)は、このドキュメントが*フィード全体*を含むことを示します。`archive` (§4)は、内容が変わらないアーカイブページであることを示し、`cacheControl: { immutable: true }` と相性が良い設定です。それぞれ `<fh:complete/>` / `<fh:archive/>` を出力し (`xmlns:fh` 名前空間は、どちらかを設定したときだけ自動で宣言されます)、同時には指定できません。両方を設定すると例外を投げます。
:::

```ts
paging: {
  archive: true, // this page never changes; safe to cache forever
  current: '/feed', // rel="current" — where the always-up-to-date document lives
  prevArchive: '/archive/2', // rel="prev-archive" — the preceding archive page
  nextArchive: '/archive/4', // rel="next-archive" — the following archive page
}
```

:::kiritan{locale=en}
`prevArchive`/`nextArchive` are how a reader walks an archived feed's history from one page to the next — the point of `archive` pages in the first place.

Like the rest of `paging`, `complete`/`archive`/`current`/`prevArchive`/`nextArchive` are RSS 2.0 / Atom 1.0 only; JSON Feed has no mapping for any of them.

## RSS channel extras

A handful of `<channel>` elements have no equivalent in Atom or JSON Feed, so they're plain `FeedOptions` fields rather than part of the shared model — available in every `<rss version="…">` structure (0.91 through 2.0), same as `language`/`copyright`:
:::
:::kiritan{locale=ja}
`prevArchive` / `nextArchive` は、リーダーがアーカイブされたフィードの履歴を 1 ページずつたどるための項目です。そもそも `archive` ページが存在する理由がこれです。

`paging` のほかの項目と同様、`complete` / `archive` / `current` / `prevArchive` / `nextArchive` は RSS 2.0 と Atom 1.0 だけが対象です。JSON Feed にはこれらに対応するものがありません。

## RSS チャンネルの追加要素

`<channel>` の要素には、Atom にも JSON Feed にも相当するものがないものがいくつかあります。そのため共通モデルには含めず、通常の `FeedOptions` のフィールドとして用意しています。`language` や `copyright` と同じく、すべての `<rss version="…">` 構造 (0.91 から 2.0)で使えます。
:::

```ts
const feed = new Feed({
  title: 'My Blog',
  link: 'https://example.com/',
  webmaster: { name: 'Ada', email: 'webmaster@example.com' }, // <webMaster> — email required, like author
  docs: true, // <docs> — true emits the canonical RSS 2.0 spec URL; a string emits it as-is
  skipHours: [0, 1, 2], // <skipHours><hour>…</hour></skipHours> — GMT hours (0–23) readers can skip
  skipDays: ['Saturday', 'Sunday'], // <skipDays><day>…</day></skipDays>
})
```

:::kiritan{locale=en}
Per item, `source` records the feed an entry was republished from — `<source url="…">Title</source>` in RSS 2.0 and `<source>` (title plus a `rel="self"` link, RFC 4287 §4.2.11) in Atom 1.0. Both `title` and `url` (the original *feed's* URL) are required; JSON Feed has no equivalent:
:::
:::kiritan{locale=ja}
記事単位では、`source` に転載元のフィードを記録できます。RSS 2.0 では `<source url="…">Title</source>`、Atom 1.0 では `<source>` (タイトルと `rel="self"` のリンク。RFC 4287 §4.2.11)になります。`title` と `url` (元の*フィード*の URL)はどちらも必須です。JSON Feed には対応するものがありません。
:::

```ts
feed.addItem({
  title: 'A post worth sharing',
  link: 'https://example.com/shared',
  source: { title: 'Original Blog', url: 'https://original.example/feed.xml' },
})
```

:::kiritan{locale=en}
`skipHours` values outside 0–23 throw. `textInput` and `cloud` (rssCloud) are deliberately not modeled — `textInput` is essentially unused in the wild, and `cloud` is superseded in practice by the WebSub support [above](#websub); reach for `customXml` if you need either.

## Media RSS

`media` on a `FeedItem` adds [Media RSS](https://www.rssboard.org/media-rss) thumbnails and media objects, the de facto way to attach a preview image or a video to an RSS or Atom entry. `xmlns:media` is declared automatically, only when an item sets one (an explicit `customNamespaces` entry still wins).
:::
:::kiritan{locale=ja}
`skipHours` に 0 から 23 の範囲外の値を指定すると、例外を投げます。`textInput` と `cloud` (rssCloud)は、意図的にモデル化していません。`textInput` は実際にはほとんど使われておらず、`cloud` は実際には[前述](#websub)の WebSub 対応に置き換わっています。どちらかが必要なら `customXml` を使ってください。

## Media RSS

`FeedItem` の `media` に指定すると、[Media RSS](https://www.rssboard.org/media-rss) のサムネイルとメディアオブジェクトを追加できます。RSS や Atom の記事にプレビュー画像や動画を付ける、事実上の標準の方法です。`xmlns:media` は、記事のどれかが `media` を設定したときだけ自動で宣言されます (`customNamespaces` に明示した場合は、そちらが優先されます)。
:::

```ts
feed.addItem({
  title: 'New video',
  link: 'https://example.com/video',
  media: {
    thumbnails: [{ url: '/video-thumb.jpg', width: 320, height: 180 }], // <media:thumbnail>
    contents: [{ url: '/video.mp4', type: 'video/mp4', medium: 'video', duration: 42 }], // <media:content>
  },
})
```

:::kiritan{locale=en}
URLs are absolutized against `baseUrl` like every other URL field, and every entry needs a `url`. It is emitted for RSS 2.0 and Atom 1.0 only; JSON Feed has no equivalent (use the item's `image` there).

Set `itemImageAsThumbnail: true` in the feed options to also emit each item's `image` as a `<media:thumbnail>` in RSS 2.0 and Atom 1.0, so readers that only look at Media RSS still show a preview. An item that sets `media.thumbnails` keeps its own and gets no extra one. Without the option, `image` stays JSON Feed-only.

## Extending with custom fields

The neutral model is deliberately small — anything outside it (Media RSS, Dublin Core extras, a namespaced module hono-feed doesn't model, custom JSON Feed keys) needs an escape hatch. `customXml` / `customNamespaces` (XML formats) and `customJson` (JSON Feed) are that hatch, on both `FeedOptions` (feed-level) and `FeedItem` (item-level):
:::
:::kiritan{locale=ja}
URL は、ほかの URL フィールドと同様に `baseUrl` を基準に絶対 URL になります。どのエントリにも `url` が必要です。出力されるのは RSS 2.0 と Atom 1.0 だけで、JSON Feed には対応するものがありません (JSON Feed では記事の `image` を使ってください)。

フィードのオプションで `itemImageAsThumbnail: true` を指定すると、各記事の `image` が RSS 2.0 と Atom 1.0 でも `<media:thumbnail>` として出力されます。Media RSS だけを見るリーダーでもプレビューが表示されます。`media.thumbnails` を設定した記事は、その指定を優先し、サムネイルを追加しません。指定しない場合、`image` は JSON Feed だけに出力されます。

## カスタムフィールドで拡張する

共通モデルは意図的に小さくしてあります。その範囲外のもの (Dublin Core の追加要素、hono-feed がモデル化していない名前空間付きのモジュール、独自の JSON Feed のキーなど)には、抜け道が必要です。それが `customXml` / `customNamespaces` (XML 形式向け)と `customJson` (JSON Feed 向け)で、`FeedOptions` (フィード単位)と `FeedItem` (記事単位)のどちらにも指定できます。
:::

```ts
const feed = new Feed({
  title: 'My Show',
  link: 'https://example.com/',
  customNamespaces: { 'xmlns:dcterms': 'http://purl.org/dc/terms/' },
  customXml: [{ name: 'dcterms:license', text: 'https://creativecommons.org/licenses/by/4.0/' }],
})
```

:::kiritan{locale=en}
`customXml` is a JSON-shaped element tree (`{ name, attrs?, children?, text? }`), not a raw string — `text`/`attrs` are escaped exactly like every built-in element, so this stays correct by construction. Elements are appended after the format's built-in ones (`<channel>`/`<feed>` or `<item>`/`<entry>`); RDF (RSS 1.0/1.1) and legacy RSS 0.9x accept them unconditionally, since there's no built-in gating to opt out of once you've reached for this. `customNamespaces` adds `xmlns:*` declarations to the root element.

`customJson` merges extra keys into the JSON Feed object (feed-level and/or per item) — per the [JSON Feed spec](https://www.jsonfeed.org/version/1.1/#extensions), custom keys should start with `_`. A built-in key always wins on collision, so this can only add fields, never override one hono-feed already sets.

## Low-level serializers

Sometimes you just want the string — for a snapshot test, a queue, or a non-Hono transport. `toRSS`, `toAtom` and `toJSONFeed` give you exactly that, with no HTTP layer involved:
:::
:::kiritan{locale=ja}
`customXml` は生の文字列ではなく、JSON 形式の要素ツリー (`{ name, attrs?, children?, text? }`)です。`text` と `attrs` は組み込みの要素とまったく同じようにエスケープされるので、安全に書けます。要素は、そのフォーマットの組み込み要素の後ろ (`<channel>` / `<feed>` または `<item>` / `<entry>` の末尾)に追加されます。RDF (RSS 1.0 / 1.1)と古い RSS 0.9x では、これを使う時点で無効にできる組み込みの制限がないため、無条件に受け入れます。`customNamespaces` はルート要素に `xmlns:*` 宣言を追加します。

`customJson` は、追加のキーを JSON Feed オブジェクトにマージします (フィード単位、記事単位、またはその両方)。[JSON Feed の仕様](https://www.jsonfeed.org/version/1.1/#extensions)に従い、独自のキーは `_` で始めてください。組み込みのキーと衝突した場合は常に組み込みが優先されるので、フィールドを追加することはできても、hono-feed がすでに設定したものを上書きすることはできません。

## 低レベルのシリアライザー

文字列だけが欲しい場面もあります。スナップショットテスト、キュー、Hono 以外の転送手段などです。`toRSS`、`toAtom`、`toJSONFeed` は、HTTP の層なしでまさにそれを返します。
:::

```ts
// ESM
import { toRSS, toAtom, toJSONFeed } from 'hono-feed'

// CJS
const { toRSS, toAtom, toJSONFeed } = require('hono-feed')

// Or import a single one for a smaller bundle:
// 'hono-feed/rss', 'hono-feed/atom', 'hono-feed/json', 'hono-feed/middleware'

const xml = toRSS({ options, items }, { baseUrl: 'https://example.com' })
```

:::kiritan{locale=en}
`serveFeed` runs the same per-format spec validation (Atom author coverage, absolute-IRI ids, required dates, …) before serializing — those checks aren't otherwise run on this low-level path, so if you want them, call `validateInput` yourself first:
:::
:::kiritan{locale=ja}
`serveFeed` はシリアライズの前に、フォーマットごとの仕様の検証 (Atom の author の網羅、絶対 IRI の id、必須の日付など)を行います。この低レベルの経路ではそれらの検証は行われないので、必要なら先に自分で `validateInput` を呼んでください。
:::

```ts
import { toAtom, validateInput } from 'hono-feed'

validateInput({ options, items }, 'atom') // throws TypeError with the same messages serveFeed gives
const xml = toAtom({ options, items }, { baseUrl: 'https://example.com' })
```

:::kiritan{locale=en}
## Linting

`validateInput` only enforces what breaks the document (a missing title, a missing Atom author, …). `lintInput` goes further: it flags fields that are optional per spec but expected by real readers and directories — a missing feed `description`/`language`/`image`, an item with no `id`, `author`, or date, incomplete Podcast metadata once `podcast` is set, and so on. It never throws and returns a plain `string[]` of warnings (empty when clean), and `serveFeed` never calls it — it's for tests and CI, not the serve path:
:::
:::kiritan{locale=ja}
## リント

`validateInput` が検証するのは、ドキュメントを壊すものだけです (タイトルがない、Atom の author がない、など)。`lintInput` はさらに踏み込み、仕様上は省略可能でも、実際のリーダーやディレクトリが期待している項目を指摘します。たとえばフィードの `description` / `language` / `image` がない、記事に `id`、`author`、日付がない、`podcast` を設定したのにポッドキャストのメタデータが不完全、などです。例外は投げず、警告の `string[]` を返します (問題がなければ空)。`serveFeed` はこれを呼ばないので、テストや CI 向けの機能で、配信の経路では使いません。
:::

```ts
import { lintInput } from 'hono-feed'

const warnings = lintInput({ options, items }, 'rss')
// e.g. expect(lintInput({ options, items }, 'rss')).toEqual([]) in a CI check
```

:::kiritan{locale=en}
## Contributing

Contributions Welcome! You can contribute in the following ways.

- Create an Issue - Propose a new feature. Report a bug.
- Pull Request - Fix a bug or typo. Refactor the code.
- Share - Share your thoughts on the Blog, Twitter, and others.
- Make your application - Please try to use hono-feed.

For more details, see [CONTRIBUTING.md](./CONTRIBUTING.md).

## Contributors

Thanks to [all contributors](https://github.com/otnc/hono-feed/graphs/contributors)!
:::
:::kiritan{locale=ja}
## コントリビュート

コントリビュートを歓迎します。次のような形で参加できます。

- Issue を作成する: 新機能の提案やバグの報告。
- Pull Request を送る: バグや誤字の修正、コードのリファクタリング。
- 共有する: ブログや Twitter などで感想を発信する。
- アプリケーションを作る: ぜひ hono-feed を使ってみてください。

詳しくは [CONTRIBUTING.ja.md](./CONTRIBUTING.ja.md) を参照してください。

## コントリビューター

[すべてのコントリビューター](https://github.com/otnc/hono-feed/graphs/contributors)に感謝します！
:::

<a href="https://github.com/otnc/hono-feed/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=otnc/hono-feed" />
</a>

:::kiritan{locale=en}
## Authors
:::
:::kiritan{locale=ja}
## 作者
:::

otoneko. https://github.com/otnc

:::kiritan{locale=en}
## License

Distributed under the MIT License. See [LICENSE](./LICENSE) for more information.
:::
:::kiritan{locale=ja}
## ライセンス

MIT License のもとで配布しています。詳細は [LICENSE](./LICENSE) を参照してください。
:::
