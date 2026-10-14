# Changelog

All notable changes to this project are documented here. This file is generated from commit messages by [git-cliff](https://git-cliff.org) when the `release` workflow runs.

## [1.2.0](https://github.com/otnc/hono-feed/releases/tag/v1.2.0) - 2026-10-14

### Features

- Add paginate() to build RFC 5005 paging links
- Add feedExtensionMap for hono/ssg
- Add toOPML and serveOpml
- Add Media RSS thumbnails and content via item.media
- Add item.source for RSS 2.0 and Atom 1.0
- Send WebSub hub and self Link headers from serveFeed
- Map item.comments to Atom link rel=replies
- Add generic links to feed options and items
- Add absolutizeContent to resolve relative URLs in item HTML
- Add itemImageAsThumbnail to emit item.image as media:thumbnail
- Add lint rules and an ignore option to lintInput
- Add robots and contentDisposition options to serveFeed
- Add more Podcasting 2.0 tags (person, license, location, images, socialInteract, medium, trailer, season, episode)

### Bug fixes

- Keep supporting Node.js 20 in engines
- Avoid a control-character regex in header validation

### Refactoring

- Speed up default ETag hashing and remove duplicated code
- Share Atom and RSS 1.0/1.1 serializer helpers
- Split toRSS2 into channel and namespace builders

### Documentation

- Tidy comments and add usage examples to public API docs
- Join hard-wrapped comments and docs into single lines
- Make README, CONTRIBUTING and HONOFEED_DEP bilingual with Kiritan
- Document WebSub Link headers and Atom replies for comments
- Remove reference to optional fields in RSS conformance test description
- Add waitUntil and hono/jsx recipes for notifyHub and feedLinks

## [1.1.0](https://github.com/otnc/hono-feed/releases/tag/v1.1.0) - 2026-07-14

### Features

- Allow FeedOptions.author to be Author | Author[]
- **podcast:** Itunes:category subcategory nesting (Apple's two-level taxonomy)
- Map Category.label to Atom's label attribute (RFC 4287 §4.2.2.3)
- Map Enclosure.title to JSON Feed attachment title

### Bug fixes

- **discovery:** Percent-encode non-BMP href characters correctly
- **atom:** Reject a relative atom:id from the link/self fallback

## [1.0.1](https://github.com/otnc/hono-feed/releases/tag/v1.0.1) - 2026-07-10

### Bug fixes

- Forgot to change

## [1.0.0](https://github.com/otnc/hono-feed/releases/tag/v1.0.0) - 2026-07-10

### Features

- **rss:** Dc:creator fallback for item authors without an email
- **lint:** Add lintInput soft-validation helper
- **lint:** Export lintInput from package root
- **types:** Add Author.avatar and FeedOptions.userComment
- **json:** Emit author avatar and feed user_comment
- **types:** Add contributors to FeedOptions and FeedItem
- **atom:** Parameterize atomAuthorEl's element name
- **atom:** Emit contributor and per-entry xml:lang (Atom 1.0)
- **types:** Add FeedOptions.published
- **rss:** Emit channel <pubDate> from options.published
- **validate:** Validate FeedOptions.published
- **types:** Add remaining Apple-documented podcast fields
- **podcast:** Emit remaining itunes show/episode elements
- **lint:** Flag missing Atom alternate link and archive rel=current

### Bug fixes

- **rss:** Gate comments/channel category to RSS 2.0, not 0.92+
- **json:** Absolutize author.url, like every other JSON Feed URL field
- **serve:** Only evaluate conditional requests for GET/HEAD
- **validate:** Reject a negative or non-integer ttl

### Documentation

- Add a Linting section documenting lintInput
- **podcast:** Document the new itunes show/episode fields
- Clarify format-query fallback and Feed.toInput() sharing
- Add logo

## [0.7.1](https://github.com/otnc/hono-feed/releases/tag/v0.7.1) - 2026-07-09

### Bug fixes

- **rss:** Emit managingEditor on every RSS version, not just 2.0
- **xml:** EscapeText now preserves carriage returns round-trip

## [0.7.0](https://github.com/otnc/hono-feed/releases/tag/v0.7.0) - 2026-07-09

### Features

- Add notifyHub() for WebSub publish notifications
- Export notifyHub from the package root
- Add hono-feed/discovery (feedLinks, feedLinksHtml, feedLinkHeader)
- Wire the hono-feed/discovery subpath into the build and exports map
- Add paging.complete/archive/current to the neutral model
- Reject paging.complete and paging.archive both set
- **rss:** Emit fh:complete/fh:archive and rel=current (RSS 2.0)
- **atom:** Emit fh:complete/fh:archive and rel=current (Atom 1.0)
- Add webmaster/docs/skipHours/skipDays to FeedOptions
- **rss:** Emit webMaster/docs/skipHours/skipDays (RSS 0.91+)
- Reject skipHours values outside 0-23
- Add paging.prevArchive/nextArchive (RFC 5005 §4)

### Bug fixes

- **discovery:** RFC 8288/8187-safe Link headers (non-ASCII, quotes, spaces, XHTML)
- **release:** Trusted Publisher
- **ci:** Pin release workflow's npm install to the 11.x line

### Refactoring

- Extract FEED_MIME_TYPES as the shared source for feed MIME types

### Documentation

- Add a WebSub section covering hub discovery and notifyHub()
- Add a Feed discovery section for hono-feed/discovery
- Add a Pagination section covering RFC 5005 in full
- Add an RSS channel extras section (webMaster/docs/skipHours/skipDays)
- **websub:** Cite WebSub sec. 6 (Publishing), not sec. 5
- Document paging.prevArchive/nextArchive in the Pagination section

## [0.6.1](https://github.com/otnc/hono-feed/releases/tag/v0.6.1) - 2026-07-07

### Bug fixes

- Three patch-level issues found in the pre-0.7.0 review

## [0.6.0](https://github.com/otnc/hono-feed/releases/tag/v0.6.0) - 2026-07-07

### Features

- Add Enclosure.duration, mapped to JSON Feed duration_in_seconds
- Pre-serialization 304 shortcut (etagFrom) and lazy input
- Podcast support (iTunes + Podcasting 2.0 namespaces, RSS 2.0)

## [0.5.1](https://github.com/otnc/hono-feed/releases/tag/v0.5.1) - 2026-07-07

### Bug fixes

- Honour RFC 9110 §12.5.1 precedence in Accept negotiation
- XML builder safety — legal boolean attrs, validated custom names
- Conditional request handling per RFC 9110
- Xmlns:content declaration matches the actual <content:encoded> gate
- ParseAccept respects quoted-string boundaries

## [0.5.0](https://github.com/otnc/hono-feed/releases/tag/v0.5.0) - 2026-07-07

### Features

- WebSub hub discovery (link rel=hub / JSON Feed hubs)
- **json:** Support external_url, banner_image, expired, per-item language, and multiple attachments
- Feed pagination links (RFC 5005 next/previous/first/last, JSON next_url)
- XmlElementSpec type and specToNode escape-hatch builder
- **rss:** Wire customXml/customNamespaces into RSS 2.0 and RDF
- **atom:** Wire customXml/customNamespaces into Atom 1.0
- **json:** CustomJson escape hatch, feed- and item-level
- Feed-level categories (RSS channel, Atom feed, RDF dc:subject)
- **atom:** Map image/favicon to <logo>/<icon>
- **pr-labeler:** Recheck all open PRs' conflict status on push to main
- Widen ETag to 64-bit FNV-1a, allow a custom tag function
- StrictAccept option to answer 406 when Accept rejects everything
- Export validateInput from the root and format subpaths
- **rss:** Emit channel managingEditor and item comments

### Bug fixes

- **pr-labeler:** Double-escaped checkbox regex meant bug/enhancement never matched
- **pr-labeler:** Recheck-on-push also reconciles checkbox/branch labels

### Documentation

- Document the custom XML/JSON extension escape hatch
- Add missing strictAccept row to the options table
- Mention validateInput for low-level serializer callers

## [0.4.3](https://github.com/otnc/hono-feed/releases/tag/v0.4.3) - 2026-07-06

### Features

- **pr-labeler:** Also run on new PR comments

### Bug fixes

- **atom:** Emit link rel="enclosure" for item.enclosure

### Refactoring

- Move pr-labeler scripts out of the workflow YAML

## [0.4.2](https://github.com/otnc/hono-feed/releases/tag/v0.4.2) - 2026-07-06

### Bug fixes

- Split import/require types in exports map, add package export checks
- Absolutize serveFeed's derived feedUrl against baseUrl

### Refactoring

- Derive smoke-test entry points from package.json exports

### Documentation

- Add fields
- Mention test:coverage in the PR template and CONTRIBUTING
- Change format
- Add contrib.rocks image
- Change "X" to "Twitter"
- Fix Enclosure.length doc comment and document its actual behavior

## [0.4.1](https://github.com/otnc/hono-feed/releases/tag/v0.4.1) - 2026-07-05

### Performance

- **xml:** Make escapeAttr a single regex pass
- **date:** Drop the per-item array allocation in latestDate

### Refactoring

- **formats:** Extract firstAuthor/authorList to dedupe author normalization
- **rss:** Extract shared rdfItem builder for RSS 1.0/1.1
- **atom:** Extract shared atomAuthorEl for 0.3/1.0
- **formats:** Drop dead absolutize() ?? fallbacks
- **negotiate:** Drop the manual stable-sort tiebreak in parseAccept
- **formats:** Lean on renderAttrs skipping undefined attributes
- **formats:** Extract selfUrl() for the feed self-URL precedence rule
- **atom:** Extract atomFeedIdentity shared by 0.3/1.0
- **negotiate:** Build the four membership guards from one factory

## [0.4.0](https://github.com/otnc/hono-feed/releases/tag/v0.4.0) - 2026-07-05

### Features

- **serve:** Let requests select a feed version through ?version=
- **serve:** Accept a CacheControlDirectives object for cacheControl

### Documentation

- **cacheControl:** Add announce for recommended format

## [0.3.1](https://github.com/otnc/hono-feed/releases/tag/v0.3.1) - 2026-07-03

### Bug fixes

- Format
- **rss:** Emit mandatory rdf:parseType="Collection" on RSS 1.1 <items>
- **rss:** Always emit the mandatory channel/item/image <link>
- **rss:** Restrict 0.91-0.94 output to era-appropriate elements
- **atom:** Enforce RFC 4287 author, alternate-link and IRI id rules
- **atom:** Always emit Atom 0.3 <issued>; enforce XML 1.0 serialization
- **json:** Guarantee a body field and id per item; emit true 1.0 shape
- **serve:** Validate with the request-derived feedUrl

### Documentation

- Add README badges
- Remove bundle size badges
- Remove category
- Align README with per-format validation
- Rewrap prose to one sentence per line
- Add `HONOFEED_DEP` wiki

## [0.3.0](https://github.com/otnc/hono-feed/releases/tag/v0.3.0) - 2026-07-02

### Features

- Restore feedRenderer

### Bug fixes

- `updatedDate' bugs
- Escape chars

### Refactoring

- Dispatch format serializers via a map

## [0.2.0](https://github.com/otnc/hono-feed/releases/tag/v0.2.0) - 2026-06-30

### Features

- FeedRenderer logic
- Add path

### Bug fixes

- Change method `feedUrl` query param
- Content when no item has content
- When unuse

### Documentation

- Add feedRenderer description

## [0.1.0](https://github.com/otnc/hono-feed/releases/tag/v0.1.0) - 2026-06-30

### Features

- Neutral feed model and option types
- XML builder with escaping and invalid-char stripping
- Date, url, etag and deprecation helpers
- RSS serializers (2.0 and RDF 0.90/1.0/1.1)
- Atom serializers (1.0 and 0.3)
- JSON Feed serializer
- Format serializer dispatch
- Feed input validation
- Accept-based format negotiation
- Feed builder
- ServeFeed HTTP response layer
- FeedMiddleware for shared options
- Public package exports

### Bug fixes

- **template:** Add content to check list

### Documentation

- Add README and CONTRIBUTING

[1.2.0]: https://github.com/otnc/hono-feed/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/otnc/hono-feed/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/otnc/hono-feed/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/otnc/hono-feed/compare/v0.7.1...v1.0.0
[0.7.1]: https://github.com/otnc/hono-feed/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/otnc/hono-feed/compare/v0.6.1...v0.7.0
[0.6.1]: https://github.com/otnc/hono-feed/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/otnc/hono-feed/compare/v0.5.1...v0.6.0
[0.5.1]: https://github.com/otnc/hono-feed/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/otnc/hono-feed/compare/v0.4.3...v0.5.0
[0.4.3]: https://github.com/otnc/hono-feed/compare/v0.4.2...v0.4.3
[0.4.2]: https://github.com/otnc/hono-feed/compare/v0.4.1...v0.4.2
[0.4.1]: https://github.com/otnc/hono-feed/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/otnc/hono-feed/compare/v0.3.1...v0.4.0
[0.3.1]: https://github.com/otnc/hono-feed/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/otnc/hono-feed/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/otnc/hono-feed/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/otnc/hono-feed/releases/tag/v0.1.0

