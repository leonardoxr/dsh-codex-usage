import { CodexAppServer } from './codex-app-server.js'
import { normalizeUsage } from './normalize.js'
import type { CodexUsageData, CodexUsageResponse } from './types.js'

export interface UsagePolicy {
  refreshIntervalMs: number
  hoverRefreshMinAgeMs: number
}

export interface UsageServiceOptions extends UsagePolicy {
  codexCommand: string
  requestTimeoutMs: number
}

export interface AppServerClient {
  request(method: string, params?: Record<string, unknown>): Promise<unknown>
  dispose(): void
}

export class UsageService {
  private readonly appServer: AppServerClient
  private lastGood: CodexUsageData | null = null
  private lastResult: CodexUsageResponse | null = null
  private lastAttemptAt = 0
  private inFlight: Promise<CodexUsageResponse> | null = null

  constructor(private readonly options: UsageServiceOptions, appServer?: AppServerClient) {
    this.appServer = appServer ?? new CodexAppServer({
      command: options.codexCommand,
      requestTimeoutMs: options.requestTimeoutMs,
    })
  }

  get policy(): UsagePolicy {
    return {
      refreshIntervalMs: this.options.refreshIntervalMs,
      hoverRefreshMinAgeMs: this.options.hoverRefreshMinAgeMs,
    }
  }

  async read(force = false): Promise<CodexUsageResponse> {
    const age = Date.now() - this.lastAttemptAt
    const minimumAge = force ? this.options.hoverRefreshMinAgeMs : this.options.refreshIntervalMs
    if (this.lastResult !== null && age < minimumAge) return this.lastResult
    if (this.inFlight !== null) return this.inFlight
    this.inFlight = this.fetch()
    try {
      return await this.inFlight
    } finally {
      this.inFlight = null
    }
  }

  private async fetch(): Promise<CodexUsageResponse> {
    this.lastAttemptAt = Date.now()
    let result: CodexUsageResponse
    try {
      const [rateLimitsResult, accountResult] = await Promise.allSettled([
        this.appServer.request('account/rateLimits/read'),
        this.appServer.request('account/read', { refreshToken: false }),
      ])
      if (rateLimitsResult.status === 'rejected') throw rateLimitsResult.reason
      if (accountResult.status === 'rejected') throw accountResult.reason
      this.lastGood = normalizeUsage(rateLimitsResult.value, accountResult.value)
      result = { ok: true, data: this.lastGood, policy: this.policy }
    } catch {
      result = {
        ok: false,
        error: {
          code: 'CODEX_USAGE_UNAVAILABLE',
          message: 'Unable to read Codex plan usage. Confirm that Codex is installed and signed in.',
        },
        stale: this.lastGood,
        policy: this.policy,
      }
    }
    this.lastResult = result
    return result
  }

  dispose(): void {
    this.appServer.dispose()
  }
}
