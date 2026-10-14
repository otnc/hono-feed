<div align="center">
  <a href="https://github.com/otnc/hono-feed">
    <img src="./assets/logo.png" width="500" height="auto" alt="hono-feed"/>
  </a>
</div>

<hr />

[English](README.md) | **日本語**

[![npm](https://img.shields.io/npm/v/hono-feed)](https://www.npmjs.com/package/hono-feed) [![npm](https://img.shields.io/npm/dm/hono-feed)](https://www.npmjs.com/package/hono-feed) [![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/otnc/hono-feed/ci.yml?branch=main)](https://github.com/otnc/hono-feed/actions) [![GitHub](https://img.shields.io/github/license/otnc/hono-feed)](https://github.com/otnc/hono-feed/blob/main/LICENSE) [![GitHub commit activity](https://img.shields.io/github/commit-activity/m/otnc/hono-feed)](https://github.com/otnc/hono-feed/pulse) [![GitHub last commit](https://img.shields.io/github/last-commit/otnc/hono-feed)](https://github.com/otnc/hono-feed/commits/main)

> [Hono](https://hono.dev) のための RSS、Atom、JSON Feed。正しいものを、手間なく。

フィードの配信は簡単そうに見えて、細部でつまずきます。日付は仕様ごとに決まった形式で書く必要があり、テキストは XML エスケープが必要で、条件付きリクエストには `304` を返すべきで、リーダーは `Accept` ヘッダーでそれぞれ別のフォーマットを求めてきます。`hono-feed` はこれらをまとめて引き受けます。フィードを一度記述すれば、正しい HTTP `Response` が返ります。

> [!NOTE]
> 実行時の依存はゼロで、Web 標準だけで作られています。そのため Hono が動く場所ならどこでも動きます。Cloudflare Workers、Deno、Bun、Node が対象です。`hono` 自体は peer dependency (`>=4`)です。

## なぜ hono-feed か

Hono にはフィード用のヘルパーが付属していません。そのため、XML を手書きするか、汎用のフィードライブラリを導入して HTTP の層を自分で組むか、どちらかになりがちです。hono-feed はその両方を置き換えます。

### 手書き XML との比較

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

タイトルに `&` や `<` が含まれた時点で壊れます(XML として不正になります)。`toUTCString()` は RSS が期待する RFC-822 形式の日付とは厳密には一致しません。しかも Atom や JSON の出力はなく、`ETag` / `304`、`HEAD`、キャッシュヘッダーもありません。

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

### フィードライブラリとの比較

[`feed`](https://github.com/jpmonette/feed) や [`rss`](https://github.com/dylang/node-rss) のようなライブラリは、エスケープや日付形式を処理してくれます。ただし渡されるのは*文字列*です。HTTP の層は、やはり自分で組む必要があります。

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

移植性にも落とし穴があります。多くのフィードライブラリは Node 向けに書かれており、Node の組み込み (`Buffer`、`stream`、`fs`)を使うか、それらを使うパッケージに依存しています。Cloudflare Workers、Vercel Edge、Deno、Bun では、ポリフィルが必要になったり、`nodejs_compat` フラグを有効にする必要が出たり、そもそも動かなかったりします。hono-feed は**依存ゼロ**で、Web 標準 API だけを使うので、同じコードがどの環境でもそのまま動きます。

| | 手書き | フィードライブラリ | hono-feed |
| --- | --- | --- | --- |
| XML エスケープと日付形式 | 自分で対応 | 対応済み | 対応済み |
| RSS + Atom + JSON | 1 形式ごとにルートが増える | たいてい 3 つとも対応 | 3 つとも対応、ネゴシエーション付き |
| HTTP の層 (ネゴシエーション、`ETag` / `304`、`HEAD`、キャッシュ) | 自前 | 自前 | 組み込み済み |
| 出力 | 文字列 | 文字列 | `Response` |
| Workers / Vercel / Deno / Bun / Node | コード次第 | 依存パッケージ次第 | どこでも動く (Web 標準) |

## インストール

```sh
npm install hono-feed # or: pnpm add hono-feed / bun add hono-feed
```

## クイックスタート

フィードを作り、記事を追加して、`serveFeed` に渡します。

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

このエンドポイント 1 つで、3 つのフォーマットすべてに対応できます。フィードリーダーには RSS、`application/json` を要求するブラウザーには JSON Feed が返ります。ルートを増やす必要はありません。

ビルダーではなく単純なデータで渡したい場合は、オブジェクトを渡します。

```ts
return serveFeed(c, { options: { title: 'Example Blog', updated: new Date() }, items: [] })
```

## フォーマットの選び方

既定ではフォーマットが自動でネゴシエーションされます。従来どおり `/rss.xml`、`/atom.xml`、`/feed.json` のようにエンドポイントを 1 つのフォーマットに固定したい場合は、明示的に指定します。

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

`format` を指定しない場合、`serveFeed` は次の順に確認し、最初に一致したものを使います。

1. クエリの `?format=rss|atom|json`。`detectFromQuery: true` (または `detectFormatFromQuery: true` だけ)で有効にした場合のみ
2. `.rss` / `.atom` / `.json` / `.xml` のような URL の拡張子。既定で有効
3. `Accept` ヘッダー (q 値を考慮)
4. `defaultFormat` (既定は `'rss'`)

ネゴシエーションした応答には `Vary: Accept` が付くので、キャッシュが正しく動きます。固定したエンドポイントはヘッダーで変わらないため、付きません。

### クエリでバージョンを選ぶ

`detectFromQuery: true` にすると、`?version=` によるバージョン選択も有効になります。値は、決まったフォーマットが期待するバージョンの型 (`rss` なら `RssVersion`、`atom` なら `AtomVersion`、`json` なら `JsonFeedVersion`)として解釈されます。対応するオプションがコードで固定されていない場合にだけ働き、`serveFeed(...)` に渡した `rssVersion` などは、常にクエリより優先されます。

```ts
app.get('/feed', (c) => serveFeed(c, buildFeed(), { detectFromQuery: true }))
// GET /feed?format=rss&version=0.91
```

受け付ける値の範囲 ([フィードのバージョン](#フィードのバージョン)を参照)の外にある値には、`400 Bad Request` を返します。値自体は有効でも、フィードのデータがそれを満たせない場合は、例外を投げずに `422 Unprocessable Entity` を返します。たとえば `language` がないのに `?version=0.91` を指定したときです。そのバージョンに到達できなくしたのはリクエストであり、サーバーではないからです。コードで固定したバージョンが同じ理由で失敗する場合は、リクエストでは起こせないルート側の不具合なので、これまでどおり例外を投げます。どちらのエラー応答にも `Cache-Control: no-store` が付きます。再現するかどうかは、元のフィードデータが変わることで URL とは無関係に変わりうるため、`cacheControl` オプションの対象にはしていません。

`detectFromQuery` は `detectFormatFromQuery` と `detectVersionFromQuery` の両方をまとめて切り替えるスイッチです。どちらか一方だけを直接指定すれば、フォーマットだけ、またはバージョンだけの検出を有効にできます。

```ts
// Only ?format= is honoured; ?version= (if present) is ignored.
app.get('/feed', (c) => serveFeed(c, buildFeed(), { detectFormatFromQuery: true }))
```

どちらのクエリパラメーター名も変更できます。たとえば URL を短くしたいときに使えます。

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

## Cache-Control

`cacheControl` はこれまでどおり生の文字列を受け取ります。ただ、ディレクティブを手書きすると、カンマの付け忘れやスペルミスのように、気づきにくい間違いをしがちです。そのため `CacheControlDirectives` オブジェクトも受け付けます。

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

`false` を指定すると、これまでどおりヘッダーを完全に省略します。

必要な項目がオブジェクトで足りるなら、オブジェクト形式をおすすめします。ディレクティブ名のタイプミスやカンマの付け忘れが起こりません。ただし生の文字列が非推奨になったわけではありません。ヘッダー本来の形であり、`CacheControlDirectives` がまだ扱っていないディレクティブ (やベンダー拡張)を使う手段として残っています。どちらの形式も正式にサポートしていて、どちらかをなくす予定はありません。

## 追加のレスポンスヘッダー

`serveFeed` を自分でラップしなくて済むように、省略可能なヘッダーを 2 つ用意しています。どちらも既定では送りません。

- **`robots`**: `X-Robots-Tag` を送ります。`robots: 'noindex'` を指定すると、フィード自体は検索結果に出さず、リーダーからの取得はそのまま可能です。
- **`contentDisposition`**: `Content-Disposition` を送ります。`{ filename: 'feed.xml' }` なら `inline; filename="feed.xml"` になります。`type: 'attachment'` を足すと、ブラウザーで表示せずダウンロードさせます。文字列を渡した場合は、そのまま送ります。ファイル名が ASCII 以外なら、RFC 8187 の `filename*` も付きます。どちらの値も制御文字を含むと例外を投げるので、ユーザー入力から作った値でヘッダーが分割されることはありません。

```ts
serveFeed(c, input, {
  robots: 'noindex',
  contentDisposition: { filename: 'feed.xml', type: 'attachment' },
})
```

CORS は `hono/cors` で足りるので、このパッケージでは扱いません。

## 304 で処理を省く

既定では、条件付きリクエストに答えるときでも、データを取得し直すためのやり取りが毎回丸ごと発生します。`serveFeed` は ETag の計算にシリアライズ済みの本文を必要とするので、`304` を返せるのはフィードを組み立てた*後*になるからです。`input` をデータベースから読み込んでいる場合、新しい内容がないポーリングのたびに無駄なクエリが走ります。しかもフィードリーダーは頻繁にポーリングします。

これを解消する 2 つのオプションがあり、併用できます。

- **`etagFrom`**: シリアライズ前に取れる軽量なバリデーターです。コンテンツのリビジョンや `max(updated_at)` の値などを使います。`serveFeed` は `input` に触れる*前*に、これを `If-None-Match` と照合し、一致すれば即座に `304` を返します。
- **遅延評価の `input` 関数**: 値そのものではなく `(): FeedInput | Feed | Promise<...>` を渡します。応答の本文が実際に必要になったときにだけ呼ばれるので、`etagFrom` ですでに応答を返した場合は呼ばれません。

```ts
app.get('/feed', (c) =>
  serveFeed(
    c,
    () => db.getFeedInput(), // only called when a body is actually needed
    { etagFrom: () => db.getRevision() }, // cheap — no need to load the full feed
  ),
)
```

`etagFrom` は同期でも `Promise` でも返せます。どちらの場合でも、`etagFrom` か遅延評価の `input` を使うと、`serveFeed` の戻り値の型は `Response | Promise<Response>` になります (TypeScript がオーバーロードで自動的に判別します。この README のほかの箇所で示している同期的な呼び出しには影響せず、これまでどおり `Response` を返します)。

知っておくとよい点がいくつかあります。

- この段階で確認できるのは `If-None-Match` だけです。`If-Modified-Since` に使う `updated` の日付がまだ存在しないためです。RFC 9110 §13.1.3 では、`If-None-Match` を含むリクエストは `If-Modified-Since` を無視するので、よくある再検証のケースはこれで網羅できます。`If-Modified-Since` だけを持つリクエストでは、通常どおり `input` を解決します。
- 一致しなかった場合は、`etagFrom` の値が応答の `ETag` になります (`etag` オプションは無視されます)。値をそのまま使うか `W/"…"` で包むかは、独自の `etag` 関数と同じ規則です。
- `strictAccept` による `406` と、不正な `?version=` による `400` は、`etagFrom` や `input` に触れる前に判定されます。

## ミドルウェアでオプションを共有する

すべてのルートに同じオプションを書くのは面倒です。`feedMiddleware` を使えば一度だけ設定でき、ルートごとの呼び出しで上書きもできます。

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

## `c.render()` を使う

Hono のレンダラーの流儀が好みなら、`feedRenderer` が `serveFeed` を `c.render` に結び付けます。`jsxRenderer` が HTML を結び付けるのと同じ仕組みです。ルートのミドルウェアとして渡し、`c.render(input)` を返します。

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

> [!NOTE]
> `feedRenderer` は Hono のグローバルな `ContextRenderer` 型を拡張します。そのため、どこかで `hono-feed/renderer` を import すると、プロジェクト全体で `c.render()` がフィードを受け取る型になります。これは `jsxRenderer` と同じトレードオフです。専用のエントリーポイントに分けてあるので、import したときだけ拡張が有効になります。ヘルパーの影響をルート単位に留めたい場合は、代わりに [`feedMiddleware`](#ミドルウェアでオプションを共有する) を使ってください。

## 静的サイト生成

Hono の [`toSSG`](https://hono.dev/docs/helpers/ssg) を使うと、ビルド時にフィードをファイルとして書き出せます。`toSSG` は応答の `Content-Type` からファイルの拡張子を決めますが、フィードの MIME タイプは知らないため、対応づけがないと `feed.json.html` として保存されてしまいます。`feedExtensionMap` は、これらを `.xml` (RSS と Atom)と `.json` に対応づけます。`toSSG` は渡されたマップを自身のマップの代わりに使うので、Hono の `defaultExtensionMap` と合成して渡してください。

```ts
import { Hono } from 'hono'
import { defaultExtensionMap, toSSG } from 'hono/ssg'
import { feedExtensionMap, serveFeed } from 'hono-feed'

const app = new Hono()
app.get('/rss', (c) => serveFeed(c, buildFeed(), { format: 'rss' })) // -> rss.xml
app.get('/feed.json', (c) => serveFeed(c, buildFeed(), { format: 'json' })) // -> feed.json

await toSSG(app, fs, { extensionMap: { ...defaultExtensionMap, ...feedExtensionMap } })
```

## フィードに含める内容

`new Feed(options)` でチャンネルを記述し、`feed.addItem(item)` で記事を追加します。どのフォーマットでも必須なのは `title` だけです。ほかの項目は共通モデルでは省略可能で、各フォーマットの正しい項目に対応づけられます。そのうえで、各フォーマットは*その仕様*が必須とする項目を検証します (例の下の表を参照)。

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

## 本文中の相対 URL を絶対化する

`baseUrl` が絶対化するのは URL を持つ*項目* (`link`、`enclosure.url` など)で、`content` や `description` に入れた HTML の中身は対象外です。フィードリーダーには `<img src="/a.png">` や `<a href="/post">` を解決する基準のページがないので、CMS から取った HTML の画像やリンクが壊れます。フィードのオプションで `absolutizeContent: true` を指定すると、これを書き換えます。

```ts
new Feed({ title: 'Blog', link: 'https://example.com/', absolutizeContent: true })
// <img src="/a.png"> -> <img src="https://example.com/a.png">
```

開始タグの中にある相対的な `src`、`href`、`poster`、`srcset` の値を、`baseUrl` を基準に書き換えます (`serveFeed` では、既定でリクエストの origin が基準です。基準がない場合は何もしません)。本文のテキスト、コメント、CDATA、`<script>` と `<style>` の中身には触れません。すでに絶対 URL の値、フラグメント、ほかのスキーム (`mailto:` や `data:`) の値は、そのまま残します。RSS、Atom、JSON Feed のすべてに適用され、既定ではオフです。

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

## フィードのバージョン

既定の **RSS 2.0**、**Atom 1.0**、**JSON Feed 1.1** は、現代的で推奨されるフォーマットなので、ほとんどのプロジェクトでは変更する必要がありません。これらは型付きのユニオン型なので、エディターは有効な値だけを候補に出します。

| Option | Accepted values | Default |
| --- | --- | --- |
| `rssVersion` | `'2.0'`, `'1.1'`, `'1.0'`, `'0.94'`, `'0.93'`, `'0.92'`, `'0.91'`, `'0.90'` | `'2.0'` |
| `atomVersion` | `'1.0'`, `'0.3'` | `'1.0'` |
| `jsonFeedVersion` | `'1.1'`, `'1'` | `'1.1'` |
| `xmlVersion` | `'1.0'`, `'1.1'` | `'1.0'` |

古いバージョンが必要になった場合に備えて、少し歴史を説明します。**RSS には 2 つの系統があります。** `0.91` から `0.94` と `2.0` は、おなじみの `<rss version="…">` という形を共有しています。RDF 系統はまったく別のドキュメントです。`0.90` は Netscape による最初の "RDF Site Summary"、`1.0` は Dublin Core とコンテンツモジュールを加えたもの、`1.1` は `<Channel>` をルートにしたものです。RSS 1.0 と 1.1 は**サポート対象で、非推奨ではありません**。RDF を求める相手に使ってください。

> [!WARNING]
> **RSS 0.9x、Atom 0.3、JSON Feed 1.0 は非推奨です。** 有効な出力は引き続き生成しますが、それぞれコード付きの `DeprecationWarning` (`HONOFEED_DEP000N`。一覧は [HONOFEED\_DEP.ja.md](HONOFEED_DEP.ja.md) を参照)を一度だけ出力します。Node では `process.emitWarning`、エッジランタイムでは `console.warn` を使います。警告を止めるには、`suppressDeprecationWarnings: true` を指定するか、環境変数 `HONO_FEED_NO_DEPRECATION` を設定するか、Node を `--no-deprecation` で起動します。

## ポッドキャスト

RSS 2.0 では、型付きのポッドキャストメタデータを使えます。iTunes 名前空間 (Apple Podcasts、Spotify、ほとんどのディレクトリが要求するもの)と、Podcasting 2.0 名前空間が対象で、`FeedOptions` (フィード単位)と `FeedItem` (エピソード単位)の `podcast` フィールドに指定します。`xmlns:itunes` / `xmlns:podcast` は、その名前空間の項目がフィード内のどこかで実際に使われているときだけ、自動的に宣言されます。

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

`item.podcast.duration` は省略可能です。未設定の場合、`itunes:duration` は記事の `enclosure.duration` ([前述](#フィードに含める内容))にフォールバックします。そのため、`duration` を持つ通常の `Enclosure` だけで、`podcast` に同じ値を重ねて書かなくても、ポッドキャストのディレクトリに届きます。

`podcast` は RSS 2.0 以外 (ほかのすべての RSS バージョン、Atom、JSON Feed)では無視されます。対応づけられる項目がないためです。`xmlns:itunes` / `xmlns:podcast` を `customNamespaces` に明示した場合は、自動の宣言より常にそちらが優先されます。

## フィードの発見

フィードを配信するだけでは半分です。*見つけてもらえる*ようにする必要もあります。`hono-feed/discovery` は、ブラウザーやフィードリーダーが探す `<link rel="alternate">` タグと、それに相当する HTTP の `Link` ヘッダーを生成します。`serveFeed` 自身が使うのと同じ MIME タイプの表から作るので、両者がずれることはありません。

HTML の `<head>` に入れる場合は次のようにします。

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

`feedLinks(options)` は同じデータを文字列ではなく単純な配列 (`{ rel, type, href, title? }[]`)で返します。JSX など、すでに使っているテンプレートの仕組みで使えます。どちらも `baseUrl` を受け取り、相対のフィード URL を絶対 URL にできます。未指定の場合、href は指定したままになります。相対 URL はブラウザーが現在のページを基準に解決するので、多くの場合はそれで問題ありません。

HTTP ヘッダーで同じことをするには ([RFC 8288](https://www.rfc-editor.org/rfc/rfc8288))、ミドルウェアの `feedLinkHeader` を使います。設定したフォーマットごとに `Link` ヘッダーを 1 つ追加しますが、対象は `Content-Type` が HTML の応答だけです。フィードの応答が自分の別形式を宣伝しても意味がないためです。

```ts
// ESM
import { feedLinkHeader } from 'hono-feed/discovery'

// CJS
const { feedLinkHeader } = require('hono-feed/discovery')

app.use('*', feedLinkHeader({ rss: '/feed.rss' }))
// Link: </feed.rss>; rel="alternate"; type="application/rss+xml"
```

## OPML

複数のフィードを公開しているサイトや、他の人のフィードをまとめているサイトは、[OPML](http://opml.org/spec2.opml) の購読リストを提供できます。フィードリーダーがこのファイルを取り込めば、一度に購読できます。`serveOpml` は `serveFeed` と同じキャッシュの挙動 (`Cache-Control`、弱い `ETag`、`dateModified` からの `Last-Modified`、`304`、`HEAD`)で配信し、`toOPML` は文字列だけを返します。

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

相対の `xmlUrl` / `htmlUrl` / `ownerId` は `baseUrl` (既定はリクエストの origin)を基準に絶対 URL になります。すべてのアウトラインに `text` が必要です。`feedExtensionMap` は `text/x-opml` を `.opml` に対応づけるので、このルートは[静的サイト生成](#静的サイト生成)でも使えます。

## WebSub

[WebSub](https://www.w3.org/TR/websub/) (旧 PubSubHubbub)への対応は、独立した 2 つの機能でできています。購読するリーダーがハブを見つけられるようにすることと、ハブに新しいコンテンツを知らせることです。

**発見**: `FeedOptions` の `hub` は `rel="hub"` のリンクを出力し、リーダーが購読先を判別できるようにします (RSS / Atom は `<atom:link rel="hub">`、JSON Feed は `hubs`)。

```ts
const feed = new Feed({
  title: 'My Blog',
  link: 'https://example.com/',
  hub: 'https://pubsubhubbub.appspot.com/', // or string[] for more than one hub
})
```

`serveFeed` は、WebSub の発見のヘッダー形式として、ハブとフィード自身の URL を HTTP の `Link` ヘッダー (`<…>; rel="hub", <…>; rel="self"`)でも通知します。ハブや購読者は、ドキュメントを解析しなくても見つけられます。

**通知**: `notifyHub()` はフィードが更新されたことをハブに伝えます。購読者は次のポーリングを待たず、リアルタイムに更新を受け取れます。これは WebSub §6 (Publishing)でパブリッシャーに課されている義務です。仕様は方法を定めていないため、`notifyHub` は実際のハブが受け付ける事実上の標準、PubSubHubbub 0.4 の "publish" ping を送ります。

```ts
import { notifyHub } from 'hono-feed'

const results = await notifyHub(
  'https://pubsubhubbub.appspot.com/', // hub(s) — string or string[]
  'https://example.com/feed.rss', // feed URL(s) that changed — string or string[]
)
// [{ hub: 'https://pubsubhubbub.appspot.com/', ok: true, status: 204 }]
```

`notifyHub` は例外を投げません。2xx 以外の応答、ネットワークエラー、中断されたリクエスト (タイムアウトさせたいときは `{ signal }` を渡します)は、すべて拒否(rejection)ではなく結果として報告されます。そのため、到達できないハブが 1 つあっても、公開の流れ全体が失敗することはありません。いずれの場合も、購読者は次のポーリングで更新を受け取れます。

## ページネーション

`FeedOptions` の `paging` は、[RFC 5005](https://www.rfc-editor.org/rfc/rfc5005) (Feed Paging and Archiving)を最初から最後まで扱います。1 つのドキュメントで送るには大きすぎるフィード向けです。

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

RSS 2.0 と Atom 1.0 は、設定した項目ごとに `atom:link` / `link` を 1 つ出力します。JSON Feed が対応するのは `next` だけで、`next_url` になります。仕様にほかの項目に相当するものがないためです。

これらのリンクを自分で組み立てる代わりに、`paginate()` が現在のページの記事を切り出し、そのための `paging` を作ります。1 始まりの `page` (クエリ文字列の値でも構いません。解釈できない値はページ 1 とみなし、末尾を超えたページは最後のページに丸めます)、`perPage`、`url(page)` 関数を渡します。

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

`next` と `prev` は、移動先のページがあるときだけ出力されます。`first` と `last` は、ページが複数あるときに出力されます。丸められたページではなく 404 を返したい場合に備えて、`page` と `totalPages` も返します。

§2 と §4 を完成させる項目がさらに 2 つあります。`complete` (§2)は、このドキュメントが*フィード全体*を含むことを示します。`archive` (§4)は、内容が変わらないアーカイブページであることを示し、`cacheControl: { immutable: true }` と相性が良い設定です。それぞれ `<fh:complete/>` / `<fh:archive/>` を出力し (`xmlns:fh` 名前空間は、どちらかを設定したときだけ自動で宣言されます)、同時には指定できません。両方を設定すると例外を投げます。

```ts
paging: {
  archive: true, // this page never changes; safe to cache forever
  current: '/feed', // rel="current" — where the always-up-to-date document lives
  prevArchive: '/archive/2', // rel="prev-archive" — the preceding archive page
  nextArchive: '/archive/4', // rel="next-archive" — the following archive page
}
```

`prevArchive` / `nextArchive` は、リーダーがアーカイブされたフィードの履歴を 1 ページずつたどるための項目です。そもそも `archive` ページが存在する理由がこれです。

`paging` のほかの項目と同様、`complete` / `archive` / `current` / `prevArchive` / `nextArchive` は RSS 2.0 と Atom 1.0 だけが対象です。JSON Feed にはこれらに対応するものがありません。

## RSS チャンネルの追加要素

`<channel>` の要素には、Atom にも JSON Feed にも相当するものがないものがいくつかあります。そのため共通モデルには含めず、通常の `FeedOptions` のフィールドとして用意しています。`language` や `copyright` と同じく、すべての `<rss version="…">` 構造 (0.91 から 2.0)で使えます。

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

記事単位では、`source` に転載元のフィードを記録できます。RSS 2.0 では `<source url="…">Title</source>`、Atom 1.0 では `<source>` (タイトルと `rel="self"` のリンク。RFC 4287 §4.2.11)になります。`title` と `url` (元の*フィード*の URL)はどちらも必須です。JSON Feed には対応するものがありません。

```ts
feed.addItem({
  title: 'A post worth sharing',
  link: 'https://example.com/shared',
  source: { title: 'Original Blog', url: 'https://original.example/feed.xml' },
})
```

`skipHours` に 0 から 23 の範囲外の値を指定すると、例外を投げます。`textInput` と `cloud` (rssCloud)は、意図的にモデル化していません。`textInput` は実際にはほとんど使われておらず、`cloud` は実際には[前述](#websub)の WebSub 対応に置き換わっています。どちらかが必要なら `customXml` を使ってください。

## Media RSS

`FeedItem` の `media` に指定すると、[Media RSS](https://www.rssboard.org/media-rss) のサムネイルとメディアオブジェクトを追加できます。RSS や Atom の記事にプレビュー画像や動画を付ける、事実上の標準の方法です。`xmlns:media` は、記事のどれかが `media` を設定したときだけ自動で宣言されます (`customNamespaces` に明示した場合は、そちらが優先されます)。

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

URL は、ほかの URL フィールドと同様に `baseUrl` を基準に絶対 URL になります。どのエントリにも `url` が必要です。出力されるのは RSS 2.0 と Atom 1.0 だけで、JSON Feed には対応するものがありません (JSON Feed では記事の `image` を使ってください)。

フィードのオプションで `itemImageAsThumbnail: true` を指定すると、各記事の `image` が RSS 2.0 と Atom 1.0 でも `<media:thumbnail>` として出力されます。Media RSS だけを見るリーダーでもプレビューが表示されます。`media.thumbnails` を設定した記事は、その指定を優先し、サムネイルを追加しません。指定しない場合、`image` は JSON Feed だけに出力されます。

## カスタムフィールドで拡張する

共通モデルは意図的に小さくしてあります。その範囲外のもの (Dublin Core の追加要素、hono-feed がモデル化していない名前空間付きのモジュール、独自の JSON Feed のキーなど)には、抜け道が必要です。それが `customXml` / `customNamespaces` (XML 形式向け)と `customJson` (JSON Feed 向け)で、`FeedOptions` (フィード単位)と `FeedItem` (記事単位)のどちらにも指定できます。

```ts
const feed = new Feed({
  title: 'My Show',
  link: 'https://example.com/',
  customNamespaces: { 'xmlns:dcterms': 'http://purl.org/dc/terms/' },
  customXml: [{ name: 'dcterms:license', text: 'https://creativecommons.org/licenses/by/4.0/' }],
})
```

`customXml` は生の文字列ではなく、JSON 形式の要素ツリー (`{ name, attrs?, children?, text? }`)です。`text` と `attrs` は組み込みの要素とまったく同じようにエスケープされるので、安全に書けます。要素は、そのフォーマットの組み込み要素の後ろ (`<channel>` / `<feed>` または `<item>` / `<entry>` の末尾)に追加されます。RDF (RSS 1.0 / 1.1)と古い RSS 0.9x では、これを使う時点で無効にできる組み込みの制限がないため、無条件に受け入れます。`customNamespaces` はルート要素に `xmlns:*` 宣言を追加します。

`customJson` は、追加のキーを JSON Feed オブジェクトにマージします (フィード単位、記事単位、またはその両方)。[JSON Feed の仕様](https://www.jsonfeed.org/version/1.1/#extensions)に従い、独自のキーは `_` で始めてください。組み込みのキーと衝突した場合は常に組み込みが優先されるので、フィールドを追加することはできても、hono-feed がすでに設定したものを上書きすることはできません。

## 低レベルのシリアライザー

文字列だけが欲しい場面もあります。スナップショットテスト、キュー、Hono 以外の転送手段などです。`toRSS`、`toAtom`、`toJSONFeed` は、HTTP の層なしでまさにそれを返します。

```ts
// ESM
import { toRSS, toAtom, toJSONFeed } from 'hono-feed'

// CJS
const { toRSS, toAtom, toJSONFeed } = require('hono-feed')

// Or import a single one for a smaller bundle:
// 'hono-feed/rss', 'hono-feed/atom', 'hono-feed/json', 'hono-feed/middleware'

const xml = toRSS({ options, items }, { baseUrl: 'https://example.com' })
```

`serveFeed` はシリアライズの前に、フォーマットごとの仕様の検証 (Atom の author の網羅、絶対 IRI の id、必須の日付など)を行います。この低レベルの経路ではそれらの検証は行われないので、必要なら先に自分で `validateInput` を呼んでください。

```ts
import { toAtom, validateInput } from 'hono-feed'

validateInput({ options, items }, 'atom') // throws TypeError with the same messages serveFeed gives
const xml = toAtom({ options, items }, { baseUrl: 'https://example.com' })
```

## リント

`validateInput` が検証するのは、ドキュメントを壊すものだけです (タイトルがない、Atom の author がない、など)。`lintInput` はさらに踏み込み、仕様上は省略可能でも、実際のリーダーやディレクトリが期待している項目を指摘します。たとえばフィードの `description` / `language` / `image` がない、記事に `id`、`author`、日付がない、`podcast` を設定したのにポッドキャストのメタデータが不完全、などです。よくあるミスも検出します。記事の `id` の重複、未来の日付 (多くはタイムゾーンの取り違え)、`content` / `description` に残った相対 URL (リーダーが解決できません)、`type` や `length` がない enclosure、長すぎる、または HTML が混ざったタイトル、100 件を超えるのに `paging` がないフィード、などです。例外は投げず、警告の `string[]` を返します (問題がなければ空)。`serveFeed` はこれを呼ばないので、テストや CI 向けの機能で、配信の経路では使いません。

```ts
import { lintInput } from 'hono-feed'

const warnings = lintInput({ options, items }, 'rss')
// e.g. expect(lintInput({ options, items }, 'rss')).toEqual([]) in a CI check
```

すべてのルールに ID (`LintRuleId`) があり、許容するルールだけ無効にできます。たとえば `lintInput(input, 'rss', { ignore: ['feed-language', 'item-count'] })` のように指定します。`future-date` ルールは現在時刻と比較するので、テストを決定的にしたい場合は `now` を渡してください。

## コントリビュート

コントリビュートを歓迎します。次のような形で参加できます。

- Issue を作成する: 新機能の提案やバグの報告。
- Pull Request を送る: バグや誤字の修正、コードのリファクタリング。
- 共有する: ブログや Twitter などで感想を発信する。
- アプリケーションを作る: ぜひ hono-feed を使ってみてください。

詳しくは [CONTRIBUTING.ja.md](./CONTRIBUTING.ja.md) を参照してください。

## コントリビューター

[すべてのコントリビューター](https://github.com/otnc/hono-feed/graphs/contributors)に感謝します！

<a href="https://github.com/otnc/hono-feed/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=otnc/hono-feed" />
</a>

## 作者

otoneko. https://github.com/otnc

## ライセンス

MIT License のもとで配布しています。詳細は [LICENSE](./LICENSE) を参照してください。
