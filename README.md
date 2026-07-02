# hono-feed

[![npm](https://img.shields.io/npm/v/hono-feed)](https://www.npmjs.com/package/hono-feed) [![npm](https://img.shields.io/npm/dm/hono-feed)](https://www.npmjs.com/package/hono-feed)
[![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/otnc/hono-feed/ci.yml?branch=main)](https://github.com/otnc/hono-feed/actions) [![GitHub](https://img.shields.io/github/license/otnc/hono-feed)](https://github.com/otnc/hono-feed/blob/main/LICENSE) [![GitHub commit activity](https://img.shields.io/github/commit-activity/m/otnc/hono-feed)](https://github.com/otnc/hono-feed/pulse) [![GitHub last commit](https://img.shields.io/github/last-commit/otnc/hono-feed)](https://github.com/otnc/hono-feed/commits/main)
<!-- [![Bundle Size](https://img.shields.io/bundlephobia/min/hono-feed)](https://bundlephobia.com/result?p=hono-feed) [![Bundle Size](https://img.shields.io/bundlephobia/minzip/hono-feed)](https://bundlephobia.com/result?p=hono-feed) -->

> RSS, Atom and JSON Feed for [Hono](https://hono.dev) — done right.

Serving a feed sounds simple, but the details bite: dates have to be in the exact format each
spec wants, text has to be XML-escaped, conditional requests should return `304`, and readers
ask for different formats through the `Accept` header. `hono-feed` takes care of all of that.
You describe your feed once; it returns a correct HTTP `Response`.

> [!NOTE]
>   
> Zero runtime dependencies, built on Web Standards alone — so it runs anywhere Hono does:
> Cloudflare Workers, Deno, Bun and Node. `hono` itself is a peer dependency (`>=4`).

## Why hono-feed?

Hono ships no feed helper, so you have two usual options — hand-roll the XML, or pull in a
general feed library and wire the HTTP layer around it. hono-feed replaces both.

### vs. hand-rolling the XML

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

It breaks the first time a title contains `&` or `<` (now it's invalid XML), `toUTCString()`
isn't quite the RFC-822 date RSS expects, and you still have no Atom or JSON output, no
`ETag` / `304`, no `HEAD`, and no caching headers.

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
    options: { title: 'Example Blog', link: 'https://example.com/' },
    items: posts.map((p) => ({ title: p.title, link: p.url, published: p.date, content: p.body })),
  }),
)
```

### vs. a feed library

Libraries like [`feed`](https://github.com/jpmonette/feed) or
[`rss`](https://github.com/dylang/node-rss) do handle the escaping and date formats — but they
hand you a *string*. The HTTP layer is still yours to build:

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
    options: { title: 'Example Blog', link: 'https://example.com/' },
    items: posts.map((p) => ({ title: p.title, link: p.url, published: p.date, content: p.body })),
  }),
)
```

There's also a portability catch. Many feed libraries are written for Node and either use Node
built-ins (`Buffer`, `stream`, `fs`) or depend on packages that do. On Cloudflare Workers,
Vercel Edge, Deno or Bun that can mean reaching for polyfills, enabling a `nodejs_compat` flag,
or finding it just won't run. hono-feed has **zero dependencies** and uses only Web Standard
APIs, so the same code runs unchanged on every one of them.

| | Hand-rolled | A feed library | hono-feed |
| --- | --- | --- | --- |
| XML escaping & date formats | your job | handled | handled |
| RSS + Atom + JSON | one format, more routes | usually all three | all three, negotiated |
| HTTP layer (negotiation, `ETag` / `304`, `HEAD`, caching) | DIY | DIY | built in |
| Output | a string | a string | a `Response` |
| Workers / Vercel / Deno / Bun / Node | up to your code | depends on its deps | runs everywhere (Web Standard) |

## Install

```sh
npm install hono-feed   # or: pnpm add hono-feed / bun add hono-feed
```

## Quick start

Build a feed, add your items, and hand it to `serveFeed`:

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

That single endpoint now speaks all three formats. A feed reader gets RSS, a browser fetching
`application/json` gets JSON Feed, and so on — no extra routes needed.

Prefer plain data over the builder? Pass an object instead:

```ts
return serveFeed(c, { options: { title: 'Example Blog' }, items: [] })
```

## Choosing the format

By default the format is negotiated for you. If you'd rather pin an endpoint to one format —
the classic `/rss.xml`, `/atom.xml`, `/feed.json` — just say so:

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

When `format` isn't set, `serveFeed` works through these in order until one matches:

1. `?format=rss|atom|json` in the query — only if you opt in with `detectFromQuery: true`
2. A URL extension like `.rss` / `.atom` / `.json` / `.xml` — on by default
3. The `Accept` header, honouring q-values
4. `defaultFormat` (which is `'rss'`)

Negotiated responses carry `Vary: Accept` so caches behave; pinned ones don't, since they
never change with the header.

## Sharing options with middleware

Setting the same options on every route gets repetitive. `feedMiddleware` lets you set them
once; each route can still override them per call.

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

## Using `c.render()`

Prefer Hono's renderer convention? `feedRenderer` wires `serveFeed` into `c.render`, the same
way `jsxRenderer` wires up HTML. Pass it as route middleware and return `c.render(input)`:

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
>   
> `feedRenderer` augments Hono's global `ContextRenderer` type, so importing `hono-feed/renderer`
> anywhere makes `c.render()` take a feed across your whole project — the same trade-off
> `jsxRenderer` makes. Keeping it on its own entry point is what makes that opt-in: you get the
> augmentation only if you import it. If you'd rather keep the helper scoped to a route, use
> [`feedMiddleware`](#sharing-options-with-middleware) instead.

## What goes in a feed

`new Feed(options)` describes the channel; `feed.addItem(item)` adds an entry. Only `title`
is required in each — everything else is optional and maps to the right field in every format.

```ts
// ESM
import { Feed } from 'hono-feed'

// CJS
const { Feed } = require('hono-feed')

const feed = new Feed({
  title: 'Example Blog',     // required
  link: 'https://example.com/',
  description: 'Notes and writing',
  language: 'en',
  author: { name: 'Ada', email: 'ada@example.com' },
  updated: new Date(),
})

feed.addItem({
  title: 'Hello, world',     // required
  link: 'https://example.com/hello',
  description: 'A short summary',
  content: '<p>The full HTML body.</p>',
  published: new Date('2026-06-29'),
  categories: [{ term: 'intro' }],
})
```

> [!TIP]
>   
> hono-feed does the XML escaping for you, but it doesn't HTML-encode entities. If you need
> that — e.g. to turn arbitrary text into a safe HTML `content`/`description` value — reach for
> [`he`](https://www.npmjs.com/package/he) (`he.encode(text)`), plus
> [`@types/he`](https://www.npmjs.com/package/@types/he) for its TypeScript types.

## Options

All options for `serveFeed(c, input, options?)`:

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `format` | `FeedFormat` | – | Pin the format and skip negotiation |
| `defaultFormat` | `FeedFormat` | `'rss'` | Used when negotiation finds no match |
| `detectFromExtension` | `boolean` | `true` | Read the format from `.rss` / `.atom` / `.json` / `.xml` |
| `detectFromQuery` | `boolean` | `false` | Read the format from `?format=` |
| `cacheControl` | `string \| false` | `'public, max-age=3600'` | `Cache-Control` header (`false` to omit) |
| `etag` | `boolean` | `true` | Send a weak `ETag` and answer `304` on a match |
| `lastModified` | `boolean` | `true` | Send `Last-Modified` from `feed.updated` |
| `baseUrl` | `string` | request origin | Base used to turn relative URLs into absolute ones |
| `pretty` | `boolean` | `false` | Indent the output for readability |
| `rssVersion` | `RssVersion` | `'2.0'` | Which RSS version / structure to emit |
| `atomVersion` | `AtomVersion` | `'1.0'` | Which Atom version to emit |
| `jsonFeedVersion` | `JsonFeedVersion` | `'1.1'` | Which JSON Feed version to emit |
| `xmlVersion` | `XmlVersion` | `'1.0'` | XML declaration version (RSS/Atom) |
| `suppressDeprecationWarnings` | `boolean` | `false` | Mute warnings for deprecated versions |

## Feed versions

The defaults — **RSS 2.0**, **Atom 1.0**, **JSON Feed 1.1** — are the modern, recommended
formats, so most projects never touch these. They're typed unions, so your editor only offers
valid values:

| Option | Accepted values | Default |
| --- | --- | --- |
| `rssVersion` | `'2.0'`, `'1.1'`, `'1.0'`, `'0.94'`, `'0.93'`, `'0.92'`, `'0.91'`, `'0.90'` | `'2.0'` |
| `atomVersion` | `'1.0'`, `'0.3'` | `'1.0'` |
| `jsonFeedVersion` | `'1.1'`, `'1'` | `'1.1'` |
| `xmlVersion` | `'1.0'`, `'1.1'` | `'1.0'` |

A bit of history, in case you need an older version: **RSS comes in two families.** `0.91`
through `0.94` and `2.0` share the familiar `<rss version="…">` shape. The RDF family is a
different document entirely — `0.90` is Netscape's original "RDF Site Summary", `1.0` adds
Dublin Core and content modules, and `1.1` uses a `<Channel>` root. RSS 1.0 and 1.1 are fully
**supported, not deprecated** — reach for them when a consumer specifically wants RDF.

> [!WARNING]
>   
> **RSS 0.9x, Atom 0.3 and JSON Feed 1.0 are deprecated.** They still produce valid output,
> but each logs a one-time, coded `DeprecationWarning` (`HONOFEED_DEP000N`) — through
> `process.emitWarning` on Node, or `console.warn` on edge runtimes. To silence it, set
> `suppressDeprecationWarnings: true`, the `HONO_FEED_NO_DEPRECATION` env var, or run Node with
> `--no-deprecation`.

## Low-level serializers

Sometimes you just want the string — for a snapshot test, a queue, or a non-Hono transport.
`toRSS`, `toAtom` and `toJSONFeed` give you exactly that, with no HTTP layer involved:

```ts
// ESM
import { toRSS, toAtom, toJSONFeed } from 'hono-feed'

// CJS
const { toRSS, toAtom, toJSONFeed } = require('hono-feed')

// Or import a single one for a smaller bundle:
// 'hono-feed/rss', 'hono-feed/atom', 'hono-feed/json', 'hono-feed/middleware'

const xml = toRSS({ options, items }, { baseUrl: 'https://example.com' })
```

## License

[Apache-2.0](./LICENSE) © otoneko.
