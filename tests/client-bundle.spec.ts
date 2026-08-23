import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'

describe('built client artifact', () => {
  it('registers the required DSH lazy-CJS factory', () => {
    let registration: { id: string; factory: unknown } | undefined
    const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
    runInNewContext(source, {
      window: {
        __ModuleLoader__: {
          load(value: { id: string; factory: unknown }) { registration = value },
        },
      },
    })
    expect(registration?.id).toBe('dsh-codex-usage')
    expect(registration?.factory).toBeTypeOf('function')
    expect(source).toContain('sidebar.footer.action')
    expect(source).toContain('settings.plugin.item')
    expect(source).toContain('codex-usage')
    expect(source).toContain('calc(100vw - 24px)')
    expect(source).not.toContain('settings.trigger')
  })
})
