import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-settings'
import Schema from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { UsageService } from './usage-service.js'

export const name = 'dsh-codex-usage'
export const SETTINGS_NAMESPACE = 'codex-usage' as const
export const inject = ['webServer', 'settings'] as const

export interface Config {
  refreshIntervalMs: number
  hoverRefreshMinAgeMs: number
  requestTimeoutMs: number
  codexCommand: string
}

export const Config: Schema<Config> = Schema.object({
  refreshIntervalMs: Schema.natural().min(60_000).default(300_000),
  hoverRefreshMinAgeMs: Schema.natural().min(5_000).default(30_000),
  requestTimeoutMs: Schema.natural().min(1_000).default(15_000),
  codexCommand: Schema.string().default('codex'),
})

export function assertConfig(config: Config): void {
  if (!Number.isSafeInteger(config.refreshIntervalMs) || config.refreshIntervalMs < 60_000) {
    throw new Error('dsh-codex-usage: refreshIntervalMs must be an integer of at least 60000')
  }
  if (!Number.isSafeInteger(config.hoverRefreshMinAgeMs) || config.hoverRefreshMinAgeMs < 5_000) {
    throw new Error('dsh-codex-usage: hoverRefreshMinAgeMs must be an integer of at least 5000')
  }
  if (!Number.isSafeInteger(config.requestTimeoutMs) || config.requestTimeoutMs < 1_000) {
    throw new Error('dsh-codex-usage: requestTimeoutMs must be an integer of at least 1000')
  }
  if (config.codexCommand.trim() === '') {
    throw new Error('dsh-codex-usage: codexCommand must not be empty')
  }
}

const ROUTE = '/api/plugins/codex-usage'

function isLoopback(address: string | undefined): boolean {
  return address === '127.0.0.1'
    || address === '::1'
    || address === '::ffff:127.0.0.1'
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function isLoopbackHost(host: string | undefined): host is string {
  if (host === undefined) return false
  try {
    const hostname = new URL(`http://${host}`).hostname.toLowerCase()
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
  } catch {
    return false
  }
}

export function isTrustedLocalRequest(
  remoteAddress: string | undefined,
  host: string | undefined,
  origin: string | undefined,
  fetchSite: string | undefined,
  referer: string | undefined,
): boolean {
  if (!isLoopback(remoteAddress) || !isLoopbackHost(host)) return false
  if (fetchSite !== undefined && fetchSite !== 'same-origin' && fetchSite !== 'none') return false
  for (const source of [origin, referer]) {
    if (source === undefined) continue
    try {
      const url = new URL(source)
      if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.host !== host) return false
    } catch {
      return false
    }
  }
  return true
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(json),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  res.end(json)
}

export function apply(ctx: Context, config: Config): void {
  assertConfig(config)
  const settings = ctx.settings.register(SETTINGS_NAMESPACE, Config, {
    base: config,
    applies: 'restart',
    validate: assertConfig,
  })
  const active = settings.get()
  assertConfig(active)
  const usage = new UsageService(active)
  ctx.effect(() => () => { usage.dispose() }, 'codex-usage: app-server')
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: ROUTE,
    async handler(req: IncomingMessage, res: ServerResponse) {
      if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET')
        writeJson(res, 405, { ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Use GET' } })
        return
      }
      if (!isTrustedLocalRequest(
        req.socket.remoteAddress,
        firstHeader(req.headers.host),
        firstHeader(req.headers.origin),
        firstHeader(req.headers['sec-fetch-site']),
        firstHeader(req.headers.referer),
      )) {
        writeJson(res, 403, { ok: false, error: { code: 'LOCAL_ORIGIN_REQUIRED', message: 'Codex usage is available only to the local Harness page' } })
        return
      }
      const force = new URL(req.url ?? ROUTE, 'http://localhost').searchParams.get('refresh') === '1'
      const result = await usage.read(force)
      writeJson(res, result.ok ? 200 : 503, result)
    },
  }), 'codex-usage: HTTP route')
}

export type { CodexUsageData, CodexUsageResponse, RateLimitSnapshot, RateLimitWindow } from './types.js'
