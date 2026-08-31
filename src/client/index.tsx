import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type { SettingsScope } from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { CodexUsageData, RateLimitSnapshot, RateLimitWindow } from '../types.js'
import {
  decodeCodexUsageSettings,
  parseSettingsDraft,
  saveCodexUsageSettings,
  settingsEqual,
  settingsToDraft,
  type CodexUsageSettings,
  type SettingsDraft,
  type SettingsField,
} from './settings.js'
import { UsageStore } from './store.js'
import { STYLE_ID, styles } from './styles.js'

export const inject = ['slots', 'settingsScope']

const store = new UsageStore()
const RING_LENGTH = 2 * Math.PI * 9
const OPENAI_PATH = 'M9.205 8.658v-2.26c0-.19.072-.333.238-.428l4.543-2.616c.619-.357 1.356-.523 2.117-.523 2.854 0 4.662 2.212 4.662 4.566 0 .167 0 .357-.024.547l-4.71-2.759a.797.797 0 00-.856 0l-5.97 3.473zm10.609 8.8V12.06c0-.333-.143-.57-.429-.737l-5.97-3.473 1.95-1.118a.433.433 0 01.476 0l4.543 2.617c1.309.76 2.189 2.378 2.189 3.948 0 1.808-1.07 3.473-2.76 4.163zM7.802 12.703l-1.95-1.142c-.167-.095-.239-.238-.239-.428V5.899c0-2.545 1.95-4.472 4.591-4.472 1 0 1.927.333 2.712.928L8.23 5.067c-.285.166-.428.404-.428.737v6.898zM12 15.128l-2.795-1.57v-3.33L12 8.658l2.795 1.57v3.33L12 15.128zm1.796 7.23c-1 0-1.927-.332-2.712-.927l4.686-2.712c.285-.166.428-.404.428-.737v-6.898l1.974 1.142c.167.095.238.238.238.428v5.233c0 2.545-1.974 4.472-4.614 4.472zm-5.637-5.303l-4.544-2.617c-1.308-.761-2.188-2.378-2.188-3.948A4.482 4.482 0 014.21 6.327v5.423c0 .333.143.571.428.738l5.947 3.449-1.95 1.118a.432.432 0 01-.476 0zm-.262 3.9c-2.688 0-4.662-2.021-4.662-4.519 0-.19.024-.38.047-.57l4.686 2.71c.286.167.571.167.856 0l5.97-3.448v2.26c0 .19-.07.333-.237.428l-4.543 2.616c-.619.357-1.356.523-2.117.523zm5.899 2.83a5.947 5.947 0 005.827-4.756C22.287 18.339 24 15.84 24 13.296c0-1.665-.713-3.282-1.998-4.448.119-.5.19-.999.19-1.498 0-3.401-2.759-5.947-5.946-5.947-.642 0-1.26.095-1.88.31A5.962 5.962 0 0010.205 0a5.947 5.947 0 00-5.827 4.757C1.713 5.447 0 7.945 0 10.49c0 1.666.713 3.283 1.998 4.448-.119.5-.19 1-.19 1.499 0 3.401 2.759 5.946 5.946 5.946.642 0 1.26-.095 1.88-.309a5.96 5.96 0 004.162 1.713z'

function isSparkBucket(id: string, snapshot: RateLimitSnapshot): boolean {
  return /spark/i.test(id) || /spark/i.test(snapshot.limitId ?? '') || /spark/i.test(snapshot.limitName ?? '')
}

export function usageSnapshots(data: CodexUsageData | null): Array<[string, RateLimitSnapshot]> {
  if (data === null) return []
  const buckets = data.rateLimitsByLimitId
  if (buckets !== null && Object.keys(buckets).length > 0) {
    return Object.entries(buckets).filter(([id, snapshot]) => !isSparkBucket(id, snapshot))
  }
  return isSparkBucket(data.rateLimits.limitId ?? 'codex', data.rateLimits)
    ? []
    : [[data.rateLimits.limitId ?? 'codex', data.rateLimits]]
}

export function mainPlanUsedPercent(data: CodexUsageData | null): number {
  if (data === null || isSparkBucket(data.rateLimits.limitId ?? 'codex', data.rateLimits)) return 0
  return Math.max(
    data.rateLimits.primary?.usedPercent ?? 0,
    data.rateLimits.secondary?.usedPercent ?? 0,
  )
}

