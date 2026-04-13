import { useEffect, useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ogQueryOptions } from '#/queries/og.queries'
import { extractDomain, getFaviconUrl } from '#/lib/domain'
import DetectionBadge from '#/components/cards/DetectionBadge'
import type { OGResult } from '#/server/og/scrape.server'

// CDN/format params that don't represent dynamic content
const CDN_SIZING = new Set([
  'w', 'h', 'q', 'f', 'fit', 'auto', 'dpr', 'fm', 'cs', 'bg', 'crop',
  'gravity', 'quality', 'format', 'width', 'height', 'ar', 'trim', 'dl',
])

// ── Copy utilities ───────────────────────────────────────────────
function useCopy() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const copy = useCallback((text: string, key: string) => {
    navigator.clipboard.writeText(text)
      .then(() => { setCopiedKey(key); setTimeout(() => setCopiedKey(null), 1400) })
      .catch(() => {})
  }, [])
  return { copy, copiedKey }
}

async function copyImageBinary(src: string): Promise<'image' | 'url'> {
  try {
    const res = await fetch(src)
    const blob = await res.blob()
    if (blob.type.startsWith('image/')) {
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
      return 'image'
    }
  } catch { /* CORS or unsupported — fall through */ }
  await navigator.clipboard.writeText(src).catch(() => {})
  return 'url'
}

// ── Root component ───────────────────────────────────────────────
interface Props {
  url: string | null
  onClose: () => void
  snapshotData?: OGResult | null
}

export default function DetailDrawer({ url, onClose, snapshotData = null }: Props) {
  useEffect(() => {
    if (!url) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [url, onClose])

  if (!url) return null

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        style={{ backgroundColor: 'oklch(18% 0.020 55 / 0.18)' }}
        onClick={onClose}
      />
      <aside
        className="fixed inset-y-0 right-0 z-50 w-full max-w-sm flex flex-col overflow-y-auto"
        style={{
          backgroundColor: 'oklch(99% 0.008 70)',
          borderLeft: '1px solid oklch(86% 0.012 70)',
          boxShadow: '-4px 0 28px oklch(0% 0 0 / 0.07)',
        }}
      >
        <DrawerContent url={url} onClose={onClose} snapshotData={snapshotData} />
      </aside>
    </>
  )
}

