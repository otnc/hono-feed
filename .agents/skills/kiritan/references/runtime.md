# Runtime i18n: `t(key, params)`, not documents

Separate from document translation — for UI strings in application code, via `@kiritan/runtime`'s `createT()`. Every placement strategy normalizes to the same `ResourceModule` shape (`key → { locale: value }`), so pick whichever fits the existing codebase:

- **`colocated`** (default/simplest): one file per component holding every locale — `Button.i18n.ts` exporting `{ submit: { en: "Submit", ja: "送信" } }`.
- **`split`**: same idea, one file per locale — `Button.en.i18n.ts` / `Button.ja.i18n.ts`.
- **`centralized`**: i18next-compatible — `locales/{locale}/{namespace}.json`.
- **`embedded`**: exported directly from the component's own source file (`export const i18n = {...}` inside `Button.tsx`).

Check the project's `runtime.sources` config before assuming which one is in use — don't introduce a second strategy alongside an existing one without a reason.

`kiritan typegen` is the runtime-side command: when `runtime.sources` aggregates multiple files into one shared `t()`, it regenerates the aggregated type declaration. Run it after adding or changing keys in any aggregated source.
