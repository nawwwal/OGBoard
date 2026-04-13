import { useState, useRef } from 'react'

interface Props {
  tags: string[]
  onAdd: (tag: string) => void
  onRemove: (tag: string) => void
}

export default function TagEditor({ tags, onAdd, onRemove }: Props) {
  const [adding, setAdding] = useState(false)
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function submit() {
    const tag = value.trim().toLowerCase()
    if (tag && !tags.includes(tag)) {
      onAdd(tag)
    }
    setValue('')
    setAdding(false)
  }

  return (
    <div className="flex flex-wrap items-center gap-1 pt-1">
      {tags.map((tag) => (
        <span
          key={tag}
          className="group inline-flex items-center gap-1 rounded"
          style={{
            fontSize: '9px',
            padding: '2px 6px',
            color: 'oklch(44% 0.016 65)',
            border: '1px solid oklch(84% 0.012 70)',
            backgroundColor: 'oklch(93% 0.010 72)',
            fontFamily: 'var(--font-sans)',
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          {tag}
          <button
            onClick={() => onRemove(tag)}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            style={{
              color: 'oklch(56% 0.016 68)',
              lineHeight: 1,
              fontSize: '10px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
            aria-label={`Remove ${tag}`}
          >
            ×
          </button>
        </span>
      ))}

      {adding ? (
        <input
          ref={inputRef}
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); submit() }
            if (e.key === 'Escape') { setValue(''); setAdding(false) }
          }}
          onBlur={submit}
          style={{
            fontSize: '9px',
            padding: '2px 8px',
            border: '1px solid oklch(50% 0.19 55)',
            borderRadius: '3px',
            backgroundColor: 'oklch(97% 0.008 72)',
            color: 'oklch(22% 0.020 58)',
            fontFamily: 'var(--font-sans)',
            outline: 'none',
            width: '72px',
          }}
          placeholder="tag"
          maxLength={20}
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-0.5 rounded transition-colors"
          style={{
            fontSize: '9px',
            padding: '2px 6px',
            color: 'oklch(60% 0.014 68)',
            border: '1px solid oklch(88% 0.010 70)',
            backgroundColor: 'transparent',
            fontFamily: 'var(--font-sans)',
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'oklch(78% 0.014 70)')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'oklch(88% 0.010 70)')}
        >
          + tag
        </button>
      )}
    </div>
  )
}
