export interface RateLimitWindow {
  usedPercent: number
  windowDurationMins: number | null
  resetsAt: number | null
}

export interface CreditsSnapshot {
  hasCredits: boolean
  unlimited: boolean
  balance: string | null
}

export interface SpendControlLimitSnapshot {
  limit: string
  used: string
  remainingPercent: number
  resetsAt: number
}

export interface RateLimitSnapshot {
  limitId: string | null
  limitName: string | null
  primary: RateLimitWindow | null
  secondary: RateLimitWindow | null
  credits: CreditsSnapshot | null
  individualLimit: SpendControlLimitSnapshot | null
  spendControlReached: boolean | null
  planType: string | null
  rateLimitReachedType: string | null
}

export interface ResetCredit {
  resetType: string
  status: string
  grantedAt: number
  expiresAt: number | null
  title: string | null
  description: string | null
}

export interface ResetCreditsSummary {
  availableCount: number
  credits: ResetCredit[] | null
}

export interface CodexUsageData {
  source: 'codex-app-server'
  fetchedAt: number
  account: {
    type: string
    planType: string | null
  } | null
  rateLimits: RateLimitSnapshot
  rateLimitsByLimitId: Record<string, RateLimitSnapshot> | null
  rateLimitResetCredits: ResetCreditsSummary | null
}

export interface UsagePolicy {
  refreshIntervalMs: number
  hoverRefreshMinAgeMs: number
}

export type CodexUsageResponse =
  | { ok: true; data: CodexUsageData; policy: UsagePolicy }
  | { ok: false; error: { code: string; message: string }; stale: CodexUsageData | null; policy: UsagePolicy }
