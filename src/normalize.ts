import type {
  CodexUsageData,
  CreditsSnapshot,
  RateLimitSnapshot,
  RateLimitWindow,
  ResetCredit,
  ResetCreditsSummary,
  SpendControlLimitSnapshot,
} from './types.js'

type JsonObject = Record<string, unknown>

function isSparkBucket(id: string, snapshot: RateLimitSnapshot): boolean {
  return /spark/i.test(id) || /spark/i.test(snapshot.limitId ?? '') || /spark/i.test(snapshot.limitName ?? '')
}

function object(value: unknown): JsonObject | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as JsonObject
    : null
}

function text(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function bool(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function window(value: unknown): RateLimitWindow | null {
  const row = object(value)
  if (row === null) return null
  const usedPercent = finite(row.usedPercent)
  if (usedPercent === null) return null
  return {
    usedPercent: Math.max(0, Math.min(100, usedPercent)),
    windowDurationMins: finite(row.windowDurationMins),
    resetsAt: finite(row.resetsAt),
  }
}

function credits(value: unknown): CreditsSnapshot | null {
  const row = object(value)
  if (row === null || typeof row.hasCredits !== 'boolean' || typeof row.unlimited !== 'boolean') return null
  return { hasCredits: row.hasCredits, unlimited: row.unlimited, balance: text(row.balance) }
}

function individualLimit(value: unknown): SpendControlLimitSnapshot | null {
  const row = object(value)
  if (row === null) return null
  const limit = text(row.limit)
  const used = text(row.used)
  const remainingPercent = finite(row.remainingPercent)
  const resetsAt = finite(row.resetsAt)
  return limit === null || used === null || remainingPercent === null || resetsAt === null
    ? null
    : { limit, used, remainingPercent: Math.max(0, Math.min(100, remainingPercent)), resetsAt }
}

export function normalizeSnapshot(value: unknown): RateLimitSnapshot {
  const row = object(value) ?? {}
  return {
    limitId: text(row.limitId),
    limitName: text(row.limitName),
    primary: window(row.primary),
    secondary: window(row.secondary),
    credits: credits(row.credits),
    individualLimit: individualLimit(row.individualLimit),
    spendControlReached: bool(row.spendControlReached),
    planType: text(row.planType),
    rateLimitReachedType: text(row.rateLimitReachedType),
  }
}

function resetCredit(value: unknown): ResetCredit | null {
  const row = object(value)
  if (row === null) return null
  const resetType = text(row.resetType)
  const status = text(row.status)
  const grantedAt = finite(row.grantedAt)
  if (resetType === null || status === null || grantedAt === null) return null
  return {
    resetType,
    status,
    grantedAt,
    expiresAt: finite(row.expiresAt),
    title: text(row.title),
    description: text(row.description),
  }
}

function resetCredits(value: unknown): ResetCreditsSummary | null {
  const row = object(value)
  if (row === null) return null
  const availableCount = finite(row.availableCount)
  if (availableCount === null) return null
  const list = Array.isArray(row.credits)
    ? row.credits.map(resetCredit).filter((item): item is ResetCredit => item !== null)
    : null
  return { availableCount, credits: list }
}

export function normalizeUsage(rateResult: unknown, accountResult: unknown, fetchedAt = Date.now()): CodexUsageData {
  const rate = object(rateResult) ?? {}
  const accountRoot = object(accountResult)
  const account = object(accountRoot?.account)
  const bucketsRaw = object(rate.rateLimitsByLimitId)
  const buckets = bucketsRaw === null
    ? null
    : (() => {
        const filtered = Object.fromEntries(
          Object.entries(bucketsRaw)
            .map(([key, value]) => [key, normalizeSnapshot(value)] as const)
            .filter(([key, snapshot]) => !isSparkBucket(key, snapshot)),
        )
        return Object.keys(filtered).length > 0 ? filtered : null
      })()

  return {
    source: 'codex-app-server',
    fetchedAt,
    account: account === null || typeof account.type !== 'string'
      ? null
      : { type: account.type, planType: text(account.planType) },
    rateLimits: normalizeSnapshot(rate.rateLimits),
    rateLimitsByLimitId: buckets,
    rateLimitResetCredits: resetCredits(rate.rateLimitResetCredits),
  }
}
