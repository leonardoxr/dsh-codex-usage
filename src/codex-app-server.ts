import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { existsSync } from 'node:fs'
import { delimiter, extname, isAbsolute, join } from 'node:path'
import { createInterface, type Interface } from 'node:readline'

interface RpcResponse {
  id?: number | string
  result?: unknown
  error?: { code?: number; message?: string }
  method?: string
  params?: unknown
}

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

export interface CodexAppServerOptions {
  command: string
  requestTimeoutMs: number
}

function resolveExecutable(command: string): string {
  if (isAbsolute(command) || command.includes('/') || command.includes('\\')) return command
  const path = process.env.PATH ?? ''
  const extensions = process.platform === 'win32'
    ? (process.env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';')
    : ['']
  const hasExtension = extname(command) !== ''
  for (const directory of path.split(delimiter)) {
    if (directory === '') continue
    const candidates = hasExtension ? [command] : extensions.map(extension => command + extension.toLowerCase())
    for (const candidate of candidates) {
      const full = join(directory.replace(/^"|"$/g, ''), candidate)
      if (existsSync(full)) return full
    }
  }
  return command
}

function message(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

/** A small, managed JSON-lines client for Codex's stable app-server protocol. */
export class CodexAppServer {
  private process: ChildProcessWithoutNullStreams | null = null
  private lines: Interface | null = null
  private startPromise: Promise<void> | null = null
  private nextId = 1
  private readonly pending = new Map<number | string, PendingRequest>()
  private disposed = false

  constructor(private readonly options: CodexAppServerOptions) {}

  async request(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    await this.start()
    return this.sendRequest(method, params)
  }

  private async start(): Promise<void> {
    if (this.disposed) throw new Error('Codex usage service is stopped')
    if (this.startPromise !== null) return this.startPromise
    if (this.process !== null) return
    this.startPromise = this.open()
    try {
      await this.startPromise
    } finally {
      this.startPromise = null
    }
  }

  private async open(): Promise<void> {
    const command = resolveExecutable(this.options.command)
    const extension = extname(command).toLowerCase()
    const windowsShim = process.platform === 'win32' && (extension === '.cmd' || extension === '.bat')
    const powerShellShim = windowsShim ? command.slice(0, -extension.length) + '.ps1' : ''
    const hasPowerShellShim = powerShellShim !== '' && existsSync(powerShellShim)
    const executable = hasPowerShellShim ? 'pwsh.exe' : command
    const args = hasPowerShellShim
      ? ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', powerShellShim, 'app-server', '--listen', 'stdio://']
      : ['app-server', '--listen', 'stdio://']
    const child = spawn(executable, args, {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
      // A custom .cmd/.bat without the normal npm companion .ps1 needs the
      // Windows command processor. Config is trusted and all arguments are fixed.
      shell: windowsShim && !hasPowerShellShim,
    })
    const lines = createInterface({ input: child.stdout, crlfDelay: Infinity })
    this.process = child
    this.lines = lines
    lines.on('line', line => { this.handleLine(line) })
    child.stderr.resume()
    child.once('error', error => { this.handleExit(child, lines, error) })
    child.stdin.once('error', error => { this.handleExit(child, lines, error) })
    child.once('exit', (code, signal) => {
      this.handleExit(child, lines, new Error(
        signal === null
          ? `Codex app-server exited with code ${String(code)}`
          : `Codex app-server exited after signal ${signal}`,
      ))
    })

    try {
      await this.sendRequest('initialize', {
        clientInfo: {
          name: 'dsh_codex_usage',
          title: 'DeepSeek Harness Codex Usage',
          version: '0.1.0',
        },
        capabilities: {
          optOutNotificationMethods: [
            'remoteControl/status/changed',
            'thread/status/changed',
          ],
        },
      })
      this.sendNotification('initialized', {})
    } catch (error) {
      const failure = new Error(`Unable to initialize Codex app-server: ${message(error)}`)
      this.handleExit(child, lines, failure)
      throw failure
    }
  }

  private sendRequest(method: string, params: Record<string, unknown>): Promise<unknown> {
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Codex app-server request timed out: ${method}`))
      }, this.options.requestTimeoutMs)
      this.pending.set(id, { resolve, reject, timer })
      try {
        this.write({ method, id, params })
      } catch (error) {
        clearTimeout(timer)
        this.pending.delete(id)
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    })
  }

  private sendNotification(method: string, params: Record<string, unknown>): void {
    this.write({ method, params })
  }

  private write(value: unknown): void {
    const child = this.process
    if (child === null || child.stdin.destroyed) throw new Error('Codex app-server is unavailable')
    child.stdin.write(JSON.stringify(value) + '\n')
  }

  private handleLine(line: string): void {
    let payload: RpcResponse
    try {
      payload = JSON.parse(line) as RpcResponse
    } catch {
      return
    }
    if (payload.id === undefined) return
    const pending = this.pending.get(payload.id)
    if (pending === undefined) return
    clearTimeout(pending.timer)
    this.pending.delete(payload.id)
    if (payload.error !== undefined) {
      pending.reject(new Error(payload.error.message ?? `Codex app-server error ${String(payload.error.code ?? 'unknown')}`))
      return
    }
    pending.resolve(payload.result)
  }

  private handleExit(child: ChildProcessWithoutNullStreams, lines: Interface, error: Error): void {
    if (this.process !== child) return
    lines.close()
    this.lines = null
    this.process = null
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer)
      pending.reject(error)
    }
    this.pending.clear()
    if (child.exitCode === null && !child.killed) {
      try { child.kill() } catch { /* The process may have failed before receiving a pid. */ }
    }
  }

  dispose(): void {
    this.disposed = true
    const child = this.process
    this.process = null
    this.lines?.close()
    this.lines = null
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer)
      pending.reject(new Error('Codex usage service stopped'))
    }
    this.pending.clear()
    if (child !== null && !child.killed) child.kill()
  }
}
