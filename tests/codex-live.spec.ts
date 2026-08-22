import { expect, it } from 'vitest'
import { CodexAppServer } from '../src/codex-app-server.js'
import { normalizeUsage } from '../src/normalize.js'

it.runIf(process.env.CODEX_LIVE === '1')('reads current rate limits through the installed Codex app-server', async () => {
  const server = new CodexAppServer({ command: 'codex', requestTimeoutMs: 20_000 })
  try {
    const [limits, account] = await Promise.all([
      server.request('account/rateLimits/read'),
      server.request('account/read', { refreshToken: false }),
    ])
    const usage = normalizeUsage(limits, account)
    expect(usage.source).toBe('codex-app-server')
    expect(usage.account?.type).toBe('chatgpt')
    expect(usage.rateLimits.primary ?? usage.rateLimits.secondary).not.toBeNull()
  } finally {
    server.dispose()
  }
}, 30_000)
