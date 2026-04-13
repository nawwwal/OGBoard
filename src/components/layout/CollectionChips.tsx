import { useState, useRef, useEffect } from 'react'
import type { UserCollection } from '#/hooks/useLocalCollections'
import { SYSTEM_COLLECTION_DYNAMIC, SYSTEM_COLLECTION_STATIC } from '#/hooks/useLocalCollections'

interface Props {
  collections: UserCollection[]
  activeId: string | null
  totalCount: number
  dynamicCount: number
  staticCount: number
  onSelect: (id: string | null) => void
  onCreateNew: () => void
  onDelete: (id: string) => void
  onRename: (id: string, newName: string) => void
}

interface ChipMenu {
  id: string
  x: number
  y: number
}

export default function CollectionChips({
  collections,
  activeId,
  totalCount,
  dynamicCount,
  staticCount,
  onSelect,
  onCreateNew,
  onDelete,
  onRename,
}: Props) {
  const [chipMenu, setChipMenu] = useState<ChipMenu | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)

  function handleContextMenu(e: React.MouseEvent, id: string) {
    e.preventDefault()
    setChipMenu({ id, x: e.clientX, y: e.clientY })
  }

  function startRename(id: string) {
    setChipMenu(null)
    setRenamingId(id)
  }

  function commitRename(id: string, value: string) {
    const trimmed = value.trim()
    if (trimmed) onRename(id, trimmed)
    setRenamingId(null)
  }

  function handleDelete(id: string) {
    setChipMenu(null)
    if (activeId === id) onSelect(null)
    onDelete(id)
  }

  return (
    <>
      <div style={{ borderBottom: '1px solid oklch(88% 0.010 70)' }}>
      <div
        className="mx-auto flex items-center gap-2 overflow-x-auto max-w-6xl px-5 py-2.5"
        style={{
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <Chip
          label="All"
          count={totalCount}
          color="oklch(40% 0.016 65)"
          isActive={activeId === null}
          onClick={() => onSelect(null)}
        />

        {dynamicCount > 0 && (
          <Chip
            label="Dynamic"
            count={dynamicCount}
            color="oklch(40% 0.17 60)"
            isActive={activeId === SYSTEM_COLLECTION_DYNAMIC}
            onClick={() => onSelect(SYSTEM_COLLECTION_DYNAMIC)}
          />
        )}

        {staticCount > 0 && (
          <Chip
            label="Static"
            count={staticCount}
            color="oklch(38% 0.10 240)"
            isActive={activeId === SYSTEM_COLLECTION_STATIC}
            onClick={() => onSelect(SYSTEM_COLLECTION_STATIC)}
          />
        )}

        {collections.map((col) =>
          renamingId === col.id ? (
            <RenameInput
              key={col.id}
              col={col}
              onCommit={(val) => commitRename(col.id, val)}
              onCancel={() => setRenamingId(null)}
            />
          ) : (
            <Chip
              key={col.id}
              label={col.name}
              count={col.urls.length}
              color={col.color}
              isActive={activeId === col.id}
              onClick={() => onSelect(col.id)}
              onContextMenu={(e) => handleContextMenu(e, col.id)}
            />
          ),
        )}

        <button
          onClick={onCreateNew}
          className="shrink-0 flex items-center rounded-full font-semibold tracking-[0.08em] uppercase whitespace-nowrap"
          style={{
            fontSize: '10px',
            padding: '5px 12px',
            color: 'oklch(56% 0.016 68)',
            border: '1px dashed oklch(80% 0.012 70)',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
            transition: 'border-color 120ms ease, color 120ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'oklch(60% 0.016 68)'
            e.currentTarget.style.color = 'oklch(40% 0.016 65)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'oklch(80% 0.012 70)'
            e.currentTarget.style.color = 'oklch(56% 0.016 68)'
          }}
        >
          + New collection
        </button>
      </div>
      </div>

      {chipMenu && (
        <ChipContextMenu
          x={chipMenu.x}
          y={chipMenu.y}
          onRename={() => startRename(chipMenu.id)}
          onDelete={() => handleDelete(chipMenu.id)}
          onClose={() => setChipMenu(null)}
        />
      )}
    </>
  )
}

// ── Chip ─────────────────────────────────────────────────────────
function Chip({
  label,
  count,
  color,
  isActive,
  onClick,
  onContextMenu,
}: {
  label: string
  count: number
  color: string
  isActive: boolean
  onClick: () => void
  onContextMenu?: (e: React.MouseEvent) => void
}) {
  return (
    <button
      onClick={onClick}
      onContextMenu={onContextMenu}
      className="shrink-0 flex items-center gap-1.5 rounded-full font-semibold tracking-[0.08em] uppercase whitespace-nowrap"
      style={{
        fontSize: '10px',
        padding: '5px 12px 5px 10px',
        color: isActive ? color : 'oklch(44% 0.016 65)',
        border: `1px solid ${isActive ? color : 'oklch(84% 0.012 70)'}`,
        backgroundColor: isActive
          ? `color-mix(in oklch, ${color} 12%, oklch(99% 0.008 70))`
          : 'oklch(99% 0.008 70)',
        cursor: 'pointer',
        fontFamily: 'var(--font-sans)',
        transition: 'all 120ms ease',
      }}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.borderColor = 'oklch(70% 0.014 68)'
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.borderColor = 'oklch(84% 0.012 70)'
      }}
    >
      <span
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          border: `1.5px solid ${color}`,
          backgroundColor: isActive ? color : 'transparent',
          display: 'inline-block',
          flexShrink: 0,
          transition: 'background-color 120ms ease',
        }}
      />
      {label}
      {count > 0 && (
        <span style={{ opacity: 0.45, fontSize: '9px', marginLeft: '1px' }}>{count}</span>
      )}
    </button>
  )
}

