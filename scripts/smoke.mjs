// Exercises the built package.json "exports" map itself (not src/) via Node's
// self-referencing package imports, so a build/exports-map regression that the
// vitest suite (which imports from src/) can't see is caught here. Subpaths are
// read from package.json at run time, so adding a new export entry needs no
// change here.
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)))

const specifiers = Object.keys(pkg.exports)
  .filter((subpath) => subpath !== './package.json')
  .map((subpath) => (subpath === '.' ? pkg.name : `${pkg.name}/${subpath.slice(2)}`))

let failed = false

for (const specifier of specifiers) {
  let esmKeys
  let cjsKeys
  try {
    esmKeys = Object.keys(await import(specifier)).sort()
  } catch (err) {
    failed = true
    console.error(`✗ ${specifier} (import) threw:`, err.message)
    continue
  }

  try {
    cjsKeys = Object.keys(require(specifier)).sort()
  } catch (err) {
    failed = true
    console.error(`✗ ${specifier} (require) threw:`, err.message)
    continue
  }

  if (esmKeys.length === 0) {
    failed = true
    console.error(`✗ ${specifier}: module has no exports`)
  } else if (esmKeys.join(',') !== cjsKeys.join(',')) {
    failed = true
    console.error(
      `✗ ${specifier}: ESM/CJS export mismatch — import: [${esmKeys}], require: [${cjsKeys}]`,
    )
  }
}

if (failed) {
  console.error('\nsmoke test failed')
  process.exit(1)
}
console.log(`smoke test passed (${specifiers.length} entry points, import + require)`)
