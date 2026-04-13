import type { LookupAddress } from 'node:dns'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { normalizeUrl, normalizeUserInputUrl } from '#/lib/domain'

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'host.docker.internal',
  'metadata.google.internal',
])

const BLOCKED_SUFFIXES = ['.internal', '.local', '.home.arpa', '.localhost']

function ipv4ToInt(address: string): number {
  return address
    .split('.')
    .map((segment) => Number(segment))
    .reduce((acc, part) => ((acc << 8) | part) >>> 0, 0)
}

function isPrivateIpv4(address: string): boolean {
  const value = ipv4ToInt(address)
  const withinSubnet = (mask: number, base: number) =>
    ((value & mask) >>> 0) === (base >>> 0)

  return (
    withinSubnet(0xff000000, 0x0a000000) || // 10.0.0.0/8
    withinSubnet(0xff000000, 0x7f000000) || // 127.0.0.0/8
    withinSubnet(0xffff0000, 0xa9fe0000) || // 169.254.0.0/16
    withinSubnet(0xfff00000, 0xac100000) || // 172.16.0.0/12
    withinSubnet(0xffff0000, 0xc0a80000) || // 192.168.0.0/16
    withinSubnet(0xffc00000, 0x64400000) || // 100.64.0.0/10
    withinSubnet(0xff000000, 0x00000000) || // 0.0.0.0/8
    withinSubnet(0xf0000000, 0xe0000000) // multicast + reserved
  )
}

function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase()

  return (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    /^fe[89ab]/.test(normalized)
  )
}

export function isPrivateAddress(address: string): boolean {
  const normalized = address.toLowerCase().replace(/^::ffff:/, '')
  const family = isIP(normalized)

  if (family === 4) return isPrivateIpv4(normalized)
  if (family === 6) return isPrivateIpv6(normalized)

  return false
}

async function resolveHostnameAddresses(hostname: string): Promise<LookupAddress[]> {
  try {
    return await lookup(hostname, { all: true, verbatim: true })
  } catch {
    throw new Error('Unable to resolve URL host')
  }
}

function isBlockedHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase()

  return (
    BLOCKED_HOSTNAMES.has(normalized) ||
    BLOCKED_SUFFIXES.some((suffix) => normalized.endsWith(suffix))
  )
}

export async function assertPublicHttpUrl(input: string): Promise<string> {
  const normalizedInput = normalizeUserInputUrl(input)

  let url: URL
  try {
    url = new URL(normalizedInput)
  } catch {
    throw new Error('Invalid URL')
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only http:// and https:// URLs are supported')
  }

  if (!url.hostname || isBlockedHostname(url.hostname)) {
    throw new Error('Private and local network URLs are not allowed')
  }

  if (isIP(url.hostname) && isPrivateAddress(url.hostname)) {
    throw new Error('Private and local network URLs are not allowed')
  }

  const addresses = await resolveHostnameAddresses(url.hostname)

  if (addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new Error('Private and local network URLs are not allowed')
  }

  return normalizeUrl(url.toString())
}
