import { describe, expect, it } from 'vitest'
import { normalizeUsage } from '../src/normalize.js'

describe('normalizeUsage', () => {
  it('allowlists quota fields and clamps percentages', () => {
    const value = normalizeUsage({
      rateLimits: {
        limitId: 'codex',
        limitName: 'Codex',
        primary: { usedPercent: 132.4, windowDurationMins: 300, resetsAt: 1_800_000_000 },
        secondary: { usedPercent: -4, windowDurationMins: 10_080, resetsAt: 1_800_100_000 },
        credits: { hasCredits: true, unlimited: false, balance: '19.50', secret: 'drop-me' },
        individualLimit: { limit: '100', used: '25', remainingPercent: 75, resetsAt: 1_800_000_000, currency: 'drop-me' },
        planType: 'plus',
        accountId: 'drop-me',
      },
      rateLimitsByLimitId: {
        spark: {
          limitId: 'spark',
          limitName: 'GPT Spark',
          primary: { usedPercent: 25.5, windowDurationMins: 300, resetsAt: 1_800_000_000 },
        },
      },
      rateLimitResetCredits: { availableCount: 2, credits: [] },
      accessToken: 'drop-me',
    }, {
      account: { type: 'chatgpt', planType: 'plus', email: 'private@example.com', id: 'drop-me' },
    }, 1234)

    expect(value.fetchedAt).toBe(1234)
    expect(value.rateLimits.primary?.usedPercent).toBe(100)
    expect(value.rateLimits.secondary?.usedPercent).toBe(0)
    expect(value.rateLimitsByLimitId?.spark?.primary?.usedPercent).toBe(25.5)
    expect(value.rateLimits.individualLimit).toEqual({ limit: '100', used: '25', remainingPercent: 75, resetsAt: 1_800_000_000 })
    expect(value.account).toEqual({ type: 'chatgpt', planType: 'plus' })
    expect(JSON.stringify(value)).not.toContain('private@example.com')
    expect(JSON.stringify(value)).not.toContain('drop-me')
  })

  it('tolerates missing and additive provider fields', () => {
    const value = normalizeUsage({ rateLimits: { futureField: { anything: true } } }, null)
    expect(value.rateLimits.primary).toBeNull()
    expect(value.rateLimits.credits).toBeNull()
    expect(value.rateLimitsByLimitId).toBeNull()
    expect(value.account).toBeNull()
  })
})
