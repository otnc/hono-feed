---
name: kiritan
description: Helps write and maintain Kiritan-based i18n — editing base/*.base.md files with :::kiritan{...} directives, choosing the sidecar/inline/catalog document strategy or the colocated/split/centralized/embedded runtime strategy, running kiritan init/build/check/translate/extract/typegen, and avoiding common mistakes such as hand-editing generated output. Use when a repo has a *.kiritanconfig config file, a base/ directory of *.base.md sources, or generated docs carrying a `<!-- kiritan:untranslated -->` / `<!-- kiritan:hash ... -->` marker — or when asked to localize a README/doc, add or fix a translation, or resolve a `kiritan check` failure.
license: WTFPL
compatibility: Requires Node.js 22.7+ and the kiritan CLI (npm install -D kiritan).
metadata:
  trigger: kiritan i18n documentation and runtime resource work
  language: en, ja
---

# kiritan

Kiritan is an i18n tool that, beyond the usual key→string runtime i18n, also builds localized documents (README, docs, etc.) from a single base file. This is the operating manual for working inside a project that already uses it — or for introducing it to a repo that doesn't yet — not for writing Kiritan's own source.

## Recognizing a Kiritan project

Look for any of:
- A `.kiritanconfig` (or `dev.kiritanconfig`/`local.kiritanconfig`/etc.) config file, usually at the repo root, exporting `defineConfig({...})`. It has no file extension by design — don't mistake it for a stray/misnamed file.
- A `base/` directory containing `*.base.md` files (the convention this project itself uses; a project may instead keep base files elsewhere per its own `sources` globs).
- A generated document carrying a `<!-- kiritan:untranslated (source: ...) -->` or `<!-- kiritan:hash ... -->` HTML comment, or an auto-inserted language-switcher line (`**English** | [日本語](...)`).

## The one rule that matters most: never hand-edit generated output

Every file listed under the resolved config's `sources` (check `.kiritanconfig` and its `naming`/`naming.template` for the actual output paths) is **generated** from a base file — editing it directly gets silently overwritten on the next `kiritan build`, and for `sidecar`/`catalog` strategies it will drift from its embedded hash, which `kiritan check` reports as `stale`.

Always find and edit the `*.base.md` source instead, then regenerate:

```sh
kiritan build         # or: npm run docs:build, if the project defines that script
kiritan check         # verify nothing is left missing/stale before finishing
```

If you can't find the base file, read the config's `sources` globs and `naming.baseSuffix` (default `".base"`) to work out which file is the real source for a given output.

## Directive syntax (`inline` strategy)

remark-directive syntax, one locale per self-contained block — never a single block trying to hold a switch/case over multiple locales:

```md
:::kiritan{locale=en}
## Usage
English content.
:::

:::kiritan{locale=ja}
## 使い方
日本語のコンテンツ。
:::
```

- Content **outside** any `:::kiritan{...}` block is shared verbatim across every locale's output (badges, license notices, etc.).
- `locale=xx` must exactly match a value in the resolved config's `locales.list` — an unrecognized code is a **build-time error**, not a silent skip.
- `::kiritan{switcher}` (a leaf directive, no closing `:::`) marks where the language-switcher line is inserted. It's usually unnecessary to add by hand — Kiritan auto-inserts it after the first heading unless a marker already exists or `switcher.position`/`switcher.enabled` says otherwise.
- Nesting another directive inside a block just needs more colons on the outer fence (`::::kiritan{locale=en}` wrapping a `:::note`) — no special handling needed.

### Prefer many small block pairs over one block holding the whole document

Split at every natural section boundary (each heading, usually) into its own `locale=en`/`locale=ja` pair, rather than wrapping the entire page's content in a single pair per locale. Prefer this:

```md
:::kiritan{locale=en}
## Usage
English content.
:::
:::kiritan{locale=ja}
## 使い方
日本語のコンテンツ。
:::

:::kiritan{locale=en}
## Configuration
More English content.
:::
:::kiritan{locale=ja}
## 設定
さらに日本語のコンテンツ。
:::
```

over this:

```md
:::kiritan{locale=en}
## Usage
English content.

## Configuration
More English content.
:::
:::kiritan{locale=ja}
## 使い方
日本語のコンテンツ。

## 設定
さらに日本語のコンテンツ。
:::
```

Both build to the same output, but the split form is far easier to read and review in the source: each locale pair sits right next to its counterpart, a diff to one section doesn't touch the surrounding ones, and nothing is lost scrolling through a wall of one language before the other begins. Apply this when writing a new base file and when restructuring an existing one — not by forcibly re-splitting a file just to reformat it if nothing else about it is changing.

## CLI commands, and when to reach for each

| Command | Run it when |
| --- | --- |
| `kiritan init` | In a repo that doesn't use Kiritan yet, when asked to localize its README/docs — scaffolds `.kiritanconfig`, `base/README.base.md`, and a `.gitignore` entry for `local.kiritanconfig`. Leaves existing files alone unless `--force` is passed. |
| `kiritan build` | After editing any `*.base.md` — regenerates every configured output. |
| `kiritan check` | After any base-file or translation change, before calling the work done — CI-friendly, reports `missing`/`stale`/`machine`/`i18n-key-mismatch`. |
| `kiritan verify` | To confirm generated docs are in sync with their base files (no hand edits, nothing out of date) — writes nothing, exits non-zero on a mismatch. Different from `check`, which is about missing/stale *translations*. |
| `kiritan extract` | After adding a new `:::kiritan{#<id>}` block, for `catalog`-strategy sources — scaffolds the new id into each locale's catalog file. |
| `kiritan translate` | To auto-fill missing/stale translations — only does anything if the source configures `translate.middlewares` and `translate.auto: true` (the default is off, and `kiritan translate` says so when middlewares are configured but `auto` isn't). |
| `kiritan typegen` | Only for runtime i18n, when `runtime.sources` aggregates multiple files into one shared `t()` — regenerates the aggregated type declaration. |

In a project that keeps `kiritan` in `devDependencies`, invoke it as `npx kiritan <command>` — or `npm run docs:build` / `npm run docs:check`, if the project defines those scripts — instead of a globally installed `kiritan`.

Every command except `kiritan init` accepts `--mode <mode>` and `--config <path>` to layer on non-default config files — there's no config to layer yet before `init` has run.

## Common mistakes to avoid

- Editing a generated output file instead of its `*.base.md` source (see the rule above).
- Writing `{{name}}` instead of `%{name}` for interpolation.
- Packing multiple locales into one `:::kiritan{...}` block instead of one self-contained block per locale.
- Wrapping a whole document's content in one block pair per locale instead of splitting at each section — see "Prefer many small block pairs" above.
- Using a `locale=` value not present in `locales.list` (build-time error).
- Adding a new `:::kiritan{#<id>}` block for `catalog` and forgetting to run `kiritan extract` before it can be translated.
- Hand-writing or guessing a catalog entry's `hash` field.
- Assuming `kiritan translate` does something when the source has no `translate.middlewares` configured, or when `translate.auto` isn't `true` — check the config first. A source's own `translate` replaces the top-level one entirely, so it needs its own `auto: true`.

## References — read only what the task needs

- [Document strategies: `catalog` and `sidecar`](references/strategies.md) — read when the project's `sources` use (or you're adding) `strategy: "catalog"` or `"sidecar"`.
- [Runtime i18n: `t(key, params)`](references/runtime.md) — read when working on UI strings in application code, `runtime.sources`, or `kiritan typegen`.
- [Config and variable interpolation](references/config.md) — read when writing or editing a `.kiritanconfig`, or when `%{name}` interpolation is involved.

## Where to look for more

- The target project's own `docs/DESIGN.md`, if it has one — the authoritative spec for its config shape and behavior.
- `kiritan <command> --help` for exact flags.
