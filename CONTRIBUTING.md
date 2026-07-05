# Contributing

Thanks for your interest in improving hono-feed!  
This guide gets you set up and explains how the project is put together.  
If anything here is unclear, opening an issue to ask is welcome.

## Getting set up

You'll need Node.js >= 20 and [pnpm](https://pnpm.io).  
If you don't have pnpm, `corepack enable` gives it to you.  
Then install exactly what the lockfile pins:

```sh
pnpm install --frozen-lockfile
```

(Adding or bumping a dependency is the one case to drop the flag — use `pnpm add <pkg>`, which updates the lockfile for you.)

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm build` | Bundle ESM/CJS + type declarations with tsup |
| `pnpm test` | Run the tests once with vitest (`pnpm test:watch` to keep them running) |
| `pnpm typecheck` | Type-check with `tsc --noEmit` |
| `pnpm check` | Lint, format and organize imports, writing the fixes (Biome) |
| `pnpm run ci` | The same checks without writing — what CI runs |

Before opening a pull request, make sure the full set passes:

```sh
pnpm run ci && pnpm typecheck && pnpm test && pnpm build
```

## Conventions

- **Formatting and linting is Biome** (`biome.json`) — single quotes, no semicolons, trailing commas, 100-column width.  
  Running `pnpm check` before you commit handles all of it.
- **Tests live next to the code** as `*.test.ts` and run with vitest.
- **Comments and docs are in English** and kept brief.
- **No runtime dependencies.**  
  `hono` is a peer dependency, and everything else uses Web Standard APIs only (`Response`, `URL`, `TextEncoder`, …) so the package keeps running on every edge runtime — `platform: 'neutral'` in the build enforces this.  
  If a Node-only API is genuinely worth it (like `process.emitWarning`), feature-detect it through `globalThis` and fall back gracefully; `src/utils/deprecation.ts` is the example to follow.
- **Type-only imports use `import type`** (`verbatimModuleSyntax` is on).

## Adding a feed version

Every supported version value is a typed union in `src/types.ts`, which keeps invalid versions from ever reaching a serializer.  
To add one:

1. Add the value to the relevant union in `src/types.ts`.
2. Implement it — add a per-version file under `src/formats/{rss,atom}/` and wire it into that format's `index.ts` dispatcher.  
   If the variant only changes the `version` attribute (as RSS 0.9x does), extend the shared serializer instead of writing a new file — see `rss2.ts`.
3. Keep the serializers pure.  
   When a required identity is missing (an Atom or RDF `id`), throw a `TypeError` rather than emitting a broken document.
4. Update the version tables in both READMEs and add a test.

If you're **deprecating** a version, call `warnDeprecated(key, message, code)` from `src/utils/deprecation.ts` in that format's `index.ts`, guarded by `!opts.suppressDeprecationWarnings`.  
It fires once per process, tags the warning with a stable code, and respects the usual mute switches.  
Assign the next `HONOFEED_DEP00NN` code and add a row to [HONOFEED_DEP.md](HONOFEED_DEP.md).

## Pull requests

Keep each change focused and add tests for any new behaviour.  
When something is about spec-compliance — a date format, escaping rule, or HTTP detail — a line explaining it in the PR goes a long way, since correctness is the whole point of this library.

## Releasing (maintainers)

Releasing is one manual step.  
From the Actions tab, run the `release` workflow (`workflow_dispatch`) and give it a `version` input — either a bump keyword (`patch` / `minor` / `major` / `prerelease`) or an explicit version like `0.2.0`.  
The workflow runs the checks and build, bumps `package.json`, publishes to npm with provenance, pushes the version commit and tag, and creates a GitHub Release with generated notes.  
It needs an `NPM_TOKEN` secret and write access for the default `GITHUB_TOKEN`.

## License

By contributing, you agree that your contributions are licensed under the [Apache-2.0](./LICENSE) license.
