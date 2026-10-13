# Config and variable interpolation

## Variable interpolation

Use `%{name}`, not `{{name}}` — Kiritan follows the Ruby/Rails-style convention to avoid colliding with Handlebars/Mustache/i18next. Escape a literal with `\%{name}`. Values come only from the config's `interpolation.variables`, never from translation content.

## Config layering

Filenames matching `(<mode>|local)?\.?kiritanconfig` are recognized — `.kiritanconfig` at the root, plus optional `<mode>.kiritanconfig` (the `--mode` flag or `KIRITAN_MODE` env var) and `local.kiritanconfig` layers on top. `local.kiritanconfig` is meant to stay uncommitted — `kiritan init` adds it to `.gitignore`.

## Minimal working config, for reference

```js
// .kiritanconfig
import { defineConfig } from "kiritan";

export default defineConfig({
  locales: { default: "en", list: ["en", "ja"] },
  sources: [{ glob: "base/README.base.md", strategy: "inline" }],
});
```

For the full shape — `locales`, `sources`, `naming`, `switcher`, `translate`, `runtime`, `interpolation` — see the target project's `docs/DESIGN.md` if it has one, or `kiritan <command> --help`.
