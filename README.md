# hono-feed

[![npm](https://img.shields.io/npm/v/hono-feed)](https://www.npmjs.com/package/hono-feed) [![npm](https://img.shields.io/npm/dm/hono-feed)](https://www.npmjs.com/package/hono-feed)
[![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/otnc/hono-feed/ci.yml?branch=main)](https://github.com/otnc/hono-feed/actions) [![GitHub](https://img.shields.io/github/license/otnc/hono-feed)](https://github.com/otnc/hono-feed/blob/main/LICENSE) [![GitHub commit activity](https://img.shields.io/github/commit-activity/m/otnc/hono-feed)](https://github.com/otnc/hono-feed/pulse) [![GitHub last commit](https://img.shields.io/github/last-commit/otnc/hono-feed)](https://github.com/otnc/hono-feed/commits/main)
<!-- [![Bundle Size](https://img.shields.io/bundlephobia/min/hono-feed)](https://bundlephobia.com/result?p=hono-feed) [![Bundle Size](https://img.shields.io/bundlephobia/minzip/hono-feed)](https://bundlephobia.com/result?p=hono-feed) -->

> RSS, Atom and JSON Feed for [Hono](https://hono.dev) — done right.

Serving a feed sounds simple, but the details bite: dates have to be in the exact format each spec wants, text has to be XML-escaped, conditional requests should return `304`, and readers ask for different formats through the `Accept` header.  
`hono-feed` takes care of all of that.  
You describe your feed once; it returns a correct HTTP `Response`.

> [!NOTE]
>   
> Zero runtime dependencies, built on Web Standards alone — so it runs anywhere Hono does:  
> Cloudflare Workers, Deno, Bun and Node.  
> `hono` itself is a peer dependency (`>=4`).

## Why hono-feed?

Hono ships no feed helper, so you have two usual options — hand-roll the XML, or pull in a general feed library and wire the HTTP layer around it.  
hono-feed replaces both.

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

It breaks the first time a title contains `&` or `<` (now it's invalid XML), `toUTCString()` isn't quite the RFC-822 date RSS expects, and you still have no Atom or JSON output, no `ETag` / `304`, no `HEAD`, and no caching headers.

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

### vs. a feed library

Libraries like [`feed`](https://github.com/jpmonette/feed) or [`rss`](https://github.com/dylang/node-rss) do handle the escaping and date formats — but they hand you a *string*.  
The HTTP layer is still yours to build:

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

There's also a portability catch.  
Many feed libraries are written for Node and either use Node built-ins (`Buffer`, `stream`, `fs`) or depend on packages that do.  
On Cloudflare Workers, Vercel Edge, Deno or Bun that can mean reaching for polyfills, enabling a `nodejs_compat` flag, or finding it just won't run.  
hono-feed has **zero dependencies** and uses only Web Standard APIs, so the same code runs unchanged on every one of them.

| | Hand-rolled | A feed library | hono-feed |
| --- | --- | --- | --- |
| XML escaping & date formats | your job | handled | handled |
| RSS + Atom + JSON | one format, more routes | usually all three | all three, negotiated |
| HTTP layer (negotiation, `ETag` / `304`, `HEAD`, caching) | DIY | DIY | built in |
| Output | a string | a string | a `Response` |
| Workers / Vercel / Deno / Bun / Node | up to your code | depends on its deps | runs everywhere (Web Standard) |

## Install

```sh
npm install hono-feed # or: pnpm add hono-feed / bun add hono-feed
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

That single endpoint now speaks all three formats.  
A feed reader gets RSS, a browser fetching `application/json` gets JSON Feed, and so on — no extra routes needed.

Prefer plain data over the builder?  
Pass an object instead:

```ts
return serveFeed(c, { options: { title: 'Example Blog', updated: new Date() }, items: [] })
```

## Choosing the format

By default the format is negotiated for you.  
If you'd rather pin an endpoint to one format — the classic `/rss.xml`, `/atom.xml`, `/feed.json` — just say so:

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

1. `?format=rss|atom|json` in the query — only if you opt in with `detectFromQuery: true` (or just `detectFormatFromQuery: true`)
2. A URL extension like `.rss` / `.atom` / `.json` / `.xml` — on by default
3. The `Accept` header, honouring q-values
4. `defaultFormat` (which is `'rss'`)

Negotiated responses carry `Vary: Accept` so caches behave; pinned ones don't, since they never change with the header.

### Choosing a version from the query

`detectFromQuery: true` also turns on version selection through `?version=`, interpreted against whichever version type the resolved format expects (`RssVersion` for `rss`, `AtomVersion` for `atom`, `JsonFeedVersion` for `json`). It only applies when the matching option isn't already pinned in code — `rssVersion` (etc.) set in `serveFeed(...)` always wins over the query.

```ts
app.get('/feed', (c) => serveFeed(c, buildFeed(), { detectFromQuery: true }))
// GET /feed?format=rss&version=0.91
```

A value outside the accepted set (see [Feed versions](#feed-versions)) answers `400 Bad Request`. A value that's valid but that the feed data can't satisfy — e.g. `?version=0.91` without `language` set — answers `422 Unprocessable Entity` instead of throwing, since the request is what made that version unreachable, not the server. A version pinned in code that fails the same way still throws, since that's a bug in the route, not something a request can trigger. Both error responses carry `Cache-Control: no-store` — they're not governed by the `cacheControl` option, since whether they reproduce can change independently of the URL as the underlying feed data changes.

`detectFromQuery` is a convenience switch for both `detectFormatFromQuery` and `detectVersionFromQuery` — set either one directly to turn on just format or just version detection:

```ts
// Only ?format= is honoured; ?version= (if present) is ignored.
app.get('/feed', (c) => serveFeed(c, buildFeed(), { detectFormatFromQuery: true }))
```

Both query param names can be renamed, e.g. to keep URLs short:

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

`cacheControl` takes a raw string, same as before — but hand-writing directives is easy to get subtly wrong (a missed comma, a misspelled directive), so it also accepts a `CacheControlDirectives` object:

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

`false` still omits the header entirely, same as always.

The object form is recommended when the fields cover what you need — it can't typo a directive name or forget a comma. The raw string isn't deprecated, though: it's the header's own native shape, and it's still the way to reach directives (or vendor extensions) `CacheControlDirectives` doesn't model yet. Both forms are first-class and neither is going away.

## Skipping work on a 304

By default, answering a conditional request still costs a full round trip through your data: `serveFeed` needs the serialized body to compute its ETag, so a `304` only happens *after* you've already built the feed. If `input` is loaded from a database, that's a wasted query on every poll that finds nothing new — and feed readers poll a lot.

Two options fix this, and they can be used together:

- **`etagFrom`** — a cheap, pre-serialization validator (a content revision, a `max(updated_at)` scalar, …). `serveFeed` checks it against `If-None-Match` *before* touching `input` at all; a match answers `304` immediately.
- **A lazy `input` function** — `(): FeedInput | Feed | Promise<...>` instead of a plain value. It's only called when a response body is actually needed, so it's never invoked when `etagFrom` already short-circuited.

```ts
app.get('/feed', (c) =>
  serveFeed(
    c,
    () => db.getFeedInput(), // only called when a body is actually needed
    { etagFrom: () => db.getRevision() }, // cheap — no need to load the full feed
  ),
)
```

`etagFrom` may return synchronously or as a `Promise`; either way, `serveFeed`'s return type becomes `Response | Promise<Response>` once `etagFrom` or a lazy `input` is used (TypeScript picks this up automatically via overloads — the plain, synchronous call shown everywhere else in this README is unaffected and keeps returning a plain `Response`).

A few things worth knowing:
- Only `If-None-Match` can be checked this early — there's no `updated` date yet for `If-Modified-Since`. Per RFC 9110 §13.1.3, a request carrying `If-None-Match` ignores `If-Modified-Since` anyway, so this still covers the common revalidation case; a request with only `If-Modified-Since` resolves `input` normally.
- On a miss, the `etagFrom` value becomes the response's `ETag` (the `etag` option is ignored) — same verbatim-vs-`W/"…"` wrapping rule as a custom `etag` function.
- `strictAccept`'s `406` and an invalid `?version=`'s `400` are both resolved before `etagFrom` or `input` are ever touched.

## Sharing options with middleware

Setting the same options on every route gets repetitive.  
`feedMiddleware` lets you set them once; each route can still override them per call.

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

Prefer Hono's renderer convention?  
`feedRenderer` wires `serveFeed` into `c.render`, the same way `jsxRenderer` wires up HTML.  
Pass it as route middleware and return `c.render(input)`:

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
> `feedRenderer` augments Hono's global `ContextRenderer` type, so importing `hono-feed/renderer` anywhere makes `c.render()` take a feed across your whole project — the same trade-off `jsxRenderer` makes.  
> Keeping it on its own entry point is what makes that opt-in: you get the augmentation only if you import it.  
> If you'd rather keep the helper scoped to a route, use [`feedMiddleware`](#sharing-options-with-middleware) instead.

## What goes in a feed

`new Feed(options)` describes the channel; `feed.addItem(item)` adds an entry.  
Only `title` is required everywhere — the other fields are optional in the neutral model and map to the right field in every format.  
On top of that, each format enforces the fields *its spec* makes mandatory (see the table below the example).

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

Rather than emit a document that violates its spec, `serveFeed` checks these per-format requirements up front and throws a `TypeError` when one is missing:

| Format | The feed needs | Every item needs |
| --- | --- | --- |
| RSS | `link` (falls back to `feedUrl`, then the request URL) | — |
| Atom | an `author` (here, or on every item) · `updated` when there are no items · `id` must be an absolute IRI | `id` or `link` (ids must be absolute IRIs) · `updated` or `published` · `link` or `content` |
| JSON Feed | — | `id` or `link` · `content` or `description` |

(Deprecated versions add a couple more — e.g. RSS 0.91 requires `language` — with equally explicit error messages.)

`Enclosure.length` is optional in the neutral model, but RSS's `<enclosure>` requires the attribute — when it's unset, RSS emits `length="0"`, per the RSS Best Practices Profile ("If the length of an enclosure cannot be determined, a publisher SHOULD use a length of zero"). JSON Feed omits `size_in_bytes` instead, since it's optional there.

> [!TIP]
>   
> hono-feed does the XML escaping for you, but it doesn't HTML-encode entities.  
> If you need that — e.g. to turn arbitrary text into a safe HTML `content`/`description` value — reach for [`he`](https://www.npmjs.com/package/he) (`he.encode(text)`), plus [`@types/he`](https://www.npmjs.com/package/@types/he) for its TypeScript types.

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

## Feed versions

The defaults — **RSS 2.0**, **Atom 1.0**, **JSON Feed 1.1** — are the modern, recommended formats, so most projects never touch these.  
They're typed unions, so your editor only offers valid values:

| Option | Accepted values | Default |
| --- | --- | --- |
| `rssVersion` | `'2.0'`, `'1.1'`, `'1.0'`, `'0.94'`, `'0.93'`, `'0.92'`, `'0.91'`, `'0.90'` | `'2.0'` |
| `atomVersion` | `'1.0'`, `'0.3'` | `'1.0'` |
| `jsonFeedVersion` | `'1.1'`, `'1'` | `'1.1'` |
| `xmlVersion` | `'1.0'`, `'1.1'` | `'1.0'` |

A bit of history, in case you need an older version: **RSS comes in two families.**  
`0.91` through `0.94` and `2.0` share the familiar `<rss version="…">` shape.  
The RDF family is a different document entirely — `0.90` is Netscape's original "RDF Site Summary", `1.0` adds Dublin Core and content modules, and `1.1` uses a `<Channel>` root.  
RSS 1.0 and 1.1 are fully **supported, not deprecated** — reach for them when a consumer specifically wants RDF.

> [!WARNING]
>   
> **RSS 0.9x, Atom 0.3 and JSON Feed 1.0 are deprecated.**  
> They still produce valid output, but each logs a one-time, coded `DeprecationWarning` (`HONOFEED_DEP000N`, see [HONOFEED_DEP.md](HONOFEED_DEP.md) for the full list) — through `process.emitWarning` on Node, or `console.warn` on edge runtimes.  
> To silence it, set `suppressDeprecationWarnings: true`, the `HONO_FEED_NO_DEPRECATION` env var, or run Node with `--no-deprecation`.

## Podcasts

RSS 2.0 gets typed podcast metadata — the iTunes namespace (what Apple Podcasts, Spotify, and most directories require) and the Podcasting 2.0 namespace — via a `podcast` field on `FeedOptions` (feed-level) and `FeedItem` (episode-level). `xmlns:itunes` / `xmlns:podcast` are declared automatically, only when a field from that namespace is actually used somewhere in the feed:

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
    // Podcasting 2.0:
    transcript: [{ url: 'https://example.com/1.vtt', type: 'text/vtt' }],
    chapters: { url: 'https://example.com/1-chapters.json' },
  },
})
```

`item.podcast.duration` is optional — when unset, `itunes:duration` falls back to the item's `enclosure.duration` ([above](#what-goes-in-a-feed)), so a plain `Enclosure` with a `duration` still reaches podcast directories without repeating it under `podcast`.

`podcast` is ignored outside RSS 2.0 (every other RSS version, Atom, and JSON Feed) — there's no equivalent to map it to. An explicit `customNamespaces` entry for `xmlns:itunes` / `xmlns:podcast` always wins over the automatic declaration.

## Feed discovery

Serving a feed is half the story — it also has to be *findable*. `hono-feed/discovery` generates the `<link rel="alternate">` tags browsers and feed readers look for, and an HTTP `Link` header equivalent, from the same MIME-type table `serveFeed` itself uses (so they can never drift apart).

For an HTML `<head>`:

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

`feedLinks(options)` returns the same data as a plain array (`{ rel, type, href, title? }[]`) instead of a string, for JSX or any other templating you already use. Both accept `baseUrl` to absolutize relative feed URLs; left unset, hrefs stay exactly as given (relative, resolved by the browser against the current page — which is usually what you want).

For the HTTP-header equivalent ([RFC 8288](https://www.rfc-editor.org/rfc/rfc8288)), `feedLinkHeader` is middleware that appends one `Link` header per configured format, but only to responses whose `Content-Type` is HTML — a feed response has no use for advertising its own alternates:

```ts
// ESM
import { feedLinkHeader } from 'hono-feed/discovery'

// CJS
const { feedLinkHeader } = require('hono-feed/discovery')

app.use('*', feedLinkHeader({ rss: '/feed.rss' }))
// Link: </feed.rss>; rel="alternate"; type="application/rss+xml"
```

## WebSub

Two independent halves make up [WebSub](https://www.w3.org/TR/websub/) (formerly PubSubHubbub) support — subscribing readers can discover a hub, and you can tell that hub about new content.

**Discovery** — `hub` on `FeedOptions` emits `rel="hub"` links so readers know where to subscribe (RSS/Atom `<atom:link rel="hub">`, JSON Feed `hubs`):

```ts
const feed = new Feed({
  title: 'My Blog',
  link: 'https://example.com/',
  hub: 'https://pubsubhubbub.appspot.com/', // or string[] for more than one hub
})
```

**Notification** — `notifyHub()` sends the hub the WebSub §5 "publish" ping after you publish or update content, so subscribers get it in real time instead of waiting for their next poll:

```ts
import { notifyHub } from 'hono-feed'

const results = await notifyHub(
  'https://pubsubhubbub.appspot.com/', // hub(s) — string or string[]
  'https://example.com/feed.rss', // feed URL(s) that changed — string or string[]
)
// [{ hub: 'https://pubsubhubbub.appspot.com/', ok: true, status: 204 }]
```

`notifyHub` never throws — a non-2xx response, a network error, and an aborted request (pass `{ signal }` to time one out) are all reported as a result rather than a rejection, so one unreachable hub can't fail your publish flow. Subscribers still get the update on their next poll either way.

## Extending with custom fields

The neutral model is deliberately small — anything outside it (Media RSS, Dublin Core extras, a namespaced module hono-feed doesn't model, custom JSON Feed keys) needs an escape hatch. `customXml` / `customNamespaces` (XML formats) and `customJson` (JSON Feed) are that hatch, on both `FeedOptions` (feed-level) and `FeedItem` (item-level):

```ts
const feed = new Feed({
  title: 'My Show',
  link: 'https://example.com/',
  customNamespaces: { 'xmlns:media': 'http://search.yahoo.com/mrss/' },
  customXml: [{ name: 'media:rating', text: 'nonadult' }],
})
```

`customXml` is a JSON-shaped element tree (`{ name, attrs?, children?, text? }`), not a raw string — `text`/`attrs` are escaped exactly like every built-in element, so this stays correct by construction. Elements are appended after the format's built-in ones (`<channel>`/`<feed>` or `<item>`/`<entry>`); RDF (RSS 1.0/1.1) and legacy RSS 0.9x accept them unconditionally, since there's no built-in gating to opt out of once you've reached for this. `customNamespaces` adds `xmlns:*` declarations to the root element.

`customJson` merges extra keys into the JSON Feed object (feed-level and/or per item) — per the [JSON Feed spec](https://www.jsonfeed.org/version/1.1/#extensions), custom keys should start with `_`. A built-in key always wins on collision, so this can only add fields, never override one hono-feed already sets.

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

`serveFeed` runs the same per-format spec validation (Atom author coverage, absolute-IRI ids, required dates, …) before serializing — those checks aren't otherwise run on this low-level path, so if you want them, call `validateInput` yourself first:

```ts
import { toAtom, validateInput } from 'hono-feed'

validateInput({ options, items }, 'atom') // throws TypeError with the same messages serveFeed gives
const xml = toAtom({ options, items }, { baseUrl: 'https://example.com' })
```

## Contributing

Contributions Welcome! You can contribute in the following ways.

- Create an Issue - Propose a new feature. Report a bug.
- Pull Request - Fix a bug or typo. Refactor the code.
- Share - Share your thoughts on the Blog, Twitter, and others.
- Make your application - Please try to use hono-feed.

For more details, see [CONTRIBUTING.md](./CONTRIBUTING.md).

## Contributors

Thanks to [all contributors](https://github.com/otnc/hono-feed/graphs/contributors)!

<a href="https://github.com/otnc/hono-feed/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=otnc/hono-feed" />
</a>

## Authors

otoneko. https://github.com/otnc

## License

Distributed under the Apache-2.0. See [LICENSE](./LICENSE) for more information.