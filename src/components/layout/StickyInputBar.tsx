import { useState, useRef, forwardRef, useImperativeHandle } from 'react'
import { isValidUrl, normalizeUserInputUrl, parseUrlList } from '#/lib/domain'
import type { BulkProgress } from '#/hooks/useBulkOGFetch'

interface Props {
  onFetch: (urls: string[]) => void | Promise<void>
  progress?: BulkProgress
  disabled?: boolean
  placeholder?: string
}

export interface StickyInputBarRef {
  focus: () => void
}

const StickyInputBar = forwardRef<StickyInputBarRef, Props>(function StickyInputBar(
  { onFetch, progress, disabled = false, placeholder },
  ref,
) {
  const [value, setValue] = useState('')
  const [isBulk, setIsBulk] = useState(false)
  const singleRef = useRef<HTMLInputElement>(null)
  const bulkRef = useRef<HTMLTextAreaElement>(null)

  useImperativeHandle(ref, () => ({
    focus: () => {
      const el = isBulk ? bulkRef.current : singleRef.current
      el?.focus()
      el?.select()
    },
  }), [isBulk])

  const isBusy = !!progress?.inProgress
  const progressPct =
    progress && progress.total > 0
      ? Math.round(((progress.completed + progress.failed) / progress.total) * 100)
      : 0

  function handleChange(val: string) {
    setValue(val)
    if (!isBulk && val.includes('\n')) setIsBulk(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const urls = isBulk
      ? parseUrlList(value)
      : (() => {
          const normalized = normalizeUserInputUrl(value)
          return normalized && isValidUrl(normalized) ? [normalized] : []
        })()
    if (urls.length === 0) return
    onFetch(urls)
    setValue('')
    setIsBulk(false)
  }

  return (
    <div
      className="sticky z-40"
      style={{
        top: '48px',
        backgroundColor: 'oklch(95% 0.012 75)',
        borderBottom: '1px solid oklch(86% 0.012 70)',
      }}
    >
      <form onSubmit={handleSubmit} className="mx-auto flex max-w-6xl gap-2 items-start px-5 py-3">
        <div className="relative flex-1 min-w-0">
          {isBulk ? (
            <textarea
              ref={bulkRef}
              value={value}
              onChange={(e) => handleChange(e.target.value)}
              placeholder={placeholder ?? 'Paste URLs, one per line — up to 50'}
              rows={3}
              className="w-full resize-none rounded"
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '14px',
                fontWeight: 400,
                color: 'oklch(18% 0.020 55)',
                backgroundColor: 'oklch(99% 0.008 70)',
                border: '1px solid oklch(82% 0.016 68)',
                padding: '10px 14px',
                outline: 'none',
                transition: 'border-color 140ms ease',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'oklch(50% 0.19 55)')}
              onBlur={(e) => (e.target.style.borderColor = 'oklch(82% 0.016 68)')}
              disabled={isBusy || disabled}
            />
          ) : (
            <input
              ref={singleRef}
              type="text"
              inputMode="url"
              value={value}
              onChange={(e) => handleChange(e.target.value)}
              placeholder={placeholder ?? 'Paste a URL — inspect its OG image'}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="w-full rounded"
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '14px',
                fontWeight: 400,
                height: '40px',
                color: 'oklch(18% 0.020 55)',
                backgroundColor: 'oklch(99% 0.008 70)',
                border: '1px solid oklch(82% 0.016 68)',
                padding: '0 14px',
                outline: 'none',
                transition: 'border-color 140ms ease',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'oklch(50% 0.19 55)')}
              onBlur={(e) => (e.target.style.borderColor = 'oklch(82% 0.016 68)')}
              disabled={isBusy || disabled}
            />
          )}

          {/* ⌘K hint — shown when input is empty and not in bulk mode */}
          {!isBulk && !value && (
            <div
              className="absolute inset-y-0 right-0 flex items-center pointer-events-none"
              style={{ paddingRight: '10px' }}
            >
              <kbd style={{
                fontSize: '10px',
                padding: '2px 5px',
                borderRadius: '3px',
                backgroundColor: 'oklch(93% 0.010 72)',
                border: '1px solid oklch(84% 0.012 70)',
                color: 'oklch(56% 0.016 68)',
                fontFamily: 'var(--font-sans)',
                lineHeight: 1.4,
                letterSpacing: 0,
              }}>
                ⌘K
              </kbd>
            </div>
          )}

          {/* Progress bar */}
          {isBusy && progress && (
            <div
              className="absolute bottom-0 left-0 h-0.5 rounded transition-all duration-300"
              style={{ width: `${progressPct}%`, backgroundColor: 'oklch(50% 0.19 55)' }}
            />
          )}
        </div>

        {/* Bulk toggle */}
        <button
          type="button"
          onClick={() => setIsBulk((b) => !b)}
          className="rounded font-semibold tracking-[0.12em] uppercase"
          style={{
            fontSize: '10px',
            height: '40px',
            padding: '0 16px',
            border: `1px solid ${isBulk ? 'oklch(50% 0.19 55)' : 'oklch(82% 0.016 68)'}`,
            color: isBulk ? 'oklch(50% 0.19 55)' : 'oklch(44% 0.016 65)',
            backgroundColor: isBulk ? 'oklch(92% 0.06 75)' : 'oklch(99% 0.008 70)',
            transition: 'all 140ms ease',
            fontFamily: 'var(--font-sans)',
          }}
        >
          Bulk
        </button>

        {/* Fetch button */}
        <button
          type="submit"
          disabled={isBusy || disabled || !value.trim()}
          className="rounded font-semibold tracking-[0.12em] uppercase"
          style={{
            fontSize: '10px',
            height: '40px',
            padding: '0 20px',
            backgroundColor: 'oklch(50% 0.19 55)',
            color: 'oklch(97% 0.008 75)',
            border: '1px solid oklch(44% 0.17 55)',
            transition: 'background-color 140ms ease, opacity 140ms ease',
            opacity: (isBusy || disabled || !value.trim()) ? 0.4 : 1,
            cursor: (isBusy || disabled || !value.trim()) ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--font-sans)',
          }}
          onMouseEnter={(e) => {
            if (!(isBusy || disabled || !value.trim())) {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'oklch(44% 0.18 55)'
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'oklch(50% 0.19 55)'
          }}
        >
          {isBusy ? `${progress?.completed ?? 0} / ${progress?.total ?? 0}` : 'Fetch'}
        </button>
      </form>
    </div>
  )
})

export default StickyInputBar