function severity(percent: number): '' | 'warn' | 'critical' {
  return percent >= 90 ? 'critical' : percent >= 70 ? 'warn' : ''
}

function durationLabel(minutes: number | null): string {
  if (minutes === null) return 'Usage window'
  if (minutes < 60) return `${minutes} min window`
  const hours = minutes / 60
  if (hours < 48) return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} hour window`
  const days = hours / 24
  return `${Number.isInteger(days) ? days : days.toFixed(1)} day window`
}

function resetLabel(timestamp: number | null): string {
  if (timestamp === null) return 'Reset time unavailable'
  const date = new Date(timestamp * 1000)
  const relativeMs = date.getTime() - Date.now()
  const absolute = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
  if (relativeMs <= 0) return `Reset due · ${absolute}`
  const minutes = Math.ceil(relativeMs / 60_000)
  const relative = minutes < 60
    ? `in ${minutes}m`
    : minutes < 2880
      ? `in ${Math.ceil(minutes / 60)}h`
      : `in ${Math.ceil(minutes / 1440)}d`
  return `Resets ${relative} · ${absolute}`
}

function titleCase(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return 'Unknown'
  return value.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase())
}

function UsageWindow({ value }: { value: RateLimitWindow }) {
  const level = severity(value.usedPercent)
  return <div className="dcu-window">
    <div className="dcu-window-head">
      <span>{durationLabel(value.windowDurationMins)}</span>
      <span className="dcu-percent">{Math.round(value.usedPercent)}% used</span>
    </div>
    <div className="dcu-bar" aria-hidden="true">
      <div className={`dcu-bar-fill${level === '' ? '' : ` dcu-bar-${level}`}`} style={{ width: `${value.usedPercent}%` }} />
    </div>
    <div className="dcu-reset">{resetLabel(value.resetsAt)}</div>
  </div>
}

function Bucket({ id, snapshot }: { id: string; snapshot: RateLimitSnapshot }) {
  const windows = [snapshot.primary, snapshot.secondary].filter((item): item is RateLimitWindow => item !== null)
  return <section className="dcu-bucket">
    <div className="dcu-bucket-title">
      <span>{snapshot.limitName ?? titleCase(id)}</span>
      {snapshot.rateLimitReachedType !== null && <span>{titleCase(snapshot.rateLimitReachedType)}</span>}
    </div>
    {windows.length === 0
      ? <div className="dcu-empty">No rolling-window details reported.</div>
      : windows.map((value, index) => <UsageWindow key={`${value.windowDurationMins ?? 'unknown'}-${index}`} value={value} />)}
    {(snapshot.planType !== null || snapshot.credits !== null || snapshot.individualLimit !== null || snapshot.spendControlReached !== null) && <dl className="dcu-bucket-meta">
      {snapshot.planType !== null && <><dt>Plan</dt><dd>{titleCase(snapshot.planType)}</dd></>}
      {snapshot.credits !== null && <><dt>Credits</dt><dd>{snapshot.credits.unlimited ? 'Unlimited' : (snapshot.credits.balance ?? (snapshot.credits.hasCredits ? 'Available' : 'None'))}</dd></>}
      {snapshot.individualLimit !== null && <><dt>Spend used</dt><dd>{snapshot.individualLimit.used} / {snapshot.individualLimit.limit}</dd><dt>Spend remaining</dt><dd>{Math.round(snapshot.individualLimit.remainingPercent)}%</dd><dt>Spend resets</dt><dd>{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(snapshot.individualLimit.resetsAt * 1000))}</dd></>}
      {snapshot.spendControlReached !== null && <><dt>Spend control</dt><dd>{snapshot.spendControlReached ? 'Reached' : 'Available'}</dd></>}
    </dl>}
  </section>
}

function UsagePanel({ data, error, loading }: { data: CodexUsageData | null; error: string | null; loading: boolean }) {
  const buckets = usageSnapshots(data)
  const defaultSnapshot = data?.rateLimits ?? null
  const plan = data?.account?.planType ?? defaultSnapshot?.planType
  const resetCredits = data?.rateLimitResetCredits
  const fetched = data === null ? null : new Date(data.fetchedAt)
  return <div className="dcu-panel" role="tooltip" id="dcu-usage-tooltip" onClick={event => { event.stopPropagation() }}>
    <div className="dcu-panel-header">
      <span className={`dcu-live${error === null ? '' : ' dcu-live-stale'}`} />
      <div>
        <div className="dcu-panel-title">Codex plan usage</div>
        <div className="dcu-panel-subtitle">{titleCase(plan)} · OpenAI Codex</div>
      </div>
    </div>
    {error !== null && <div className="dcu-error">{error}{data !== null ? ' — showing the last successful update.' : ''}</div>}
    {loading && data === null && <div className="dcu-spinner" aria-label="Loading Codex usage" />}
    {!loading && data === null && error === null && <div className="dcu-empty">Hover to load usage details.</div>}
    {buckets.map(([id, snapshot]) => <Bucket key={id} id={id} snapshot={snapshot} />)}
    {resetCredits !== null && resetCredits !== undefined && <dl className="dcu-meta"><dt>Reset credits</dt><dd>{resetCredits.availableCount}</dd></dl>}
    {resetCredits?.credits !== null && resetCredits?.credits !== undefined && resetCredits.credits.length > 0 && <section className="dcu-credit-list">
      <div className="dcu-credit-heading">Available reset credits</div>
      {resetCredits.credits.map((credit, index) => <div className="dcu-credit" key={`${credit.grantedAt}-${index}`}>
        <div><strong>{credit.title ?? titleCase(credit.resetType)}</strong><span>{titleCase(credit.status)}</span></div>
        {credit.description !== null && <p>{credit.description}</p>}
        <small>{credit.expiresAt === null ? 'No expiry reported' : `Expires ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(credit.expiresAt * 1000))}`}</small>
      </div>)}
    </section>}
    <div className="dcu-footer">
      <span>{fetched === null ? 'Not updated yet' : `Updated ${new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' }).format(fetched)}`}</span>
      <span>{loading ? 'Refreshing…' : 'Hover refreshes'}</span>
    </div>
  </div>
}

