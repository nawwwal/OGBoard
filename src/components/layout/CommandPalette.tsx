import { useState, useRef, useEffect, useMemo } from 'react'
import type { OGResult } from '#/server/og/scrape.server'
import type { UserCollection } from '#/lib/workspace-collections'
import {
  SYSTEM_COLLECTION_DYNAMIC,
  SYSTEM_COLLECTION_STATIC,
} from '#/lib/workspace-collections'
import { extractDomain, isValidUrl, normalizeUserInputUrl } from '#/lib/domain'

interface CommandItem {
  id: string
  type: 'url' | 'collection' | 'action'
  label: string
  sublabel?: string
  shortcut?: string[]
  action: () => void
  imageUrl?: string
  color?: string
}

interface Props {
  urls: string[]
  ogDataMap: Map<string, OGResult>
  collections: UserCollection[]
  dynamicCount: number
  staticCount: number
  canEdit?: boolean
  onClose: () => void
  onInspect: (url: string) => void
  onSelectCollection: (id: string | null) => void
  onFocusInput: () => void
  onAddUrl: (urls: string[]) => void
}

const SYSTEM_COLS = [
  { id: null, label: 'All cards', color: 'oklch(40% 0.016 65)' },
  { id: SYSTEM_COLLECTION_DYNAMIC, label: 'Dynamic', color: 'oklch(40% 0.17 60)' },
  { id: SYSTEM_COLLECTION_STATIC, label: 'Static', color: 'oklch(38% 0.10 240)' },
]

