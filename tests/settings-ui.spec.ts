import { describe, expect, it, vi } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'

const captured = vi.hoisted(() => ({ options: [] as unknown[] }))

vi.mock('../src/usage-service.js', () => ({
  UsageService: class {
    constructor(options: unknown) { captured.options.push(options) }
    dispose(): void {}
    async read(): Promise<never> { throw new Error('not used') }
  },
}))

import { Config, SETTINGS_NAMESPACE, apply, assertConfig, type Config as PluginConfig } from '../src/index.js'

describe('codex usage Host settings', () => {
  it('uses a stable namespace and validates every field', () => {
    expect(String(SETTINGS_NAMESPACE)).toBe('codex-usage')
    const defaults = Config({})
    expect(defaults).toEqual({
      refreshIntervalMs: 300_000,
      hoverRefreshMinAgeMs: 30_000,
      requestTimeoutMs: 15_000,
      codexCommand: 'codex',
    })
    expect(() => assertConfig({ ...defaults, refreshIntervalMs: 59_999 })).toThrow('refreshIntervalMs')
    expect(() => assertConfig({ ...defaults, hoverRefreshMinAgeMs: 4_999 })).toThrow('hoverRefreshMinAgeMs')
    expect(() => assertConfig({ ...defaults, requestTimeoutMs: 999 })).toThrow('requestTimeoutMs')
    expect(() => assertConfig({ ...defaults, codexCommand: '  ' })).toThrow('codexCommand')
  })

  it('registers restart settings and starts from the resolved value', () => {
    captured.options.length = 0
    const base = Config({})
    const active: PluginConfig = {
      refreshIntervalMs: 120_000,
      hoverRefreshMinAgeMs: 10_000,
      requestTimeoutMs: 5_000,
      codexCommand: '/opt/codex',
    }
    let registration: { namespace?: string; base?: unknown; applies?: string; validate?: (value: PluginConfig) => void } = {}
    const context = {
      settings: {
        register(namespace: unknown, schema: unknown, options: { base: unknown; applies: string; validate: (value: PluginConfig) => void }) {
          registration = { namespace: String(namespace), base: options.base, applies: options.applies, validate: options.validate }
          expect(schema).toBe(Config)
          return { get: () => active }
        },
      },
      effect: (mount: () => unknown) => { mount() },
      webServer: { register: () => () => {} },
    } as unknown as Context

    apply(context, base)
    expect(registration).toMatchObject({ namespace: 'codex-usage', base, applies: 'restart' })
    expect(() => registration.validate?.(active)).not.toThrow()
    expect(captured.options).toEqual([active])
  })
})
