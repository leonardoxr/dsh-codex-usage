import type { CodexUsageData, CodexUsageResponse, UsagePolicy } from '../types.js'

export interface UsageState {
  phase: 'idle' | 'loading' | 'ready' | 'error'
  data: CodexUsageData | null
  error: string | null
  policy: UsagePolicy
  lastAttemptAt: number
}

const DEFAULT_POLICY: UsagePolicy = {
  refreshIntervalMs: 300_000,
  hoverRefreshMinAgeMs: 30_000,
}

export class UsageStore {
  private state: UsageState = {
    phase: 'idle',
    data: null,
    error: null,
    policy: DEFAULT_POLICY,
    lastAttemptAt: 0,
  }
  private readonly listeners = new Set<() => void>()
  private inFlight: Promise<void> | null = null

  getSnapshot = (): UsageState => this.state

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  async refresh(force = false): Promise<void> {
    const age = Date.now() - this.state.lastAttemptAt
    if (force && age < this.state.policy.hoverRefreshMinAgeMs) return
    if (this.inFlight !== null) return this.inFlight
    this.inFlight = this.fetch(force)
    try {
      await this.inFlight
    } finally {
      this.inFlight = null
    }
  }

  private async fetch(force: boolean): Promise<void> {
    this.set({ ...this.state, phase: 'loading', lastAttemptAt: Date.now() })
    try {
      const response = await fetch(`/api/plugins/codex-usage${force ? '?refresh=1' : ''}`, {
        method: 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      })
      const body = await response.json() as CodexUsageResponse
      if (body.ok) {
        this.set({
          phase: 'ready',
          data: body.data,
          error: null,
          policy: body.policy,
          lastAttemptAt: this.state.lastAttemptAt,
        })
        return
      }
      this.set({
        phase: 'error',
        data: body.stale,
        error: body.error.message,
        policy: body.policy,
        lastAttemptAt: this.state.lastAttemptAt,
      })
    } catch (error) {
      this.set({
        ...this.state,
        phase: 'error',
        error: error instanceof Error ? error.message : 'Unable to load Codex usage',
      })
    }
  }

  private set(next: UsageState): void {
    this.state = next
    for (const listener of this.listeners) listener()
  }
}
