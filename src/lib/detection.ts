export type DetectionLabel = 'Dynamic' | 'Build-time' | 'Static' | 'Unknown'

export interface DetectionResult {
  score: number
  label: DetectionLabel
  signals: string[]
}

export const DETECTION_LABEL_CONFIG: Record<
  DetectionLabel,
  { color: string; bg: string; dot: string }
> = {
  Dynamic: {
    color: 'text-emerald-400',
    bg: 'bg-emerald-950/60 border-emerald-800/50',
    dot: 'bg-emerald-400',
  },
  'Build-time': {
    color: 'text-amber-400',
    bg: 'bg-amber-950/60 border-amber-800/50',
    dot: 'bg-amber-400',
  },
  Static: {
    color: 'text-sky-400',
    bg: 'bg-sky-950/60 border-sky-800/50',
    dot: 'bg-sky-400',
  },
  Unknown: {
    color: 'text-zinc-400',
    bg: 'bg-zinc-900/60 border-zinc-700/50',
    dot: 'bg-zinc-500',
  },
}

export function labelFromScore(score: number): DetectionLabel {
  if (score >= 50) return 'Dynamic'
  if (score >= 30) return 'Build-time'
  if (score > 0) return 'Static'
  return 'Unknown'
}