export function OpenAIUsageIndicator() {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const [open, setOpen] = useState(false)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const percent = useMemo(() => mainPlanUsedPercent(state.data), [state.data])
  const level = severity(percent)

  const enter = () => {
    if (closeTimer.current !== null) clearTimeout(closeTimer.current)
    closeTimer.current = null
    setOpen(true)
    if (hoverTimer.current !== null) clearTimeout(hoverTimer.current)
    hoverTimer.current = setTimeout(() => { void store.refresh(true) }, 250)
  }
  const leave = () => {
    if (hoverTimer.current !== null) clearTimeout(hoverTimer.current)
    hoverTimer.current = null
    if (closeTimer.current !== null) clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => {
      setOpen(false)
      closeTimer.current = null
    }, 200)
  }
  const closeImmediately = () => {
    if (hoverTimer.current !== null) clearTimeout(hoverTimer.current)
    if (closeTimer.current !== null) clearTimeout(closeTimer.current)
    hoverTimer.current = null
    closeTimer.current = null
    setOpen(false)
  }

  useEffect(() => () => {
    if (hoverTimer.current !== null) clearTimeout(hoverTimer.current)
    if (closeTimer.current !== null) clearTimeout(closeTimer.current)
  }, [])

  return <div className="dcu-usage-root" onMouseEnter={enter} onMouseLeave={leave}>
    <button
      type="button"
      className="dcu-meter"
      aria-label={`Codex usage: ${Math.round(percent)} percent used`}
      title="Codex usage"
      aria-describedby={open ? 'dcu-usage-tooltip' : undefined}
      aria-expanded={open}
      onFocus={enter}
      onBlur={leave}
      onClick={enter}
      onKeyDown={event => {
        if (event.key === 'Escape') {
          closeImmediately()
          event.currentTarget.blur()
        }
      }}
    >
      <svg className="dcu-ring" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
        <circle className="dcu-track" cx="12" cy="12" r="9" />
        <circle className={`dcu-fill${level === '' ? '' : ` dcu-fill-${level}`}`} cx="12" cy="12" r="9" strokeDasharray={RING_LENGTH} strokeDashoffset={RING_LENGTH * (1 - percent / 100)} />
      </svg>
      <svg className="dcu-logo" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={OPENAI_PATH} /></svg>
    </button>
    {open && <UsagePanel data={state.data} error={state.error} loading={state.phase === 'loading'} />}
  </div>
}

