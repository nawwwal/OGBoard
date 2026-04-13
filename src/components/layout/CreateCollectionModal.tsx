import { useState, useRef, useEffect } from 'react'
import { CHIP_COLORS } from '#/hooks/useLocalCollections'

interface Props {
  onConfirm: (name: string, color: string) => void
  onCancel: () => void
  initialColorIndex?: number
}

export default function CreateCollectionModal({ onConfirm, onCancel, initialColorIndex = 0 }: Props) {
  const [name, setName] = useState('')
  const [selectedColor, setSelectedColor] = useState(CHIP_COLORS[initialColorIndex % CHIP_COLORS.length])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onConfirm(trimmed, selectedColor)
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50"
        style={{ backgroundColor: 'oklch(18% 0.020 55 / 0.3)' }}
        onClick={onCancel}
      />

      <div
        className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full"
        style={{ maxWidth: '380px', padding: '0 16px' }}
      >
        <div
          className="rounded overflow-hidden"
          style={{
            backgroundColor: 'oklch(99% 0.008 70)',
            border: '1px solid oklch(84% 0.012 70)',
            boxShadow: '0 24px 64px oklch(0% 0 0 / 0.14)',
          }}
        >
          <div className="px-6 py-6">
            <p
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '24px',
                color: 'oklch(20% 0.020 58)',
                lineHeight: 1.2,
                marginBottom: '6px',
              }}
            >
              New collection
            </p>
            <p
              style={{
                fontSize: '13px',
                color: 'oklch(54% 0.016 68)',
                lineHeight: 1.5,
                fontFamily: 'var(--font-sans)',
                marginBottom: '20px',
              }}
            >
              Group related cards. One card can live in multiple collections.
            </p>

            <form onSubmit={handleSubmit}>
              {/* Name input with colored circle prefix */}
              <div className="flex items-center gap-2">
                <span
                  style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: selectedColor,
                    flexShrink: 0,
                    transition: 'background-color 150ms ease',
                  }}
                />
                <input
                  ref={inputRef}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Name your collection"
                  className="flex-1 rounded"
                  style={{
                    fontSize: '14px',
                    padding: '10px 14px',
                    color: 'oklch(18% 0.020 55)',
                    backgroundColor: 'oklch(97% 0.008 72)',
                    border: '1px solid oklch(84% 0.012 70)',
                    fontFamily: 'var(--font-sans)',
                    outline: 'none',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = selectedColor)}
                  onBlur={(e) => (e.target.style.borderColor = 'oklch(84% 0.012 70)')}
                  maxLength={40}
                  onKeyDown={(e) => e.key === 'Escape' && onCancel()}
                />
              </div>

              {/* Color swatches */}
              <div className="flex items-center gap-2 mt-4">
                <span
                  className="font-semibold tracking-[0.12em] uppercase"
                  style={{ fontSize: '9px', color: 'oklch(60% 0.014 68)', fontFamily: 'var(--font-sans)', flexShrink: 0 }}
                >
                  Color
                </span>
                <div className="flex gap-2 flex-wrap">
                  {CHIP_COLORS.map((color) => {
                    const isSelected = color === selectedColor
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setSelectedColor(color)}
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          backgroundColor: color,
                          border: isSelected
                            ? `2px solid oklch(18% 0.020 55)`
                            : '2px solid transparent',
                          outline: isSelected ? `2px solid ${color}` : 'none',
                          outlineOffset: '2px',
                          cursor: 'pointer',
                          padding: 0,
                          transition: 'outline 100ms ease, border-color 100ms ease',
                          flexShrink: 0,
                        }}
                        aria-label={`Select color ${color}`}
                      />
                    )
                  })}
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  type="submit"
                  disabled={!name.trim()}
                  className="flex-1 rounded font-semibold tracking-[0.10em] uppercase"
                  style={{
                    fontSize: '10px',
                    padding: '11px',
                    backgroundColor: selectedColor,
                    color: 'oklch(99% 0 0)',
                    border: 'none',
                    cursor: name.trim() ? 'pointer' : 'not-allowed',
                    opacity: name.trim() ? 1 : 0.4,
                    fontFamily: 'var(--font-sans)',
                    transition: 'opacity 140ms ease, background-color 150ms ease',
                  }}
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={onCancel}
                  className="rounded font-semibold tracking-[0.10em] uppercase"
                  style={{
                    fontSize: '10px',
                    padding: '11px 18px',
                    color: 'oklch(50% 0.016 68)',
                    border: '1px solid oklch(84% 0.012 70)',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-sans)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'oklch(94% 0.010 72)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}
