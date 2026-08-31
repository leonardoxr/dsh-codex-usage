// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type { SettingsScope } from '@deepseek-ai/dsh-client-ui-settings/client'
import { apply, CodexUsageSettingsCard } from '../src/client/index.js'
import {
  buildSettingsWritePlan,
  decodeCodexUsageSettings,
  parseSettingsDraft,
  saveCodexUsageSettings,
  settingsToDraft,
  type CodexUsageSettings,
  type CodexUsageSettingsScope,
} from '../src/client/settings.js'

const reactGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
beforeAll(() => { reactGlobal.IS_REACT_ACT_ENVIRONMENT = true })
afterAll(() => { delete reactGlobal.IS_REACT_ACT_ENVIRONMENT })

const defaults: CodexUsageSettings = {
  refreshIntervalMs: 300_000,
  hoverRefreshMinAgeMs: 30_000,
  requestTimeoutMs: 15_000,
  codexCommand: 'codex',
}

afterEach(() => {
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

describe('codex usage client settings', () => {
  it('decodes and validates all four fields without rewriting command text', () => {
    expect(decodeCodexUsageSettings(defaults)).toEqual(defaults)
    expect(decodeCodexUsageSettings({ ...defaults, requestTimeoutMs: 999 })).toBeUndefined()
    expect(decodeCodexUsageSettings({ ...defaults, codexCommand: ' ' })).toBeUndefined()
    expect(parseSettingsDraft({ ...settingsToDraft(defaults), codexCommand: '  C:\\Codex\\codex.exe  ' }).codexCommand)
      .toBe('  C:\\Codex\\codex.exe  ')
    expect(() => parseSettingsDraft({ ...settingsToDraft(defaults), refreshIntervalMs: '1.5' })).toThrow('whole number')
  })

  it('builds changed-only writes and saves with revision drift protection', async () => {
    const target = { ...defaults, refreshIntervalMs: 600_000, codexCommand: '/opt/codex' }
    expect(buildSettingsWritePlan(defaults, target)).toEqual([
      { field: 'refreshIntervalMs', value: 600_000 },
      { field: 'codexCommand', value: '/opt/codex' },
    ])

    let value = defaults
    let revision = 7
    const writes: string[] = []
    const scope: CodexUsageSettingsScope = {
      getSnapshot: () => ({ status: 'ready', value, revision }),
      set: async (field, next) => {
        writes.push(field)
        value = { ...value, [field]: next } as CodexUsageSettings
        revision += 1
      },
    }
    await saveCodexUsageSettings(scope, target, 7)
    expect(writes).toEqual(['refreshIntervalMs', 'codexCommand'])
    expect(value).toEqual(target)
  })

  it('rejects stale drafts and drift between sequential writes', async () => {
    let staleWrites = 0
    await expect(saveCodexUsageSettings({
      getSnapshot: () => ({ status: 'ready', value: defaults, revision: 3 }),
      set: async () => { staleWrites += 1 },
    }, { ...defaults, requestTimeoutMs: 20_000 }, 2)).rejects.toThrow('changed while editing')
    expect(staleWrites).toBe(0)

    let value = defaults
    let revision = 9
    const scope: CodexUsageSettingsScope = {
      getSnapshot: () => ({ status: 'ready', value, revision }),
      set: async (field, next) => {
        value = { ...value, [field]: next, codexCommand: 'external-codex' } as CodexUsageSettings
        revision += 1
      },
    }
    await expect(saveCodexUsageSettings(scope, {
      ...defaults,
      refreshIntervalMs: 600_000,
      requestTimeoutMs: 20_000,
    }, 9)).rejects.toThrow('changed while saving')
  })

  it('binds the namespace and registers the canonical plugin card slot', () => {
    let namespace: string | undefined
    const slots: Array<{ name: string; key?: string; id?: string }> = []
    const context = {
      settingsScope: { bind: (spec: { namespace: string }) => { namespace = spec.namespace; return {} } },
      effect: () => {},
      slots: {
        inject: (_name: string, mount: () => unknown) => { mount() },
        register: (spec: { name: string; key?: string; id?: string }) => { slots.push(spec); return () => {} },
      },
    } as unknown as ClientContext
    apply(context)
    expect(namespace).toBe('codex-usage')
    expect(slots).toContainEqual({ name: 'settings.plugin.item', key: 'codex-usage' })
    expect(slots).toContainEqual(expect.objectContaining({ name: 'sidebar.footer.action', id: 'codex-usage' }))
  })

  it('renders a collapsible four-field staged form with restart notice and validation', () => {
    const container = document.createElement('div')
    document.body.append(container)
    const set = vi.fn(async () => {})
    const snapshot = { status: 'ready' as const, value: defaults, revision: 1, writable: true, mode: 'persistent' as const }
    const scope = {
      subscribe: () => () => {},
      getSnapshot: () => snapshot,
      set,
    } as unknown as SettingsScope<CodexUsageSettings>
    const root = createRoot(container)
    act(() => { root.render(<CodexUsageSettingsCard scope={scope} />) })
    expect(container.querySelectorAll('input')).toHaveLength(0)
    act(() => { (container.querySelector('.dcu-settings-header') as HTMLButtonElement).click() })
    expect(container.querySelectorAll('input')).toHaveLength(4)
    expect(container.textContent).toContain('take effect after DSH Web restarts')
    const command = container.querySelector('input[aria-label="Codex command"]') as HTMLInputElement
    act(() => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setValue?.call(command, '   ')
      command.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('required')
    expect(set).not.toHaveBeenCalled()
    act(() => { root.unmount() })
  })
})
