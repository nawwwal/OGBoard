import { useEffect, useRef } from 'react'
import type { UserCollection } from '#/lib/workspace-collections'

interface Props {
  x: number
  y: number
  url: string
  imageUrl: string
  collections: UserCollection[]
  canEdit: boolean
  memberIds: string[]    // collection IDs this URL belongs to
  onClose: () => void
  onInspect: () => void
  onCopyImageUrl: () => void
  onCopyImage: () => void
  onOpenUrl: () => void
  onRemove: () => void
  onToggleCollection: (collectionId: string, isMember: boolean) => void
  onNewCollection: () => void
}

export default function CardContextMenu({
  x,
  y,
  collections,
  canEdit,
  memberIds,
  onClose,
  onInspect,
  onCopyImageUrl,
  onCopyImage,
  onOpenUrl,
  onRemove,
  onToggleCollection,
  onNewCollection,
}: Props) {
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

  // Clamp to viewport
  const top = Math.min(y, window.innerHeight - 340)
  const left = Math.min(x, window.innerWidth - 224)

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        zIndex: 200,
        top,
        left,
        width: '212px',
        backgroundColor: 'oklch(99% 0.008 70)',
        border: '1px solid oklch(84% 0.012 70)',
        borderRadius: '6px',
        boxShadow: '0 8px 32px oklch(0% 0 0 / 0.12), 0 2px 8px oklch(0% 0 0 / 0.06)',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      <Item onClick={() => { onInspect(); onClose() }}>Inspect</Item>

      <Sep />

      <Item onClick={() => { onCopyImage(); onClose() }}>Copy image</Item>
      <Item onClick={() => { onCopyImageUrl(); onClose() }}>Copy image URL</Item>
      <Item onClick={() => { onOpenUrl(); onClose() }}>
        Open in browser
        <span style={{ marginLeft: 'auto', opacity: 0.4, fontSize: '11px' }}>↗</span>
      </Item>

      <Sep />

      {canEdit && (
        <>
          <GroupLabel>Collections</GroupLabel>

          {collections.map((col) => {
            const isMember = memberIds.includes(col.id)
            return (
              <Item
                key={col.id}
                onClick={() => {
                  onToggleCollection(col.id, isMember)
                  onClose()
                }}
              >
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    border: `1.5px solid ${col.color}`,
                    backgroundColor: isMember ? col.color : 'transparent',
                    display: 'inline-block',
                    flexShrink: 0,
                    transition: 'background-color 100ms ease',
                  }}
                />
                <span className="flex-1 truncate">{col.name}</span>
                {isMember && (
                  <span
                    style={{
                      marginLeft: 'auto',
                      color: 'oklch(50% 0.19 55)',
                      fontSize: '11px',
                    }}
                  >
                    ✓
                  </span>
                )}
              </Item>
            )
          })}

          <Item
            onClick={() => {
              onNewCollection()
              onClose()
            }}
            muted
          >
            + New collection
          </Item>

          <Sep />

          <Item
            onClick={() => {
              onRemove()
              onClose()
            }}
            danger
          >
            Delete
          </Item>
        </>
      )}
    </div>
  )
}

function Item({
  children,
  onClick,
  danger,
  muted,
}: {
  children: React.ReactNode
  onClick: () => void
  danger?: boolean
  muted?: boolean
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '7px 12px',
        fontSize: '12px',
        textAlign: 'left',
        color: danger
          ? 'oklch(44% 0.15 25)'
          : muted
          ? 'oklch(54% 0.014 68)'
          : 'oklch(26% 0.018 60)',
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

function Sep() {
  return (
    <div
      style={{
        height: '1px',
        backgroundColor: 'oklch(90% 0.010 70)',
        margin: '2px 0',
      }}
    />
  )
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: '5px 12px 2px',
        fontSize: '9px',
        fontWeight: 600,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: 'oklch(60% 0.014 68)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {children}
    </div>
  )
}
