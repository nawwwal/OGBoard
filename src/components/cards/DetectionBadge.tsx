import type { DetectionLabel } from '#/lib/detection'

interface Props {
  label: DetectionLabel
  score?: number
  signals?: string[]
  size?: 'sm' | 'xs'
}

const CONFIG: Record<DetectionLabel, { symbol: string; color: string; borderColor: string; bgColor: string }> = {
  Dynamic: {
    symbol: '↺',
    color: 'oklch(40% 0.17 60)',        // deep amber-brown
    borderColor: 'oklch(72% 0.14 72)',
    bgColor: 'oklch(93% 0.07 78)',
  },
  'Build-time': {
    symbol: '◈',
    color: 'oklch(34% 0.11 200)',       // deep teal
    borderColor: 'oklch(66% 0.10 200)',
    bgColor: 'oklch(93% 0.05 200)',
  },
  Static: {
    symbol: '○',
    color: 'oklch(34% 0.09 240)',       // deep blue
    borderColor: 'oklch(64% 0.08 240)',
    bgColor: 'oklch(93% 0.04 240)',
  },
  Unknown: {
    symbol: '–',
    color: 'oklch(50% 0.014 68)',
    borderColor: 'oklch(78% 0.012 68)',
    bgColor: 'oklch(93% 0.008 70)',
  },
}

export default function DetectionBadge({ label, score, signals, size = 'sm' }: Props) {
  const cfg = CONFIG[label]
  const isXs = size === 'xs'

  return (
    <span
      className="inline-flex items-center gap-1 rounded font-semibold tracking-[0.10em] uppercase"
      style={{
        fontSize: isXs ? '9px' : '10px',
        color: cfg.color,
        border: `1px solid ${cfg.borderColor}`,
        backgroundColor: cfg.bgColor,
        padding: isXs ? '1px 6px' : '2px 7px',
        letterSpacing: '0.10em',
      }}
      title={signals?.join(' · ')}
    >
      <span style={{ fontSize: isXs ? '10px' : '11px', lineHeight: 1 }}>{cfg.symbol}</span>
      {label}
      {score !== undefined && (
        <span style={{ opacity: 0.5, fontSize: isXs ? '8px' : '9px' }}>{score}</span>
      )}
    </span>
  )
}
