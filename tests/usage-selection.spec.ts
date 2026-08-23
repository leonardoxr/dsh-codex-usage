import { describe, expect, it } from 'vitest'
import { mainPlanUsedPercent, usageSnapshots } from '../src/client/index.js'
import { normalizeUsage } from '../src/normalize.js'

describe('Codex usage selection', () => {
  it('drives the circular meter from top-level plan usage, not limit buckets', () => {
    const data = normalizeUsage({
      rateLimits: {
        limitId: 'codex',
        limitName: 'Codex',
        primary: { usedPercent: 31, windowDurationMins: 300, resetsAt: 2_000_000_000 },
        secondary: { usedPercent: 47, windowDurationMins: 10_080, resetsAt: 2_000_100_000 },
      },
      rateLimitsByLimitId: {
        codex: {
          limitId: 'codex',
          limitName: 'Codex',
          primary: { usedPercent: 12, windowDurationMins: 300, resetsAt: 2_000_000_000 },
        },
        spark: {
          limitId: 'spark',
          limitName: 'GPT Spark',
          primary: { usedPercent: 94, windowDurationMins: 300, resetsAt: 2_000_000_000 },
        },
      },
    }, null)

    expect(mainPlanUsedPercent(data)).toBe(47)
    expect(usageSnapshots(data).map(([id]) => id)).toEqual(['codex'])
  })

  it('defensively hides Spark snapshots received from an older server bundle', () => {
    const data = normalizeUsage({
      rateLimits: {
        limitId: 'codex',
        primary: { usedPercent: 20, windowDurationMins: 300, resetsAt: 2_000_000_000 },
      },
    }, null)
    data.rateLimitsByLimitId = {
      spark_preview: { ...data.rateLimits, limitId: 'spark_preview', limitName: 'GPT Spark' },
    }

    expect(usageSnapshots(data)).toEqual([])
    expect(mainPlanUsedPercent(data)).toBe(20)
  })
})
