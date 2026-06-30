const warned = new Set<string>()

interface ProcessLike {
  emitWarning?: (warning: string, options?: { type?: string; code?: string }) => void
  noDeprecation?: boolean
  env?: Record<string, string | undefined>
}

function getProcess(): ProcessLike | undefined {
  return (globalThis as { process?: ProcessLike }).process
}

function suppressedGlobally(): boolean {
  const proc = getProcess()
  if (proc?.noDeprecation) return true // node --no-deprecation
  return Boolean(proc?.env?.HONO_FEED_NO_DEPRECATION)
}

/**
 * Emit a deprecation warning once per process per `key` (discord.js style), tagged with a
 * stable `code`. Uses Node's `process.emitWarning` when available, otherwise `console.warn`
 * (edge-runtime safe). Globally suppressed by `process.noDeprecation` (`--no-deprecation`)
 * or the `HONO_FEED_NO_DEPRECATION` env var.
 */
export function warnDeprecated(key: string, message: string, code: string): void {
  if (warned.has(key) || suppressedGlobally()) return
  warned.add(key)

  const text = `hono-feed: ${message}`
  const proc = getProcess()
  if (proc?.emitWarning) {
    proc.emitWarning(text, { type: 'DeprecationWarning', code })
  } else {
    console.warn(`[${code}] DeprecationWarning: ${text}`)
  }
}
