// Exercises the built package.json "exports" map itself (not src/) via Node's
// self-referencing package imports, so a build/exports-map regression that the
// vitest suite (which imports from src/) can't see is caught here.
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const entries = [
  {
    specifier: 'hono-feed',
    expect: ['Feed', 'feedMiddleware', 'serveFeed', 'toAtom', 'toJSONFeed', 'toRSS'],
  },
  { specifier: 'hono-feed/middleware', expect: ['feed'] },
  { specifier: 'hono-feed/renderer', expect: ['feedRenderer'] },
  { specifier: 'hono-feed/rss', expect: ['toRSS'] },
  { specifier: 'hono-feed/atom', expect: ['toAtom'] },
  { specifier: 'hono-feed/json', expect: ['toJSONFeed'] },
]

let failed = false

function checkExports(specifier, mod, expect) {
  for (const name of expect) {
    if (typeof mod[name] !== 'function') {
      failed = true
      console.error(`✗ ${specifier}: missing or non-function export "${name}"`)
    }
  }
}

for (const { specifier, expect } of entries) {
  try {
    const esm = await import(specifier)
    checkExports(`${specifier} (import)`, esm, expect)
  } catch (err) {
    failed = true
    console.error(`✗ ${specifier} (import) threw:`, err.message)
  }

  try {
    const cjs = require(specifier)
    checkExports(`${specifier} (require)`, cjs, expect)
  } catch (err) {
    failed = true
    console.error(`✗ ${specifier} (require) threw:`, err.message)
  }
}

if (failed) {
  console.error('\nsmoke test failed')
  process.exit(1)
}
console.log(`smoke test passed (${entries.length} entry points, import + require)`)
