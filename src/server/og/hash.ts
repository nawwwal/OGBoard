import { createHash } from 'node:crypto'
import { normalizeUrl } from '#/lib/domain'

export function hashUrl(url: string): string {
  return createHash('sha256').update(normalizeUrl(url)).digest('hex').slice(0, 32)
}

export function ogCacheKey(url: string): string {
  return `og:${hashUrl(url)}`
}

export function ogErrorCacheKey(url: string): string {
  return `ogerr:${hashUrl(url)}`
}