// ── Drawer body ──────────────────────────────────────────────────
function DrawerContent({ url, onClose, snapshotData = null }: {
  url: string
  onClose: () => void
  snapshotData?: OGResult | null
}) {
  const hasSnapshot = !!snapshotData
  const query = useQuery({ ...ogQueryOptions(url), enabled: !hasSnapshot })
  const data = snapshotData ?? query.data
  const status = hasSnapshot ? 'success' : query.status
  const domain = extractDomain(url)
  const favicon = getFaviconUrl(url)
  const { copy, copiedKey } = useCopy()
  const [imgCopyState, setImgCopyState] = useState<'idle' | 'copying' | 'done-image' | 'done-url'>('idle')

  // Ctrl/Cmd+C with no text selection → copy the OG image
  useEffect(() => {
    if (!data?.image) return
    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key !== 'c') return
      if ((window.getSelection()?.toString() ?? '').length > 0) return
      e.preventDefault()
      setImgCopyState('copying')
      copyImageBinary(data.image).then((kind) => {
        setImgCopyState(kind === 'image' ? 'done-image' : 'done-url')
        setTimeout(() => setImgCopyState('idle'), 1400)
      })
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [data?.image])

  return (
    <>
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-3 shrink-0"
        style={{ borderBottom: '1px solid oklch(88% 0.010 70)' }}
      >
        {favicon && (
          <img src={favicon} alt="" className="h-4 w-4 rounded-sm shrink-0" style={{ opacity: 0.6 }} />
        )}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 font-mono truncate"
          style={{ fontSize: '11px', color: 'oklch(44% 0.016 68)' }}
          title={url}
        >
          {domain}
        </a>
        <button
          onClick={onClose}
          className="shrink-0 rounded font-mono"
          style={{
            padding: '2px 7px',
            fontSize: '10px',
            color: 'oklch(60% 0.014 68)',
            border: '1px solid oklch(86% 0.012 70)',
            background: 'transparent',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'oklch(93% 0.010 72)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          esc
        </button>
      </div>

      {status === 'pending' && (
        <div className="flex-1 flex items-center justify-center">
          <span className="animate-pulse font-mono" style={{ fontSize: '11px', color: 'oklch(62% 0.014 68)' }}>
            Fetching…
          </span>
        </div>
      )}

      {status === 'error' && (
        <div className="flex-1 flex items-center justify-center px-6 text-center">
          <p style={{ fontSize: '13px', color: 'oklch(44% 0.10 25)' }}>Failed to load metadata</p>
        </div>
      )}

      {status === 'success' && data && (
        <div>
          {/* OG image with copy overlay */}
          {data.image && (
            <ImagePreview
              src={data.image}
              alt={data.title}
              copyState={imgCopyState}
              onCopy={() => {
                setImgCopyState('copying')
                copyImageBinary(data.image).then((kind) => {
                  setImgCopyState(kind === 'image' ? 'done-image' : 'done-url')
                  setTimeout(() => setImgCopyState('idle'), 1400)
                })
              }}
            />
          )}

          {/* Detection */}
          <Section label="Detection">
            <div className="flex flex-wrap gap-1.5">
              <DetectionBadge label={data.detection.label} score={data.detection.score} />
              {data.detection.signals.map((s) => (
                <span
                  key={s}
                  className="rounded font-mono"
                  style={{
                    fontSize: '10px',
                    padding: '1px 7px',
                    lineHeight: '1.7',
                    color: 'oklch(46% 0.014 68)',
                    border: '1px solid oklch(86% 0.012 70)',
                    backgroundColor: 'oklch(95% 0.008 72)',
                  }}
                >
                  {s}
                </span>
              ))}
            </div>
          </Section>

          {/* Palette */}
          {data.palette.length > 0 && (
            <Section label="Palette">
              <div className="flex gap-2 flex-wrap">
                {data.palette.map((hex) => (
                  <button
                    key={hex}
                    title={`Copy ${hex}`}
                    onClick={() => copy(hex, `pal-${hex}`)}
                    className="group relative rounded"
                    style={{
                      width: '32px',
                      height: '32px',
                      backgroundColor: hex,
                      border: '1px solid oklch(82% 0.012 70 / 0.4)',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    <span
                      className="absolute inset-0 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 font-mono"
                      style={{ fontSize: '8px', backgroundColor: 'oklch(0% 0 0 / 0.5)', color: '#fff' }}
                    >
                      {copiedKey === `pal-${hex}` ? '✓' : hex.slice(1)}
                    </span>
                  </button>
                ))}
              </div>
            </Section>
          )}

          {/* Info fields */}
          <Section label="Info">
            <div className="space-y-4">
              <InfoField label="Title" techKey="og:title" value={data.title} copy={copy} copiedKey={copiedKey} />
              <InfoField label="Description" techKey="og:description" value={data.description} copy={copy} copiedKey={copiedKey} />
              <InfoField label="Site name" techKey="og:site_name" value={data.siteName} copy={copy} copiedKey={copiedKey} />
              <InfoField label="Content type" techKey="og:type" value={data.type} copy={copy} copiedKey={copiedKey} />
              <InfoField label="Twitter card" techKey="twitter:card" value={data.twitterCard} copy={copy} copiedKey={copiedKey} />
            </div>
          </Section>

          {/* URLs */}
          <Section label="URLs">
            <div className="space-y-4">
              <UrlField label="OG image" value={data.image} copy={copy} copiedKey={copiedKey} fieldKey="url-image" />
              <UrlField label="Page URL" value={data.url} copy={copy} copiedKey={copiedKey} fieldKey="url-page" />
            </div>
          </Section>

          {/* Dynamic image lab */}
          {data.detection.label === 'Dynamic' && data.image && (
            <Section label="Dynamic image lab">
              <DynamicImageLab
                imageUrl={data.image}
                signals={data.detection.signals}
              />
            </Section>
          )}

          {/* Platform previews */}
          <Section label="Platform previews" last>
            <div className="space-y-4">
              <PlatformPreview title="X / Twitter">
                <TwitterCard data={data} />
              </PlatformPreview>
              <PlatformPreview title="Slack">
                <SlackUnfurl data={data} />
              </PlatformPreview>
            </div>
          </Section>
        </div>
      )}
    </>
  )
}

// ── Sub-components ───────────────────────────────────────────────

function Section({ label, children, last = false }: {
  label: string
  children: React.ReactNode
  last?: boolean
}) {
  return (
    <div
      className="px-4 py-4"
      style={{ borderBottom: last ? 'none' : '1px solid oklch(90% 0.010 70)' }}
    >
      <p
        className="font-semibold tracking-[0.14em] uppercase mb-3"
        style={{ fontSize: '9px', color: 'oklch(60% 0.014 68)', fontFamily: 'var(--font-sans)' }}
      >
        {label}
      </p>
      {children}
    </div>
  )
}

function ImagePreview({ src, alt, copyState, onCopy }: {
  src: string
  alt: string
  copyState: 'idle' | 'copying' | 'done-image' | 'done-url'
  onCopy: () => void
}) {
  const label = copyState === 'copying'
    ? 'Copying…'
    : copyState === 'done-image'
    ? '✓ Image copied'
    : copyState === 'done-url'
    ? '✓ URL copied'
    : 'Copy image'

  return (
    <div
      className="relative group"
      style={{ aspectRatio: '1.91 / 1', overflow: 'hidden', backgroundColor: 'oklch(93% 0.012 72)' }}
    >
      <img src={src} alt={alt} className="w-full h-full object-cover" />

      <div
        className="absolute inset-0 flex items-end justify-between p-3 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: 'linear-gradient(to top, oklch(0% 0 0 / 0.45) 0%, transparent 60%)' }}
      >
        <button
          onClick={onCopy}
          className="rounded font-semibold tracking-[0.10em] uppercase"
          style={{
            fontSize: '10px',
            padding: '6px 14px',
            backgroundColor: 'oklch(99% 0.008 70)',
            color: 'oklch(22% 0.020 58)',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
            transition: 'opacity 140ms ease',
          }}
        >
          {label}
        </button>

        <span
          className="font-mono rounded"
          style={{
            fontSize: '9px',
            padding: '3px 6px',
            backgroundColor: 'oklch(0% 0 0 / 0.45)',
            color: 'oklch(88% 0 0)',
          }}
        >
          ⌘C
        </span>
      </div>
    </div>
  )
}

function InfoField({ label, techKey, value, copy, copiedKey }: {
  label: string
  techKey: string
  value: string
  copy: (text: string, key: string) => void
  copiedKey: string | null
}) {
  if (!value) return null
  const key = `info-${techKey}`
  const isCopied = copiedKey === key

  return (
    <div className="group flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="font-semibold" style={{ fontSize: '12px', color: 'oklch(26% 0.020 58)', fontFamily: 'var(--font-sans)' }}>
            {label}
          </span>
          <span className="font-mono" style={{ fontSize: '9px', color: 'oklch(66% 0.014 68)' }}>
            {techKey}
          </span>
        </div>
        <p style={{ fontSize: '13px', color: 'oklch(32% 0.018 60)', lineHeight: 1.5, fontFamily: 'var(--font-sans)' }}>
          {value}
        </p>
      </div>

      <button
        onClick={() => copy(value, key)}
        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity rounded"
        style={{
          marginTop: '1px',
          padding: '3px 8px',
          fontSize: '9px',
          fontFamily: 'var(--font-sans)',
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          color: isCopied ? 'oklch(36% 0.12 155)' : 'oklch(52% 0.014 68)',
          border: `1px solid ${isCopied ? 'oklch(62% 0.10 155)' : 'oklch(84% 0.012 70)'}`,
          backgroundColor: isCopied ? 'oklch(93% 0.05 155)' : 'oklch(97% 0.008 72)',
          transition: 'all 140ms ease',
        }}
      >
        {isCopied ? '✓' : 'copy'}
      </button>
    </div>
  )
}

function UrlField({ label, value, copy, copiedKey, fieldKey }: {
  label: string
  value: string
  copy: (text: string, key: string) => void
  copiedKey: string | null
  fieldKey: string
}) {
  if (!value) return null
  const isCopied = copiedKey === fieldKey

  return (
    <div className="group">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="font-semibold" style={{ fontSize: '12px', color: 'oklch(26% 0.020 58)', fontFamily: 'var(--font-sans)' }}>
          {label}
        </span>
        <button
          onClick={() => copy(value, fieldKey)}
          className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity rounded"
          style={{
            padding: '2px 7px',
            fontSize: '9px',
            fontFamily: 'var(--font-sans)',
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            color: isCopied ? 'oklch(36% 0.12 155)' : 'oklch(52% 0.014 68)',
            border: `1px solid ${isCopied ? 'oklch(62% 0.10 155)' : 'oklch(84% 0.012 70)'}`,
            backgroundColor: isCopied ? 'oklch(93% 0.05 155)' : 'oklch(97% 0.008 72)',
            transition: 'all 140ms ease',
          }}
        >
          {isCopied ? '✓ copied' : 'copy'}
        </button>
      </div>
      <p className="font-mono truncate" style={{ fontSize: '10px', color: 'oklch(48% 0.014 68)' }} title={value}>
        {value}
      </p>
    </div>
  )
}

function DynamicImageLab({
  imageUrl,
  signals,
}: {
  imageUrl: string
  signals: string[]
}) {
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
  const [previewKey, setPreviewKey] = useState(0)

  let parsed: URL | null = null
  try { parsed = new URL(imageUrl) } catch { /* ignore malformed */ }

  const editableParams = parsed
    ? [...parsed.searchParams.entries()].filter(([k]) => !CDN_SIZING.has(k.toLowerCase()))
    : []

  function buildPreview() {
    if (!parsed) return imageUrl
    const u = new URL(imageUrl)
    for (const [k, v] of Object.entries(overrides)) u.searchParams.set(k, v)
    return u.toString()
  }

  function handlePreview() {
    setPreviewSrc(buildPreview())
    setPreviewKey((n) => n + 1)
  }

  function openImage() {
    window.open(imageUrl, '_blank', 'noopener,noreferrer')
  }

  if (editableParams.length === 0) {
    return (
      <div className="space-y-3">
        <p style={{ fontSize: '12px', color: 'oklch(52% 0.016 68)', lineHeight: 1.55, fontFamily: 'var(--font-sans)' }}>
          This image still looks dynamically generated, but it is not directly editable through query-string text parameters. It is likely generated server-side or from path-based identifiers.
        </p>

        {signals.length > 0 && (
          <ul className="space-y-1">
            {signals.map((signal) => (
              <li
                key={signal}
                className="flex items-start gap-2"
                style={{ fontSize: '11px', color: 'oklch(48% 0.016 66)', fontFamily: 'var(--font-sans)' }}
              >
                <span style={{ color: 'oklch(68% 0.016 68)' }}>•</span>
                <span>{signal}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-2">
          <button
            onClick={openImage}
            className="rounded font-semibold tracking-[0.10em] uppercase"
            style={{
              fontSize: '10px',
              padding: '8px 12px',
              backgroundColor: 'oklch(50% 0.19 55)',
              color: 'oklch(97% 0.008 75)',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'oklch(44% 0.18 55)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'oklch(50% 0.19 55)')}
          >
            Open image URL
          </button>
          <button
            onClick={() => navigator.clipboard.writeText(imageUrl)}
            className="rounded font-semibold tracking-[0.10em] uppercase"
            style={{
              fontSize: '10px',
              padding: '8px 12px',
              backgroundColor: 'oklch(97% 0.008 72)',
              color: 'oklch(32% 0.018 60)',
              border: '1px solid oklch(84% 0.012 70)',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'oklch(94% 0.010 72)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'oklch(97% 0.008 72)')}
          >
            Copy image URL
          </button>
        </div>
      </div>
    )
  }

  const isDirty = Object.keys(overrides).length > 0

  return (
    <div>
      <p className="mb-3" style={{ fontSize: '12px', color: 'oklch(52% 0.016 68)', lineHeight: 1.5, fontFamily: 'var(--font-sans)' }}>
        Edit the parameters below to preview how the image changes. Press Enter or click Preview.
      </p>

      <div className="space-y-3">
        {editableParams.map(([key, defaultVal]) => (
          <div key={key}>
            <label
              className="block font-mono mb-1"
              style={{ fontSize: '10px', color: 'oklch(52% 0.016 68)' }}
            >
              {key}
            </label>
            <input
              value={overrides[key] ?? defaultVal}
              onChange={(e) => setOverrides((p) => ({ ...p, [key]: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && handlePreview()}
              className="w-full rounded"
              style={{
                fontSize: '13px',
                padding: '7px 10px',
                color: 'oklch(22% 0.020 58)',
                backgroundColor: 'oklch(97% 0.008 72)',
                border: '1px solid oklch(84% 0.012 70)',
                fontFamily: 'var(--font-sans)',
                outline: 'none',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'oklch(50% 0.19 55)')}
              onBlur={(e) => (e.target.style.borderColor = 'oklch(84% 0.012 70)')}
            />
          </div>
        ))}
      </div>

      {isDirty && (
        <button
          onClick={handlePreview}
          className="w-full rounded font-semibold tracking-[0.10em] uppercase mt-3"
          style={{
            fontSize: '10px',
            padding: '9px',
            backgroundColor: 'oklch(50% 0.19 55)',
            color: 'oklch(97% 0.008 75)',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'oklch(44% 0.18 55)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'oklch(50% 0.19 55)')}
        >
          Preview
        </button>
      )}

      {previewSrc && (
        <div className="mt-4">
          <p className="font-semibold tracking-[0.14em] uppercase mb-2" style={{ fontSize: '9px', color: 'oklch(60% 0.014 68)' }}>
            Result
          </p>
          <img
            key={previewKey}
            src={previewSrc}
            alt="Preview"
            className="w-full rounded object-cover"
            style={{ aspectRatio: '1.91 / 1', border: '1px solid oklch(86% 0.012 70)' }}
          />
          <p className="font-mono mt-2 break-all" style={{ fontSize: '10px', color: 'oklch(56% 0.014 68)', lineHeight: 1.5 }}>
            {previewSrc}
          </p>
        </div>
      )}
    </div>
  )
}

function PlatformPreview({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-semibold tracking-[0.10em] uppercase mb-1.5" style={{ fontSize: '9px', color: 'oklch(66% 0.014 68)' }}>
        {title}
      </p>
      {children}
    </div>
  )
}

interface PreviewData { image: string; title: string; description: string; url: string }

function TwitterCard({ data }: { data: PreviewData }) {
  const domain = extractDomain(data.url)
  return (
    <div className="overflow-hidden rounded" style={{ border: '1px solid oklch(86% 0.012 70)' }}>
      {data.image && (
        <img src={data.image} alt="" className="w-full object-cover" style={{ aspectRatio: '1.91 / 1' }} />
      )}
      <div className="px-3 py-2.5" style={{ backgroundColor: 'oklch(97% 0.008 72)' }}>
        <p className="font-mono" style={{ fontSize: '10px', color: 'oklch(60% 0.014 68)' }}>{domain}</p>
        <p className="font-semibold line-clamp-1 mt-0.5" style={{ fontSize: '12px', color: 'oklch(22% 0.020 60)' }}>{data.title}</p>
        {data.description && (
          <p className="line-clamp-1 mt-0.5" style={{ fontSize: '11px', color: 'oklch(50% 0.016 66)' }}>{data.description}</p>
        )}
      </div>
    </div>
  )
}

function SlackUnfurl({ data }: { data: PreviewData }) {
  const domain = extractDomain(data.url)
  return (
    <div
      className="px-3 py-2.5 rounded"
      style={{
        backgroundColor: 'oklch(97% 0.008 72)',
        border: '1px solid oklch(86% 0.012 70)',
        borderLeft: '3px solid #611f69',
      }}
    >
      <p className="font-semibold" style={{ fontSize: '11px', color: '#611f69' }}>{domain}</p>
      <p className="font-semibold line-clamp-1 mt-0.5" style={{ fontSize: '12px', color: 'oklch(22% 0.020 60)' }}>{data.title}</p>
      {data.description && (
        <p className="line-clamp-2 mt-0.5" style={{ fontSize: '11px', color: 'oklch(50% 0.016 66)' }}>{data.description}</p>
      )}
      {data.image && (
        <img src={data.image} alt="" className="mt-2 rounded w-full" style={{ aspectRatio: '1.91 / 1', objectFit: 'cover' }} />
      )}
    </div>
  )
}
