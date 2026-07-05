import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const report = resolve('coverage/index.html')
if (existsSync(report)) {
  console.log(`\nCoverage report: ${pathToFileURL(report)}`)
}
