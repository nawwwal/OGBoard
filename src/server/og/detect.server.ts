import type { DetectionResult } from '#/lib/detection'
import { labelFromScore } from '#/lib/detection'

const DYNAMIC_DOMAINS = new Set([
  'opengraph.githubassets.com',
  'ogcdn.net',
  'og.twitter.com',
  'og.reddit.com',
  'open.githubassets.com',
])

const DYNAMIC_DOMAIN_PATTERNS = [
  /res\.cloudinary\.com/,
  /\.imgix\.net/,
  /vercel\.com\/og/,
  /og\.supabase\.co/,
  /og\.railway\.app/,
]

const API_ROUTE_PATTERNS = [
  /\/api\/og[-_]?(?:image)?(?:\/|$|\?)/i,
  /\/opengraph-image(?:\/|$|\?)/i,
  /\/_vercel\/og/i,
  /\/\.netlify\/functions\//i,
  /\/og\.(?:png|jpeg|jpg|webp)\?/i,
]

const CDN_TRANSFORM_PATTERNS = [
  /res\.cloudinary\.com\/[^/]+\/image\/upload\//,
  /\.imgix\.net\/.*\?.*(?:w|h|txt|mark64|blend)=/,
  /\?w=\d+&h=\d+/,
  /c_fill,/,
  /fl_progressive/,
]

const DYNAMIC_PARAM_PATTERNS = [
  /[?&]title=/i,
  /[?&]text=/i,
  /[?&]theme=/i,
  /[?&]description=/i,
]

const HASH_SEGMENT_PATTERN =
  /\/[0-9a-f]{16,64}(?:\/|$)/i

const STATIC_PATH_PATTERNS = [
  /\/images\/[^?#]+\.(?:png|jpe?g|webp|gif)/i,
  /\/wp-content\/uploads\//i,
  /\/assets\/[^?#]+\.(?:png|jpe?g|webp|gif)/i,
  /\/static\/[^?#]+\.(?:png|jpe?g|webp|gif)/i,
  /\/public\/[^?#]+\.(?:png|jpe?g|webp|gif)/i,
]

const STATIC_SERVER_PATTERNS = [
  /AmazonS3/i,
  /nginx/i,
  /Apache/i,
]

export function scoreDetection(
  imageUrl: string,
  headers: Record<string, string>,
): DetectionResult {
  let score = 0
  const signals: string[] = []

  // Known dynamic domain → +40
  try {
    const { hostname } = new URL(imageUrl)
    if (DYNAMIC_DOMAINS.has(hostname)) {
      score += 40
      signals.push('Known dynamic OG domain')
    } else if (DYNAMIC_DOMAIN_PATTERNS.some((p) => p.test(imageUrl))) {
      score += 40
      signals.push('Known dynamic OG service')
    }
  } catch { /* invalid URL */ }

  // API route pattern → +35
  if (API_ROUTE_PATTERNS.some((p) => p.test(imageUrl))) {
    score += 35
    signals.push('API route pattern (/api/og, /opengraph-image)')
  }

  // CDN transform params → +30
  if (CDN_TRANSFORM_PATTERNS.some((p) => p.test(imageUrl))) {
    score += 30
    signals.push('CDN transform parameters detected')
  }

  // Dynamic query params on image URL → +25
  if (DYNAMIC_PARAM_PATTERNS.some((p) => p.test(imageUrl))) {
    score += 25
    signals.push('Parameterized image URL (title=, text=, theme=)')
  }

  // Content-addressable hash segment → +20
  if (HASH_SEGMENT_PATTERN.test(imageUrl)) {
    score += 20
    signals.push('Content-addressable hash in URL')
  }

  // Vercel OG header fingerprint → +35
  const cacheControl = headers['cache-control'] ?? ''
  if (
    cacheControl.includes('immutable') &&
    cacheControl.includes('max-age=31536000')
  ) {
    score += 35
    signals.push('Vercel OG Cache-Control fingerprint')
  }

  // Cloudinary server header → +20
  const server = headers['server'] ?? ''
  if (server.toLowerCase().includes('cloudinary')) {
    score += 20
    signals.push('Cloudinary server header')
  }

  // Vercel edge cache → +15
  const vercelCache = headers['x-vercel-cache'] ?? ''
  if (vercelCache) {
    score += 15
    signals.push('Vercel edge cache header')
  }

  // Static file path → -20
  if (STATIC_PATH_PATTERNS.some((p) => p.test(imageUrl))) {
    score -= 20
    signals.push('Static file path pattern')
  }

  // Static CDN server → -10
  if (STATIC_SERVER_PATTERNS.some((p) => p.test(server))) {
    score -= 10
    signals.push('Static CDN server header')
  }

  score = Math.max(0, Math.min(100, score))
  return { score, label: labelFromScore(score), signals }
}
