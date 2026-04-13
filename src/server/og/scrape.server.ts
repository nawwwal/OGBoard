import ogs from 'open-graph-scraper'
import mql from '@microlink/mql'
import { redis } from '#/server/redis'
import { ogCacheKey, ogErrorCacheKey } from '#/server/og/hash'
import { scoreDetection } from '#/server/og/detect.server'
import { normalizeUrl } from '#/lib/domain'
import { assertPublicHttpUrl } from '#/server/og/url-policy.server'
import { CACHE_TTL_OG, CACHE_TTL_OG_ERROR, MAX_PROXY_SIZE_BYTES } from '#/lib/constants'

export interface OGResult {
  url: string
  title: string
  description: string
  image: string
  siteName: string
  type: string
  twitterCard: string
  palette: string[]
  detection: {
    score: number
    label: 'Dynamic' | 'Build-time' | 'Static' | 'Unknown'
    signals: string[]
  }
  fetchedAt: number
  tier: 1 | 2
}

interface OGErrorCacheEntry {
  message: string
  failedAt: number
}

export async function fetchOG(rawUrl: string): Promise<OGResult> {
  const url = normalizeUrl(rawUrl)
  const cacheKey = ogCacheKey(url)
  const errorCacheKey = ogErrorCacheKey(url)

  const cached = await redis.get<OGResult>(cacheKey)
  if (cached) return cached

  const cachedError = await redis.get<OGErrorCacheEntry>(errorCacheKey)
  if (cachedError) throw new Error(cachedError.message)

  try {
    const result = await fetchTier1(url) ?? await fetchTier2(url)
    await redis.set(cacheKey, result, { ex: CACHE_TTL_OG })
    await redis.del(errorCacheKey)
    return result
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : `Failed to fetch OG data for ${url}`

    await redis.set(
      errorCacheKey,
      { message, failedAt: Date.now() },
      { ex: CACHE_TTL_OG_ERROR },
    )
    throw new Error(message)
  }
}

function isHtmlContentType(contentType: string | null): boolean {
  if (!contentType) return true
  return (
    contentType.includes('text/html') ||
    contentType.includes('application/xhtml+xml')
  )
}

async function readTextWithinLimit(
  response: Response,
  maxBytes: number,
): Promise<string> {
  const contentLength = Number(response.headers.get('content-length') ?? '')
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new Error('Upstream HTML exceeded the size limit')
  }

  if (!response.body) return ''

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let totalBytes = 0
  let html = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    totalBytes += value.byteLength
    if (totalBytes > maxBytes) {
      await reader.cancel()
      throw new Error('Upstream HTML exceeded the size limit')
    }

    html += decoder.decode(value, { stream: true })
  }

  html += decoder.decode()
  return html
}

async function fetchTier1(url: string): Promise<OGResult | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; OGInspector/1.0; +https://oginspector.app)',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(8000),
    })

    if (!response.ok || !isHtmlContentType(response.headers.get('content-type'))) {
      return null
    }

    const html = await readTextWithinLimit(response, MAX_PROXY_SIZE_BYTES)
    const headers: Record<string, string> = {}
    response.headers.forEach((v, k) => { headers[k] = v })

    const { result, error } = await ogs({ html })
    const imageUrl =
      result.ogImage?.[0]?.url ??
      (result as { twitterImage?: Array<{ url?: string }> }).twitterImage?.[0]?.url ??
      ''
    if (!imageUrl) return null

    if (error) return null

    let absoluteImage: string
    try {
      absoluteImage = imageUrl.startsWith('http')
        ? imageUrl
        : new URL(imageUrl, url).toString()
      absoluteImage = await assertPublicHttpUrl(absoluteImage)
    } catch {
      return null
    }

    // Fetch image headers for detection
    let imageHeaders: Record<string, string> = {}
    try {
      const imgRes = await fetch(absoluteImage, {
        method: 'HEAD',
        signal: AbortSignal.timeout(3000),
      })
      imgRes.headers.forEach((v, k) => { imageHeaders[k] = v })
    } catch { /* ignore */ }

    const detection = scoreDetection(absoluteImage, {
      ...headers,
      ...imageHeaders,
    })

    return {
      url,
      title: result.ogTitle ?? result.dcTitle ?? '',
      description: result.ogDescription ?? '',
      image: absoluteImage,
      siteName: result.ogSiteName ?? '',
      type: result.ogType ?? 'website',
      twitterCard: result.twitterCard ?? '',
      palette: [],
      detection,
      fetchedAt: Date.now(),
      tier: 1,
    }
  } catch {
    return null
  }
}

async function fetchTier2(url: string): Promise<OGResult> {
  const { data, status } = await mql(url, {
    apiKey: process.env.MICROLINK_API_KEY || undefined,
    palette: true,
    timeout: 12000,
  } as Parameters<typeof mql>[1])

  if (status === 'fail' || !data) {
    throw new Error(`Failed to fetch OG data for ${url}`)
  }

  const imageUrl = (data.image as { url?: string } | undefined)?.url ?? ''
  const palette = ((data as { palette?: Array<{ hex: string }> }).palette ?? [])
    .map((p) => p.hex)
    .slice(0, 6)

  const detection = scoreDetection(imageUrl, {})

  return {
    url,
    title: data.title ?? '',
    description: data.description ?? '',
    image: imageUrl,
    siteName: '',
    type: 'website',
    twitterCard: '',
    palette,
    detection,
    fetchedAt: Date.now(),
    tier: 2,
  }
}
