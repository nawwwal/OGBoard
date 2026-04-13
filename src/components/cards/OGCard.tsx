import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ogQueryOptions } from '#/queries/og.queries'
import { extractDomain, getFaviconUrl } from '#/lib/domain'
import DetectionBadge from '#/components/cards/DetectionBadge'
import OGCardSkeleton from '#/components/cards/OGCardSkeleton'
import type { OGResult } from '#/server/og/scrape.server'

interface Props {
  url: string
  tags?: string[]
  onSelect?: () => void
  isSelected?: boolean
  showTags?: boolean
  snapshotData?: OGResult | null
}

export default function OGCard({
  url,
  tags = [],
  onSelect,
  isSelected = false,
  showTags = false,
  snapshotData = null,
}: Props) {
  const hasSnapshot = !!snapshotData
  const query = useQuery({
    ...ogQueryOptions(url),
    enabled: !hasSnapshot,
  })
  const [imgError, setImgError] = useState(false)
  const data = snapshotData ?? query.data
  const status = hasSnapshot ? 'success' : query.status

  if (status === 'pending') return <OGCardSkeleton />
  if (status === 'error' || !data) return <OGCardError url={url} />

  const domain = extractDomain(data.url)
  const faviconUrl = getFaviconUrl(data.url)

  return (
    <div
      className="break-inside-avoid overflow-hidden cursor-pointer card-in"
      style={{
        backgroundColor: 'oklch(99% 0.008 70)',
        border: isSelected
          ? '1px solid oklch(50% 0.19 55)'
          : '1px solid oklch(88% 0.010 68)',
        borderRadius: '3px',
        transition: 'border-color 140ms ease, background-color 140ms ease, box-shadow 140ms ease',
        boxShadow: isSelected
          ? '0 0 0 3px oklch(50% 0.19 55 / 0.15)'
          : '0 1px 3px oklch(0% 0 0 / 0.06)',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          (e.currentTarget as HTMLElement).style.borderColor = 'oklch(78% 0.016 68)'
          ;(e.currentTarget as HTMLElement).style.backgroundColor = 'oklch(97% 0.010 72)'
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          (e.currentTarget as HTMLElement).style.borderColor = 'oklch(88% 0.010 68)'
          ;(e.currentTarget as HTMLElement).style.backgroundColor = 'oklch(99% 0.008 70)'
        }
      }}
      onClick={() => onSelect?.()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect?.()}
    >
      {/* OG Image — the primary content */}
      <div
        className="relative overflow-hidden"
        style={{
          aspectRatio: '1.91 / 1',
          backgroundColor: 'oklch(93% 0.012 72)',
        }}
      >
        {data.image && !imgError ? (
          <img
            src={data.image}
            alt={data.title || domain}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1.5">
            <span
              className="text-[10px] font-semibold tracking-[0.16em] uppercase"
              style={{ color: 'oklch(64% 0.014 68)', fontFamily: 'var(--font-sans)' }}
            >
              No image
            </span>
          </div>
        )}

        {/* Palette strip — thin, at bottom of image */}
        {data.palette.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 flex" style={{ height: '3px' }}>
            {data.palette.slice(0, 6).map((hex) => (
              <span key={hex} className="flex-1" style={{ backgroundColor: hex }} />
            ))}
          </div>
        )}
      </div>

      {/* Archival label area */}
      <div className="px-3 pt-2.5 pb-3">
        {/* Domain row */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            {faviconUrl && (
              <img
                src={faviconUrl}
                alt=""
                className="flex-shrink-0 rounded-sm"
                style={{ width: '12px', height: '12px', opacity: 0.6 }}
                loading="lazy"
              />
            )}
            <span
              className="truncate font-semibold tracking-[0.12em] uppercase"
              style={{
                fontSize: '9px',
                color: 'oklch(56% 0.016 68)',
                fontFamily: 'var(--font-sans)',
              }}
            >
              {domain}
            </span>
          </div>
          <DetectionBadge label={data.detection.label} size="xs" />
        </div>

        {/* Title */}
        {data.title && (
          <p
            className="leading-snug line-clamp-2"
            style={{
              fontSize: '13px',
              fontWeight: 500,
              color: 'oklch(22% 0.020 60)',
              fontFamily: 'var(--font-sans)',
              lineHeight: 1.4,
            }}
          >
            {data.title}
          </p>
        )}

        {/* Tags */}
        {showTags && tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded font-semibold tracking-[0.10em] uppercase"
                style={{
                  fontSize: '9px',
                  color: 'oklch(50% 0.016 68)',
                  border: '1px solid oklch(84% 0.012 70)',
                  backgroundColor: 'oklch(93% 0.010 72)',
                  padding: '1px 6px',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function OGCardError({ url }: { url: string }) {
  return (
    <div
      className="break-inside-avoid p-3"
      style={{
        border: '1px solid oklch(80% 0.06 30)',
        backgroundColor: 'oklch(95% 0.03 30)',
        borderRadius: '3px',
      }}
    >
      <p
        className="font-semibold tracking-[0.10em] uppercase truncate"
        style={{ fontSize: '9px', color: 'oklch(44% 0.10 25)' }}
      >
        Failed
      </p>
      <p
        className="mt-1 font-mono truncate"
        style={{ fontSize: '10px', color: 'oklch(56% 0.016 68)' }}
      >
        {url}
      </p>
    </div>
  )
}