interface SettingsCardProps {
  scope: SettingsScope<CodexUsageSettings>
}

interface SettingsDraftState {
  value: SettingsDraft
  revision: number
}

interface SettingsFieldSpec {
  key: SettingsField
  label: string
  hint: string
  minimum?: number
}

const SETTINGS_FIELDS: SettingsFieldSpec[] = [
  {
    key: 'refreshIntervalMs',
    label: 'Background refresh interval',
    hint: 'Milliseconds between normal usage polls. Minimum 60000.',
    minimum: 60_000,
  },
  {
    key: 'hoverRefreshMinAgeMs',
    label: 'Hover refresh minimum age',
    hint: 'Milliseconds before hover may force another provider read. Minimum 5000.',
    minimum: 5_000,
  },
  {
    key: 'requestTimeoutMs',
    label: 'Request timeout',
    hint: 'Milliseconds allowed for each Codex app-server request. Minimum 1000.',
    minimum: 1_000,
  },
  {
    key: 'codexCommand',
    label: 'Codex command',
    hint: 'Executable name or absolute path used to start Codex.',
  },
]

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

export function CodexUsageSettingsCard({ scope }: SettingsCardProps): JSX.Element | null {
  const subscribe = useCallback((listener: () => void) => scope.subscribe(listener), [scope])
  const getSnapshot = useCallback(() => scope.getSnapshot(), [scope])
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<SettingsDraftState | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (snapshot.status === 'unavailable') return null
  const current = snapshot.value
  const visible = draft?.value ?? (current === undefined ? undefined : settingsToDraft(current))
  let parsed: CodexUsageSettings | undefined
  let validationError: string | null = null
  if (visible !== undefined) {
    try {
      parsed = parseSettingsDraft(visible)
    } catch (cause) {
      validationError = errorMessage(cause)
    }
  }
  const dirty = draft !== null
  const changed = parsed !== undefined && current !== undefined && !settingsEqual(parsed, current)
  const disabled = !snapshot.writable || saving || current === undefined || snapshot.revision === undefined

  const updateField = (key: SettingsField, value: string): void => {
    if (disabled || current === undefined || snapshot.revision === undefined) return
    const revision = snapshot.revision
    setError(null)
    setDraft(previous => {
      const next = { ...(previous?.value ?? settingsToDraft(current)), [key]: value }
      try {
        if (settingsEqual(parseSettingsDraft(next), current)) return null
      } catch {
        // Invalid drafts stay staged so the card can explain what must be fixed.
      }
      return { value: next, revision: previous?.revision ?? revision }
    })
  }

  const discard = (): void => {
    setDraft(null)
    setError(null)
  }

  const save = async (): Promise<void> => {
    if (draft === null || parsed === undefined || !changed || saving) return
    setSaving(true)
    setError(null)
    try {
      await saveCodexUsageSettings(scope, parsed, draft.revision)
      setDraft(null)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setSaving(false)
    }
  }

  return <li className="dcu-settings-card" data-open={open}>
    <button
      type="button"
      className="dcu-settings-header"
      aria-expanded={open}
      onClick={() => { setOpen(value => !value) }}
    >
      <span className="dcu-settings-heading">
        <span className="dcu-settings-title">Codex usage</span>
        <span className="dcu-settings-description">Configure provider refresh and process startup limits.</span>
      </span>
      {dirty ? <span className="dcu-settings-pending">Unsaved</span> : null}
      <svg className="dcu-settings-chevron" viewBox="0 0 20 20" aria-hidden="true">
        <path d="m5 7.5 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
    {open ? <div className="dcu-settings-body">
      <p className="dcu-settings-notice">Saved Codex usage settings take effect after DSH Web restarts.</p>
      {visible === undefined
        ? <p className="dcu-settings-status">Loading Codex usage settings…</p>
        : <>
          {SETTINGS_FIELDS.map(spec => <label className="dcu-settings-field" key={spec.key}>
            <span className="dcu-settings-copy">
              <span className="dcu-settings-label">{spec.label}</span>
              <span className="dcu-settings-hint">{spec.hint}</span>
            </span>
            <input
              className="dcu-settings-input"
              type={spec.minimum === undefined ? 'text' : 'number'}
              min={spec.minimum}
              step={spec.minimum === undefined ? undefined : 1}
              value={visible[spec.key]}
              disabled={disabled}
              aria-label={spec.label}
              onChange={event => { updateField(spec.key, event.currentTarget.value) }}
            />
          </label>)}
          <div className="dcu-settings-footer">
            <p className="dcu-settings-error" role={error !== null || validationError !== null ? 'alert' : undefined}>
              {error ?? validationError ?? ''}
            </p>
            <button type="button" className="dcu-settings-button" disabled={!dirty || saving} onClick={discard}>Discard</button>
            <button
              type="button"
              className="dcu-settings-button dcu-settings-save"
              disabled={!dirty || !changed || validationError !== null || saving || !snapshot.writable}
              onClick={() => { void save() }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </>}
    </div> : null}
  </li>
}

type FooterActionProps = PropsRuntime<'sidebar.footer.action'>

const FOOTER_COORDINATOR = Symbol.for('dsh.usage-footer-coordinator')

interface FooterCoordinator {
  register(anchor: HTMLElement): () => void
}

function isFooterCoordinator(value: unknown): value is FooterCoordinator {
  return typeof value === 'object' && value !== null
    && typeof (value as { register?: unknown }).register === 'function'
}

/**
 * One coordinator owns the whole footer row. Both usage bundles use the same
 * Symbol.for key, so independently loaded client bundles share one DOM/layout
 * writer instead of racing two MutationObservers over the same Settings button.
 */
function createFooterCoordinator(footerActions: HTMLElement): FooterCoordinator {
  const registered = new Set<HTMLElement>()
  const inactive = new Set<HTMLElement>()
  let settingsTrigger: HTMLButtonElement | null = null
  let originalWidth: string | null = null
  let observedSettingsArea: HTMLElement | null = null
  let resizeObserver: ResizeObserver | null = null
  let disposed = false

  const usageAnchors = (): HTMLElement[] => {
    const current = new Set<HTMLElement>(footerActions.querySelectorAll<HTMLElement>('[data-dsh-usage-footer-action]'))
    for (const anchor of registered) current.add(anchor)
    return [...current].filter(anchor => !inactive.has(anchor) && footerActions.contains(anchor) && anchor.isConnected)
  }

  const hide = (anchor: HTMLElement) => {
    anchor.style.visibility = 'hidden'
    anchor.style.removeProperty('--dcl-panel-available-width')
    anchor.style.removeProperty('--dcu-panel-available-width')
  }

  const releaseTrigger = () => {
    resizeObserver?.disconnect()
    resizeObserver = null
    if (settingsTrigger !== null && originalWidth !== null) settingsTrigger.style.width = originalWidth
    settingsTrigger = null
    originalWidth = null
    observedSettingsArea = null
  }

  const position = () => {
    if (disposed) return
    const settingsArea = footerActions.nextElementSibling instanceof HTMLElement
      ? footerActions.nextElementSibling
      : null
    const candidate = settingsArea?.querySelector('button')
    const current = usageAnchors()
    if (settingsArea === null || !(candidate instanceof HTMLButtonElement)) {
      releaseTrigger()
      for (const anchor of current) hide(anchor)
      return
    }
    if (candidate !== settingsTrigger || settingsArea !== observedSettingsArea) {
      releaseTrigger()
      settingsTrigger = candidate
      originalWidth = candidate.style.width
      observedSettingsArea = settingsArea
      resizeObserver = new ResizeObserver(position)
      resizeObserver.observe(candidate)
      resizeObserver.observe(footerActions)
      resizeObserver.observe(settingsArea)
    }
    // Keep the footer order stable even when providers mount asynchronously.
    // Claude is the first lane, Codex the second; unknown providers retain DOM order.
    const providerRank = (anchor: HTMLElement): number => {
      const provider = anchor.dataset.dshUsageFooterAction
      return provider === 'claude' ? 0 : provider === 'codex' ? 1 : 2
    }
    current.sort((a, b) => {
      const rankDifference = providerRank(a) - providerRank(b)
      if (rankDifference !== 0) return rankDifference
      if (a === b) return 0
      return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
    })
    candidate.style.width = 'calc(100% - ' + (34 * current.length) + 'px)'
    const rect = candidate.getBoundingClientRect()
    current.forEach((anchor, index) => {
      const left = rect.right + 4 + index * 32
      anchor.style.left = String(left) + 'px'
      anchor.style.top = String(rect.top + (rect.height - 28) / 2) + 'px'
      const available = String(Math.max(0, left + 28 - 12)) + 'px'
      // Each provider keeps its own variable, while the coordinator writes both
      // so a mixed old/new client deployment still receives one placement pass.
      anchor.style.setProperty('--dcl-panel-available-width', available)
      anchor.style.setProperty('--dcu-panel-available-width', available)
      anchor.style.visibility = 'visible'
    })
  }

  const observedRoot = footerActions.parentElement ?? footerActions
  const mutationObserver = new MutationObserver(position)
  mutationObserver.observe(observedRoot, { childList: true, subtree: true })

  const coordinator: FooterCoordinator = {
    register(anchor) {
      registered.add(anchor)
      inactive.delete(anchor)
      anchor.style.visibility = 'hidden'
      position()
      return () => {
        if (!registered.delete(anchor)) return
        inactive.add(anchor)
        hide(anchor)
        if (usageAnchors().length === 0) {
          dispose()
        } else {
          position()
        }
      }
    },
  }

  const dispose = () => {
    if (disposed) return
    disposed = true
    mutationObserver.disconnect()
    releaseTrigger()
    for (const anchor of registered) hide(anchor)
    registered.clear()
    const record = footerActions as unknown as { [key: symbol]: unknown }
    if (record[FOOTER_COORDINATOR] === coordinator) delete record[FOOTER_COORDINATOR]
  }

  // register() can only run after this object exists; the callback is invoked
  // later by the MutationObserver/ResizeObserver event loop.
  const record = footerActions as unknown as { [key: symbol]: unknown }
  record[FOOTER_COORDINATOR] = coordinator
  position()
  return coordinator
}

function footerCoordinatorFor(footerActions: HTMLElement): FooterCoordinator {
  const record = footerActions as unknown as { [key: symbol]: unknown }
  const existing = record[FOOTER_COORDINATOR]
  if (isFooterCoordinator(existing)) return existing
  return createFooterCoordinator(footerActions)
}

export function bindFooterMeter(anchor: HTMLDivElement): () => void {
  const slotWrapper = anchor.closest('[data-slot="sidebar.footer.action"]')
  const footerActions = slotWrapper?.parentElement ?? anchor.parentElement
  if (!(footerActions instanceof HTMLElement)) return () => {}
  return footerCoordinatorFor(footerActions).register(anchor)
}

export function FooterUsageAction({ wide }: FooterActionProps) {
  const anchorRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!wide || anchorRef.current === null) return () => {}
    return bindFooterMeter(anchorRef.current)
  }, [wide])
  if (!wide) return null
  return <div ref={anchorRef} className="dcu-footer-action-anchor" data-dsh-usage-footer-action="codex"><OpenAIUsageIndicator /></div>
}

