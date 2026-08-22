import { afterEach, describe, expect, it, vi } from 'vitest'
import { UsageStore } from '../src/client/store.js'
import type { CodexUsageResponse } from '../src/types.js'

const response: CodexUsageResponse = {
  ok: true,
  policy: { refreshIntervalMs: 300_000, hoverRefreshMinAgeMs: 30_000 },
  data: {
    source: 'codex-app-server',
    fetchedAt: 100,
    account: { type: 'chatgpt', planType: 'plus' },
    rateLimits: {
      limitId: 'codex', limitName: 'Codex',
      primary: { usedPercent: 20, windowDurationMins: 300, resetsAt: 200 },
      secondary: null, credits: null, individualLimit: null,
      spendControlReached: false, planType: 'plus', rateLimitReachedType: null,
    },
    rateLimitsByLimitId: null,
    rateLimitResetCredits: null,
  },
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('UsageStore', () => {
  it('coalesces concurrent requests', async () => {
    let resolve!: (value: Response) => void
    const fetchMock = vi.fn(() => new Promise<Response>(done => { resolve = done }))
    vi.stubGlobal('fetch', fetchMock)
    const store = new UsageStore()
    const first = store.refresh(false)
    const second = store.refresh(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    resolve(new Response(JSON.stringify(response), { status: 200 }))
    await Promise.all([first, second])
    expect(store.getSnapshot().phase).toBe('ready')
  })

  it('throttles hover refreshes inside the protected age', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000)
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(response), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const store = new UsageStore()
    await store.refresh(true)
    await store.refresh(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(30_001)
    await store.refresh(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('shows a loading phase while refreshing last-good data', async () => {
    let finish!: (value: Response) => void
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(response), { status: 200 }))
      .mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve }))
    vi.stubGlobal('fetch', fetchMock)
    const store = new UsageStore()
    await store.refresh(false)
    const refresh = store.refresh(false)
    expect(store.getSnapshot()).toMatchObject({ phase: 'loading' })
    expect(store.getSnapshot().data?.rateLimits.limitId).toBe('codex')
    finish(new Response(JSON.stringify(response), { status: 200 }))
    await refresh
    expect(store.getSnapshot().phase).toBe('ready')
  })

  it('keeps stale data when the host reports a transient failure', async () => {
    const failed: CodexUsageResponse = {
      ok: false,
      error: { code: 'CODEX_USAGE_UNAVAILABLE', message: 'offline' },
      stale: response.ok ? response.data : null,
      policy: response.policy,
    }
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(failed), { status: 503 })))
    const store = new UsageStore()
    await store.refresh(false)
    expect(store.getSnapshot()).toMatchObject({ phase: 'error', error: 'offline' })
    expect(store.getSnapshot().data?.rateLimits.limitId).toBe('codex')
  })
})
