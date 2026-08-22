import { afterEach, describe, expect, it, vi } from 'vitest'
import { UsageService, type AppServerClient, type UsageServiceOptions } from '../src/usage-service.js'

const options: UsageServiceOptions = {
  refreshIntervalMs: 300_000,
  hoverRefreshMinAgeMs: 30_000,
  requestTimeoutMs: 15_000,
  codexCommand: 'codex',
}

const limits = {
  rateLimits: {
    limitId: 'codex',
    limitName: 'Codex',
    primary: { usedPercent: 20, windowDurationMins: 300, resetsAt: 2_000_000_000 },
  },
  rateLimitsByLimitId: null,
  rateLimitResetCredits: null,
}
const account = { account: { type: 'chatgpt', planType: 'plus' } }

function fake(request: AppServerClient['request']): AppServerClient {
  return { request, dispose: vi.fn() }
}

afterEach(() => { vi.useRealTimers() })

describe('UsageService', () => {
  it('uses the long poll cache and shorter forced-hover cache', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000)
    const request = vi.fn(async (method: string) => method === 'account/rateLimits/read' ? limits : account)
    const service = new UsageService(options, fake(request))

    await service.read(false)
    expect(request).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(31_000)
    await service.read(false)
    expect(request).toHaveBeenCalledTimes(2)
    await service.read(true)
    expect(request).toHaveBeenCalledTimes(4)
  })

  it('throttles failed attempts as well as successful reads', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000)
    const request = vi.fn(async () => { throw new Error('private local path') })
    const service = new UsageService(options, fake(request))

    const first = await service.read(true)
    const second = await service.read(true)
    expect(request).toHaveBeenCalledTimes(2)
    expect(second).toBe(first)
    expect(first.ok).toBe(false)
    if (!first.ok) expect(first.error.message).not.toContain('private local path')
  })

  it('keeps the coalescing fence until both RPCs settle', async () => {
    let finishAccount!: (value: unknown) => void
    const accountPending = new Promise(resolve => { finishAccount = resolve })
    const request = vi.fn((method: string) => method === 'account/rateLimits/read'
      ? Promise.reject(new Error('rate failure'))
      : accountPending)
    const service = new UsageService(options, fake(request))
    let settled = false
    const read = service.read(true).then(value => { settled = true; return value })
    await Promise.resolve()
    await Promise.resolve()
    expect(settled).toBe(false)
    const concurrent = service.read(true)
    expect(request).toHaveBeenCalledTimes(2)
    finishAccount(account)
    const [first, second] = await Promise.all([read, concurrent])
    expect(first).toBe(second)
    expect(first.ok).toBe(false)
  })
})