export function apply(ctx: ClientContext): void {
  const settingsScope = ctx.settingsScope.bind<CodexUsageSettings>({
    namespace: 'codex-usage',
    decode: decodeCodexUsageSettings,
  })

  ctx.effect(() => {
    if (document.querySelector(`style[data-plugin-css="${STYLE_ID}"]`) !== null) return () => {}
    const tag = document.createElement('style')
    tag.dataset.plugin = 'dsh-codex-usage'
    tag.dataset.pluginCss = STYLE_ID
    tag.textContent = styles
    document.head.appendChild(tag)
    return () => { tag.remove() }
  }, 'codex-usage: styles')

  ctx.effect(() => {
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const poll = async () => {
      await store.refresh(false)
      if (stopped) return
      timer = setTimeout(() => { void poll() }, store.getSnapshot().policy.refreshIntervalMs)
    }
    void poll()
    return () => {
      stopped = true
      if (timer !== null) clearTimeout(timer)
    }
  }, 'codex-usage: polling')

  const SettingsCard = (): JSX.Element | null => <CodexUsageSettingsCard scope={settingsScope} />
  ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
    name: 'settings.plugin.item',
    key: 'codex-usage',
  }, SettingsCard))

  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action',
    id: 'codex-usage',
    order: 100,
    label: 'Codex usage',
  }, FooterUsageAction))
}