export default function CommandPalette({
  urls,
  ogDataMap,
  collections,
  dynamicCount,
  staticCount,
  canEdit = true,
  onClose,
  onInspect,
  onSelectCollection,
  onFocusInput,
  onAddUrl,
}: Props) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  // Detect if the current query looks like a URL
  const normalizedQuery = query.trim()
  const isUrlQuery = isValidUrl(normalizedQuery) || isValidUrl(`https://${normalizedQuery}`)
  const resolvedUrl = isUrlQuery ? normalizeUserInputUrl(normalizedQuery) : null
  const isAlreadyAdded = resolvedUrl ? urls.includes(resolvedUrl) : false

  const allItems = useMemo<CommandItem[]>(() => {
    const q = normalizedQuery.toLowerCase()
    const result: CommandItem[] = []

    // Dynamic "Fetch URL" item — only when query looks like a URL
    if (canEdit && resolvedUrl && !isAlreadyAdded) {
      result.push({
        id: 'action:fetch-url',
        type: 'action',
        label: `Fetch ${extractDomain(resolvedUrl)}`,
        sublabel: resolvedUrl,
        action: () => { onAddUrl([resolvedUrl]); onClose() },
      })
    }

    // If already added, show it first with "Inspect" framing
    if (resolvedUrl && isAlreadyAdded) {
      const og = ogDataMap.get(resolvedUrl)
      result.push({
        id: `url:${resolvedUrl}`,
        type: 'url',
        label: og?.title ?? extractDomain(resolvedUrl),
        sublabel: extractDomain(resolvedUrl),
        imageUrl: og?.image ?? undefined,
        action: () => { onInspect(resolvedUrl); onClose() },
      })
    }

    // URL items (skip if already pinned at top via isAlreadyAdded)
    for (const url of urls) {
      if (url === resolvedUrl && isAlreadyAdded) continue
      const og = ogDataMap.get(url)
      const title = og?.title ?? extractDomain(url)
      if (!q || url.toLowerCase().includes(q) || title.toLowerCase().includes(q)) {
        result.push({
          id: `url:${url}`,
          type: 'url',
          label: title,
          sublabel: extractDomain(url),
          imageUrl: og?.image ?? undefined,
          action: () => { onInspect(url); onClose() },
        })
      }
    }

    // Collection items
    const systemCollsToShow = SYSTEM_COLS.filter((c) => {
      if (c.id === SYSTEM_COLLECTION_DYNAMIC && dynamicCount === 0) return false
      if (c.id === SYSTEM_COLLECTION_STATIC && staticCount === 0) return false
      return true
    })

    const allCols = [
      ...systemCollsToShow.map((c) => ({
        id: c.id,
        label: c.label,
        color: c.color,
        count: c.id === null ? urls.length : c.id === SYSTEM_COLLECTION_DYNAMIC ? dynamicCount : staticCount,
      })),
      ...collections.map((c) => ({ id: c.id, label: c.name, color: c.color, count: c.urls.length })),
    ]

    for (const col of allCols) {
      if (!q || col.label.toLowerCase().includes(q)) {
        result.push({
          id: `col:${col.id}`,
          type: 'collection',
          label: col.label,
          sublabel: `${col.count} ${col.count === 1 ? 'card' : 'cards'}`,
          color: col.color,
          action: () => { onSelectCollection(col.id); onClose() },
        })
      }
    }

    // Action items
    const actions: CommandItem[] = canEdit
      ? [
          {
            id: 'action:add-url',
            type: 'action',
            label: 'Add URL',
            sublabel: 'Focus the URL input',
            shortcut: ['/'],
            action: () => {
              onFocusInput()
              onClose()
            },
          },
        ]
      : []

    for (const a of actions) {
      if (!q || a.label.toLowerCase().includes(q) || (a.sublabel?.toLowerCase().includes(q) ?? false)) {
        result.push(a)
      }
    }

    return result
  }, [canEdit, normalizedQuery, resolvedUrl, isAlreadyAdded, urls, ogDataMap, collections, dynamicCount, staticCount, onInspect, onSelectCollection, onFocusInput, onAddUrl, onClose])

  const sections = useMemo(() => {
    const indexedItems = allItems.map((item, globalIndex) => ({ item, globalIndex }))
    const fetchItem = indexedItems.find(({ item }) => item.id === 'action:fetch-url') ?? null

    return {
      fetchItem,
      urlItems: indexedItems.filter(({ item }) => item.type === 'url'),
      collectionItems: indexedItems.filter(({ item }) => item.type === 'collection'),
      actionItems: indexedItems.filter(
        ({ item }) => item.type === 'action' && item.id !== 'action:fetch-url',
      ),
    }
  }, [allItems])
  const fetchSectionItem = sections.fetchItem

  // Reset to top when results change
  useEffect(() => { setActiveIndex(0) }, [allItems.length])

  // Scroll active item into view
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, allItems.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      allItems[activeIndex]?.action()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'Tab') {
      // Keep focus locked in palette
      e.preventDefault()
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[100]"
        style={{ backgroundColor: 'oklch(18% 0.020 55 / 0.22)' }}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="fixed left-1/2 z-[101] w-full"
        style={{ top: '80px', maxWidth: '560px', transform: 'translateX(-50%)', padding: '0 16px' }}
      >
        <div
          className="rounded overflow-hidden"
          style={{
            backgroundColor: 'oklch(99% 0.008 70)',
            border: '1px solid oklch(84% 0.012 70)',
            boxShadow: '0 20px 60px oklch(0% 0 0 / 0.16)',
          }}
          onKeyDown={handleKeyDown}
        >
          {/* Search */}
          <div
            className="flex items-center gap-3 px-4"
            style={{ borderBottom: '1px solid oklch(90% 0.010 70)' }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, color: 'oklch(56% 0.016 68)' }}>
              <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search URLs, collections, actions…"
              aria-label="Command palette search"
              aria-autocomplete="list"
              aria-activedescendant={allItems[activeIndex] ? `cp-item-${activeIndex}` : undefined}
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                backgroundColor: 'transparent',
                fontSize: '14px',
                color: 'oklch(18% 0.020 55)',
                fontFamily: 'var(--font-sans)',
                padding: '14px 0',
              }}
            />
            <Kbd>esc</Kbd>
          </div>

          {/* Results */}
          <div
            ref={listRef}
            role="listbox"
            aria-label="Command results"
            style={{ maxHeight: '360px', overflowY: 'auto' }}
          >
            {allItems.length === 0 && query ? (
              <p style={{ padding: '28px 16px', textAlign: 'center', fontSize: '13px', color: 'oklch(60% 0.014 68)', fontFamily: 'var(--font-sans)' }}>
                No results for &ldquo;{query}&rdquo;
              </p>
            ) : (
              <>
                {fetchSectionItem && (
                  <Group label="Fetch">
                    <PaletteItem
                      item={fetchSectionItem.item}
                      globalIndex={fetchSectionItem.globalIndex}
                      isActive={fetchSectionItem.globalIndex === activeIndex}
                      onHover={() => setActiveIndex(fetchSectionItem.globalIndex)}
                    />
                  </Group>
                )}
                {sections.urlItems.length > 0 && (
                  <Group label="Inspect URL">
                    {sections.urlItems.map(({ item, globalIndex }) => {
                      return (
                        <PaletteItem
                          key={item.id}
                          item={item}
                          globalIndex={globalIndex}
                          isActive={globalIndex === activeIndex}
                          onHover={() => setActiveIndex(globalIndex)}
                        />
                      )
                    })}
                  </Group>
                )}
                {sections.collectionItems.length > 0 && (
                  <Group label="Switch Collection">
                    {sections.collectionItems.map(({ item, globalIndex }) => {
                      return (
                        <PaletteItem
                          key={item.id}
                          item={item}
                          globalIndex={globalIndex}
                          isActive={globalIndex === activeIndex}
                          onHover={() => setActiveIndex(globalIndex)}
                        />
                      )
                    })}
                  </Group>
                )}
                {sections.actionItems.length > 0 && (
                  <Group label="Actions">
                    {sections.actionItems.map(({ item, globalIndex }) => {
                      return (
                        <PaletteItem
                          key={item.id}
                          item={item}
                          globalIndex={globalIndex}
                          isActive={globalIndex === activeIndex}
                          onHover={() => setActiveIndex(globalIndex)}
                        />
                      )
                    })}
                  </Group>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div
            className="flex items-center gap-4 px-4 py-2.5"
            style={{
              borderTop: '1px solid oklch(90% 0.010 70)',
              backgroundColor: 'oklch(97% 0.008 72)',
            }}
          >
            {[['↑↓', 'navigate'], ['↵', 'select'], ['esc', 'close']].map(([key, label]) => (
              <span key={key} className="flex items-center gap-1.5" style={{ fontSize: '11px', color: 'oklch(56% 0.016 68)', fontFamily: 'var(--font-sans)' }}>
                <Kbd>{key}</Kbd>
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label}>
      <p style={{
        fontSize: '9px',
        fontWeight: 600,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: 'oklch(60% 0.014 68)',
        fontFamily: 'var(--font-sans)',
        padding: '10px 16px 4px',
      }}>
        {label}
      </p>
      {children}
    </div>
  )
}

function PaletteItem({
  item,
  globalIndex,
  isActive,
  onHover,
}: {
  item: CommandItem
  globalIndex: number
  isActive: boolean
  onHover: () => void
}) {
  return (
    <button
      id={`cp-item-${globalIndex}`}
      data-index={globalIndex}
      role="option"
      aria-selected={isActive}
      onClick={item.action}
      onMouseEnter={onHover}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '8px 16px',
        backgroundColor: isActive ? 'oklch(93% 0.010 72)' : 'transparent',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'var(--font-sans)',
        transition: 'background-color 80ms ease',
      }}
    >
      {/* Leading indicator */}
      {item.type === 'url' && (
        item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt=""
            style={{
              width: '36px',
              height: '22px',
              borderRadius: '2px',
              objectFit: 'cover',
              flexShrink: 0,
              border: '1px solid oklch(90% 0.010 70)',
              backgroundColor: 'oklch(94% 0.010 72)',
            }}
          />
        ) : (
          <div style={{
            width: '36px',
            height: '22px',
            borderRadius: '2px',
            backgroundColor: 'oklch(94% 0.010 72)',
            flexShrink: 0,
            border: '1px solid oklch(90% 0.010 70)',
          }} />
        )
      )}
      {item.type === 'collection' && (
        <span style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: item.color ?? 'oklch(50% 0.016 68)',
          flexShrink: 0,
        }} />
      )}
      {item.type === 'action' && (
        <span style={{
          width: '8px',
          height: '8px',
          borderRadius: '2px',
          backgroundColor: 'oklch(50% 0.19 55)',
          flexShrink: 0,
          opacity: 0.7,
        }} />
      )}

      {/* Label */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: '13px',
          color: 'oklch(18% 0.020 55)',
          fontWeight: 500,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          margin: 0,
          lineHeight: 1.3,
        }}>
          {item.label}
        </p>
        {item.sublabel && (
          <p style={{
            fontSize: '11px',
            color: 'oklch(56% 0.016 68)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            margin: 0,
            lineHeight: 1.3,
          }}>
            {item.sublabel}
          </p>
        )}
      </div>

      {/* Shortcut */}
      {item.shortcut && (
        <div className="flex items-center gap-1" style={{ flexShrink: 0 }}>
          {item.shortcut.map((k) => <Kbd key={k}>{k}</Kbd>)}
        </div>
      )}
    </button>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd style={{
      fontSize: '10px',
      padding: '2px 5px',
      borderRadius: '3px',
      backgroundColor: 'oklch(93% 0.010 72)',
      border: '1px solid oklch(84% 0.012 70)',
      color: 'oklch(50% 0.016 68)',
      fontFamily: 'var(--font-sans)',
      lineHeight: 1.4,
    }}>
      {children}
    </kbd>
  )
}
