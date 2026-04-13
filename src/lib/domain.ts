const BARE_HOST_INPUT_PATTERN =
  /^(localhost|(?:\d{1,3}\.){3}\d{1,3}|(?:\[[0-9a-f:]+\])|(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,})(?::\d{1,5})?(?:[/?#].*)?$/i

const TRACKING_PARAM_PREFIXES = ['utm_']

const TRACKING_PARAM_NAMES = new Set([
  '_ga',
  '_gl',
  'fbclid',
  'gclid',
  'dclid',
  'gbraid',
  'wbraid',
  'msclkid',
  'mc_cid',
  'mc_eid',
  'mkt_tok',
  'igshid',
  'si',
  'spm',
  'vero_conv',
  'vero_id',
  'wickedid',
  'yclid',
  '_hsenc',
  '_hsmi',
  'hsctatracking',
])

function hasScheme(value: string): boolean {
  return /^[a-z][a-z\d+.-]*:/i.test(value)
}

function isTrackingParam(name: string): boolean {
  const normalized = name.toLowerCase()
  return (
    TRACKING_PARAM_NAMES.has(normalized) ||
    TRACKING_PARAM_PREFIXES.some((prefix) => normalized.startsWith(prefix))
  )
}

function normalizeSearchParams(url: URL) {
  const entries = [...url.searchParams.entries()]
    .filter(([name]) => !isTrackingParam(name))
    .sort(([leftName, leftValue], [rightName, rightValue]) => {
      if (leftName === rightName) return leftValue.localeCompare(rightValue)
      return leftName.localeCompare(rightName)
    })

  url.search = ''
  for (const [name, value] of entries) {
    url.searchParams.append(name, value)
  }
}

export function normalizeUserInputUrl(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''

  const candidate =
    hasScheme(trimmed) || !BARE_HOST_INPUT_PATTERN.test(trimmed)
      ? trimmed
      : `https://${trimmed}`

  return normalizeUrl(candidate)
}

export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url)
    // strip trailing slash from pathname except root
    if (u.pathname !== '/') u.pathname = u.pathname.replace(/\/+$/, '')
    // lowercase scheme and host
    u.protocol = u.protocol.toLowerCase()
    u.hostname = u.hostname.toLowerCase()
    // fragments do not affect the fetched page or OG metadata
    u.hash = ''
    // canonicalize query params for dedupe and search
    normalizeSearchParams(u)
    // drop default ports so equivalent URLs dedupe cleanly
    if ((u.protocol === 'https:' && u.port === '443') || (u.protocol === 'http:' && u.port === '80')) {
      u.port = ''
    }
    return u.toString()
  } catch {
    return url.trim()
  }
}

export function getFaviconUrl(url: string): string {
  try {
    const { origin } = new URL(url)
    return `https://www.google.com/s2/favicons?sz=32&domain=${origin}`
  } catch {
    return ''
  }
}

export function isValidUrl(str: string): boolean {
  try {
    const u = new URL(normalizeUserInputUrl(str))
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export function parseUrlList(raw: string): string[] {
  const seen = new Set<string>()

  return raw
    .split(/[\n,]+/)
    .map((s) => normalizeUserInputUrl(s))
    .filter((s) => s.length > 0 && isValidUrl(s))
    .filter((s) => {
      if (seen.has(s)) return false
      seen.add(s)
      return true
    })
    .slice(0, 50)
}