// ── Inline rename input ───────────────────────────────────────────
function RenameInput({
  col,
  onCommit,
  onCancel,
}: {
  col: UserCollection
  onCommit: (value: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(col.name)
  const inputRef = useRef<HTMLInputElement>(null)
  const committed = useRef(false)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  function commit(val: string) {
    if (committed.current) return
    committed.current = true
    onCommit(val)
  }

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); commit(e.currentTarget.value) }
        if (e.key === 'Escape') { committed.current = true; onCancel() }
      }}
      onBlur={(e) => commit(e.target.value)}
      maxLength={40}
      className="shrink-0 rounded-full font-semibold tracking-[0.08em] uppercase"
      style={{
        fontSize: '10px',
        padding: '4px 12px 4px 10px',
        color: col.color,
        border: `1px solid ${col.color}`,
        backgroundColor: `color-mix(in oklch, ${col.color} 12%, oklch(99% 0.008 70))`,
        fontFamily: 'var(--font-sans)',
        outline: 'none',
        minWidth: '80px',
        width: `${Math.max(value.length + 2, 8)}ch`,
      }}
    />
  )
}

// ── Chip context menu ─────────────────────────────────────────────
function ChipContextMenu({
  x,
  y,
  onRename,
  onDelete,
  onClose,
}: {
  x: number
  y: number
  onRename: () => void
  onDelete: () => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleDown)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleDown)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  const top = Math.min(y, window.innerHeight - 100)
  const left = Math.min(x, window.innerWidth - 150)

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        zIndex: 200,
        top,
        left,
        width: '148px',
        backgroundColor: 'oklch(99% 0.008 70)',
        border: '1px solid oklch(84% 0.012 70)',
        borderRadius: '6px',
        boxShadow: '0 8px 24px oklch(0% 0 0 / 0.10)',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      <MenuBtn onClick={onRename}>Rename</MenuBtn>
      <div style={{ height: '1px', backgroundColor: 'oklch(90% 0.010 70)', margin: '2px 0' }} />
      <MenuBtn onClick={onDelete} danger>Delete collection</MenuBtn>
    </div>
  )
}

function MenuBtn({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        display: 'block',
        padding: '7px 12px',
        fontSize: '12px',
        textAlign: 'left',
        color: danger ? 'oklch(44% 0.15 25)' : 'oklch(26% 0.018 60)',
        backgroundColor: 'transparent',
        border: 'none',
        cursor: 'pointer',
        fontFamily: 'var(--font-sans)',
        transition: 'background-color 80ms ease',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'oklch(93% 0.010 72)')}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
    >
      {children}
    </button>
  )
}
