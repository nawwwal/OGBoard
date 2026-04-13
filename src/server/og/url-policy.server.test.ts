import { describe, expect, it } from 'vitest'
import { isPrivateAddress } from '#/server/og/url-policy.server'

describe('url policy', () => {
  it('detects private ipv4 addresses', () => {
    expect(isPrivateAddress('127.0.0.1')).toBe(true)
    expect(isPrivateAddress('10.0.1.25')).toBe(true)
    expect(isPrivateAddress('172.16.10.5')).toBe(true)
    expect(isPrivateAddress('192.168.1.8')).toBe(true)
    expect(isPrivateAddress('8.8.8.8')).toBe(false)
  })

  it('detects local and unique-local ipv6 addresses', () => {
    expect(isPrivateAddress('::1')).toBe(true)
    expect(isPrivateAddress('fc00::1')).toBe(true)
    expect(isPrivateAddress('fd12:3456:789a::1')).toBe(true)
    expect(isPrivateAddress('fe80::1')).toBe(true)
    expect(isPrivateAddress('2606:4700:4700::1111')).toBe(false)
  })
})
