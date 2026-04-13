export default function OGCardSkeleton() {
  return (
    <div
      className="break-inside-avoid overflow-hidden"
      style={{
        backgroundColor: 'oklch(16% 0.020 58)',
        border: '1px solid oklch(23% 0.018 58)',
        borderRadius: '3px',
      }}
    >
      {/* Image placeholder */}
      <div
        className="shimmer"
        style={{ aspectRatio: '1.91 / 1', width: '100%' }}
      />
      {/* Label area */}
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="shimmer h-2.5 w-20 rounded" />
          <div className="shimmer h-4 w-14 rounded" />
        </div>
        <div className="shimmer h-3 w-full rounded" />
        <div className="shimmer h-3 w-3/5 rounded" />
      </div>
    </div>
  )
}
