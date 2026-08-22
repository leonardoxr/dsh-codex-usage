import { describe, expect, it } from 'vitest'
import { isTrustedLocalRequest } from '../src/index.js'

describe('local route request checks', () => {
  it('accepts the same-origin Harness browser', () => {
    expect(isTrustedLocalRequest('127.0.0.1', '127.0.0.1:3080', undefined, 'same-origin', 'http://127.0.0.1:3080/')).toBe(true)
    expect(isTrustedLocalRequest('::1', 'localhost:3080', 'http://localhost:3080', 'same-origin', undefined)).toBe(true)
    expect(isTrustedLocalRequest('::1', '[::1]:3080', 'http://[::1]:3080', 'same-origin', undefined)).toBe(true)
  })

  it('rejects remote and cross-site callers', () => {
    expect(isTrustedLocalRequest('192.168.1.5', '127.0.0.1:3080', undefined, 'same-origin', undefined)).toBe(false)
    expect(isTrustedLocalRequest('127.0.0.1', '127.0.0.1:3080', 'https://evil.example', 'cross-site', undefined)).toBe(false)
    expect(isTrustedLocalRequest('127.0.0.1', '127.0.0.1:3080', 'https://evil.example', undefined, undefined)).toBe(false)
    expect(isTrustedLocalRequest('127.0.0.1', 'evil.example:3080', 'http://evil.example:3080', 'same-origin', undefined)).toBe(false)
  })
})
