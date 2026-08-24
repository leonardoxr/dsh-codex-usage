// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { bindFooterMeter } from '../src/client/index.js'

class TestResizeObserver {
  observe(): void {}
  disconnect(): void {}
}

function makeTrigger(right: number, top: number, previousWidth: string): HTMLButtonElement {
  const button = document.createElement('button')
  button.style.width = previousWidth
  button.getBoundingClientRect = () => ({
    x: right - 100,
    y: top,
    top,
    right,
    bottom: top + 42,
    left: right - 100,
    width: 100,
    height: 42,
    toJSON: () => ({}),
  })
  return button
}

afterEach(() => {
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

describe('footer meter placement', () => {
  it('binds after a late Settings mount and rebinds after replacement', async () => {
    vi.stubGlobal('ResizeObserver', TestResizeObserver)
    const foot = document.createElement('div')
    const footerActions = document.createElement('div')
    const settingsArea = document.createElement('div')
    const slotWrapper = document.createElement('div')
    slotWrapper.dataset.slot = 'sidebar.footer.action'
    slotWrapper.style.display = 'contents'
    const anchor = document.createElement('div')
    slotWrapper.append(anchor)
    footerActions.append(slotWrapper)
    foot.append(footerActions, settingsArea)
    document.body.append(foot)

    const dispose = bindFooterMeter(anchor)
    expect(anchor.style.visibility).toBe('hidden')

    const first = makeTrigger(200, 400, '75%')
    settingsArea.append(first)
    await vi.waitFor(() => { expect(first.style.width).toBe('calc(100% - 34px)') })
    expect(anchor.style.left).toBe('204px')
    expect(anchor.style.top).toBe('407px')
    expect(anchor.style.getPropertyValue('--dcu-panel-available-width')).toBe('220px')
    expect(anchor.style.visibility).toBe('visible')

    const second = makeTrigger(240, 300, '80%')
    first.replaceWith(second)
    await vi.waitFor(() => { expect(second.style.width).toBe('calc(100% - 34px)') })
    expect(first.style.width).toBe('75%')
    expect(anchor.style.left).toBe('244px')
    expect(anchor.style.top).toBe('307px')
    expect(anchor.style.getPropertyValue('--dcu-panel-available-width')).toBe('260px')

    dispose()
    expect(second.style.width).toBe('80%')
    expect(anchor.style.getPropertyValue('--dcu-panel-available-width')).toBe('')
    expect(anchor.style.visibility).toBe('hidden')
  })

  it('coordinates two provider meters without overlap', async () => {
    vi.stubGlobal('ResizeObserver', TestResizeObserver)
    const foot = document.createElement('div')
    const footerActions = document.createElement('div')
    const settingsArea = document.createElement('div')
    const slotWrapper = document.createElement('div')
    slotWrapper.dataset.slot = 'sidebar.footer.action'
    slotWrapper.style.display = 'contents'
    const makeAnchor = (provider: string) => {
      const anchor = document.createElement('div')
      anchor.dataset.dshUsageFooterAction = provider
      return anchor
    }
    const first = makeAnchor('claude')
    const second = makeAnchor('codex')
    slotWrapper.append(first, second)
    footerActions.append(slotWrapper)
    foot.append(footerActions, settingsArea)
    document.body.append(foot)

    const disposeFirst = bindFooterMeter(first)
    const disposeSecond = bindFooterMeter(second)
    const trigger = makeTrigger(200, 400, '75%')
    settingsArea.append(trigger)
    await vi.waitFor(() => {
      expect(trigger.style.width).toBe('calc(100% - 68px)')
      expect(first.style.left).toBe('204px')
      expect(second.style.left).toBe('236px')
    })

    disposeFirst()
    first.remove()
    await vi.waitFor(() => {
      expect(trigger.style.width).toBe('calc(100% - 34px)')
      expect(second.style.left).toBe('204px')
    })

    disposeSecond()
    second.remove()
    expect(trigger.style.width).toBe('75%')
  })
})
