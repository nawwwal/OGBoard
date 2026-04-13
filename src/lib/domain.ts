const BARE_HOST_INPUT_PATTERN =
  /^(localhost|(?:\d{1,3}\.){3}\d{1,3}|(?:\[[0-9a-f:]+\])|(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,})(?::\d{1,5})?(?:[/?#].*)?$/i

function hasScheme(value: string): boolean {
  return /^[a-z][a-z\d+.-]*:/i.test(value)
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
