import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { ogQueryOptions } from '#/queries/og.queries'
import {
  createWorkspaceFn,
  getPublicWorkspaceFn,
  patchWorkspaceFn,
} from '#/functions/workspace.functions'
import { useBulkOGFetch } from '#/hooks/useBulkOGFetch'
import {
  SYSTEM_COLLECTION_DYNAMIC,
  SYSTEM_COLLECTION_STATIC,
  type UserCollection,
  CHIP_COLORS,
} from '#/lib/workspace-collections'
import StickyInputBar from '#/components/layout/StickyInputBar'
import type { StickyInputBarRef } from '#/components/layout/StickyInputBar'
import CollectionChips from '#/components/layout/CollectionChips'
import CreateCollectionModal from '#/components/layout/CreateCollectionModal'
import CommandPalette from '#/components/layout/CommandPalette'
import MasonryGrid from '#/components/grid/MasonryGrid'
import OGCard from '#/components/cards/OGCard'
import CardContextMenu from '#/components/cards/CardContextMenu'
import DetailDrawer from '#/components/layout/DetailDrawer'
import type { OGResult } from '#/server/og/scrape.server'

interface ContextMenuState {
  x: number
  y: number
  url: string
  imageUrl: string
}

async function copyImageBinary(src: string) {
  try {
    const res = await fetch(src)
    const blob = await res.blob()
    if (blob.type.startsWith('image/')) {
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
      return
    }
  } catch { /* CORS — fall through */ }
  await navigator.clipboard.writeText(src).catch(() => {})
}

export const Route = createFileRoute('/')({
  component: HomePage,
})

const HOME_WORKSPACE_STORAGE_KEY = 'og-home-workspace-v1'
const HOME_WORKSPACE_ID_QUERY_KEY = 'board'
const HOME_WORKSPACE_OWNER_TOKEN_PREFIX = 'og-home-workspace-owner:'

interface PersistedWorkspaceBackendMeta {
  id: string
  revision: number
  updatedAt: number
}

interface PersistedWorkspace {
  backend: PersistedWorkspaceBackendMeta | null
  entries: Array<{ ogData: OGResult; url: string }>
  collections: UserCollection[]
  activeCollectionId: string | null
  selectedUrl: string | null
  urls: string[]
  version: 2
}

function workspaceOwnerTokenKey(id: string) {
  return `${HOME_WORKSPACE_OWNER_TOKEN_PREFIX}${id}`
}

function readWorkspaceIdFromUrl(): string | null {
  if (typeof window === 'undefined') return null

  const params = new URLSearchParams(window.location.search)
  const id = params.get(HOME_WORKSPACE_ID_QUERY_KEY)?.trim()
  return id || null
}

function setWorkspaceIdInUrl(id: string) {
  if (typeof window === 'undefined') return

  const url = new URL(window.location.href)
  url.searchParams.set(HOME_WORKSPACE_ID_QUERY_KEY, id)
  window.history.replaceState({}, '', url)
}

function readWorkspaceOwnerToken(id: string): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(workspaceOwnerTokenKey(id))
}

function saveWorkspaceOwnerToken(id: string, ownerToken: string) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(workspaceOwnerTokenKey(id), ownerToken)
}

function readPersistedWorkspace(): PersistedWorkspace | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(HOME_WORKSPACE_STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as
      | PersistedWorkspace
      | (Omit<PersistedWorkspace, 'version' | 'collections' | 'activeCollectionId'> & {
          version: 1
          backend: (PersistedWorkspaceBackendMeta & { ownerToken?: string }) | null
        })

    if (!Array.isArray(parsed.urls) || !Array.isArray(parsed.entries)) {
      window.localStorage.removeItem(HOME_WORKSPACE_STORAGE_KEY)
      return null
    }

    if (parsed.backend?.id && 'ownerToken' in parsed.backend && parsed.backend.ownerToken) {
      saveWorkspaceOwnerToken(parsed.backend.id, parsed.backend.ownerToken)
    }

    return {
      version: 2,
      backend: parsed.backend
        ? {
            id: parsed.backend.id,
            revision: parsed.backend.revision,
            updatedAt: parsed.backend.updatedAt,
          }
        : null,
      urls: parsed.urls,
      entries: parsed.entries,
      collections:
        'collections' in parsed && Array.isArray(parsed.collections)
          ? parsed.collections
          : [],
      activeCollectionId:
        'activeCollectionId' in parsed &&
        (parsed.activeCollectionId === null ||
          typeof parsed.activeCollectionId === 'string')
          ? parsed.activeCollectionId
          : null,
      selectedUrl: parsed.selectedUrl ?? null,
    }
  } catch {
    window.localStorage.removeItem(HOME_WORKSPACE_STORAGE_KEY)
    return null
  }
}

function HomePage() {
  const [urls, setUrls] = useState<string[]>([])
  const [collections, setCollections] = useState<UserCollection[]>([])
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null)
  const [hasRestoredWorkspace, setHasRestoredWorkspace] = useState(false)
  const [workspaceMeta, setWorkspaceMeta] = useState<PersistedWorkspaceBackendMeta | null>(null)
  const [workspaceOwnerToken, setWorkspaceOwnerToken] = useState<string | null>(null)
  const [sharedWorkspaceId, setSharedWorkspaceId] = useState<string | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [pendingCollectionUrl, setPendingCollectionUrl] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const { fetchBulk, progress } = useBulkOGFetch()
  const restoredRef = useRef(false)
  const inputBarRef = useRef<StickyInputBarRef>(null)
  const createWorkspace = useServerFn(createWorkspaceFn)
  const getPublicWorkspace = useServerFn(getPublicWorkspaceFn)
  const patchWorkspace = useServerFn(patchWorkspaceFn)

  const isSavingRef = useRef(false)
  const pendingSaveRef = useRef(false)
  const latestWorkspaceRef = useRef<PersistedWorkspace | null>(null)
  const selectedUrlRef = useRef(selectedUrl)
  const filteredUrlsRef = useRef<string[]>([])
  useEffect(() => {
    selectedUrlRef.current = selectedUrl
  }, [selectedUrl])

  function hydrateWorkspace(workspace: PersistedWorkspace) {
    for (const entry of workspace.entries) {
      queryClient.setQueryData(ogQueryOptions(entry.url).queryKey, entry.ogData)
    }

    setUrls(workspace.urls)
    setCollections(workspace.collections)
    setSelectedUrl(
      workspace.selectedUrl && workspace.urls.includes(workspace.selectedUrl)
        ? workspace.selectedUrl
        : null,
    )
    setActiveCollectionId(workspace.activeCollectionId)
    setWorkspaceMeta(workspace.backend)
    setWorkspaceOwnerToken(
      workspace.backend ? readWorkspaceOwnerToken(workspace.backend.id) : null,
    )
    setSharedWorkspaceId(workspace.backend?.id ?? readWorkspaceIdFromUrl())
  }

  function handleFetch(newUrls: string[]) {
    if (!canEditWorkspace) return

    const unique = newUrls.filter((u) => !urls.includes(u))
    if (unique.length === 0) return
    setUrls((prev) => [...prev, ...unique])
    setSyncError(null)
    fetchBulk(unique)
  }

  const canEditWorkspace =
    sharedWorkspaceId === null || !!(workspaceMeta && workspaceOwnerToken)

  const ogDataMap = useMemo(() => {
    const map = new Map<string, OGResult>()
    for (const url of urls) {
      const cached = queryClient.getQueryData<OGResult>(ogQueryOptions(url).queryKey)
      if (cached) map.set(url, cached)
    }
    return map
  }, [urls, queryClient, progress.completed])

  const systemCounts = useMemo(() => {
    let dynamic = 0, staticCount = 0
    for (const [, data] of ogDataMap) {
      if (data.detection.label === 'Dynamic') dynamic++
      else staticCount++
    }
    return { dynamic, static: staticCount }
  }, [ogDataMap])

  const filteredUrls = useMemo(() => {
    if (activeCollectionId === null) return urls
    if (activeCollectionId === SYSTEM_COLLECTION_DYNAMIC)
      return urls.filter((u) => ogDataMap.get(u)?.detection.label === 'Dynamic')
    if (activeCollectionId === SYSTEM_COLLECTION_STATIC)
      return urls.filter((u) => { const d = ogDataMap.get(u); return d && d.detection.label !== 'Dynamic' })
    const col = collections.find((c) => c.id === activeCollectionId)
    return col ? urls.filter((u) => col.urls.includes(u)) : urls
  }, [urls, activeCollectionId, collections, ogDataMap])

  useEffect(() => {
    if (
      activeCollectionId === null ||
      activeCollectionId === SYSTEM_COLLECTION_DYNAMIC ||
      activeCollectionId === SYSTEM_COLLECTION_STATIC ||
      collections.some((collection) => collection.id === activeCollectionId)
    ) {
      return
    }

    setActiveCollectionId(null)
  }, [activeCollectionId, collections])

  useEffect(() => {
    filteredUrlsRef.current = filteredUrls
  }, [filteredUrls])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowCommandPalette((value) => !value)
        return
      }

      const activeElement = document.activeElement as HTMLElement | null
      const tag = activeElement?.tagName
      const isInputFocused =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        activeElement?.isContentEditable

      if (e.key === '/' && !isInputFocused) {
        e.preventDefault()
        inputBarRef.current?.focus()
        return
      }

      if (!isInputFocused && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        const currentUrl = selectedUrlRef.current
        const visibleUrls = filteredUrlsRef.current
        if (!currentUrl || visibleUrls.length === 0) return

        const currentIndex = visibleUrls.indexOf(currentUrl)
        if (currentIndex === -1) return

        const nextIndex =
          e.key === 'ArrowLeft'
            ? Math.max(0, currentIndex - 1)
            : Math.min(visibleUrls.length - 1, currentIndex + 1)

        if (nextIndex !== currentIndex) {
          e.preventDefault()
          setSelectedUrl(visibleUrls[nextIndex])
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, url: string) => {
      e.preventDefault()
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        url,
        imageUrl: ogDataMap.get(url)?.image ?? '',
      })
    },
    [ogDataMap],
  )

  function handleCreateCollection(name: string, color: string) {
    if (!canEditWorkspace) return

    const collectionId = crypto.randomUUID()
    setCollections((current) => [
      ...current,
      {
        id: collectionId,
        name: name.trim(),
        color: color || CHIP_COLORS[current.length % CHIP_COLORS.length],
        urls: pendingCollectionUrl ? [pendingCollectionUrl] : [],
      },
    ])

    if (pendingCollectionUrl) {
      setActiveCollectionId(collectionId)
      setPendingCollectionUrl(null)
    }

    setSyncError(null)
    setShowCreateModal(false)
  }

  function addUrlToCollection(collectionId: string, url: string) {
    if (!canEditWorkspace) return

    setCollections((current) =>
      current.map((collection) =>
        collection.id === collectionId && !collection.urls.includes(url)
          ? { ...collection, urls: [...collection.urls, url] }
          : collection,
      ),
    )
    setSyncError(null)
  }

  function removeUrlFromCollection(collectionId: string, url: string) {
    if (!canEditWorkspace) return

    setCollections((current) =>
      current.map((collection) =>
        collection.id === collectionId
          ? {
              ...collection,
              urls: collection.urls.filter((currentUrl) => currentUrl !== url),
            }
          : collection,
      ),
    )
    setSyncError(null)
  }

  function deleteCollection(collectionId: string) {
    if (!canEditWorkspace) return

    setCollections((current) =>
      current.filter((collection) => collection.id !== collectionId),
    )
    setSyncError(null)
  }

  function renameCollection(collectionId: string, newName: string) {
    if (!canEditWorkspace) return

    const trimmedName = newName.trim()
    if (!trimmedName) return

    setCollections((current) =>
      current.map((collection) =>
        collection.id === collectionId
          ? { ...collection, name: trimmedName }
          : collection,
      ),
    )
    setSyncError(null)
  }

  function removeUrlFromBoard(url: string) {
    if (!canEditWorkspace) return

    setUrls((current) => current.filter((currentUrl) => currentUrl !== url))
    setCollections((current) =>
      current.map((collection) => ({
        ...collection,
        urls: collection.urls.filter((currentUrl) => currentUrl !== url),
      })),
    )
    setSyncError(null)
  }

  useEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true

    const persisted = readPersistedWorkspace()
    const urlWorkspaceId = readWorkspaceIdFromUrl()
    const shouldHydratePersisted =
      !!persisted &&
      (!urlWorkspaceId ||
        !persisted.backend ||
        persisted.backend.id === urlWorkspaceId)

    if (persisted && shouldHydratePersisted) {
      hydrateWorkspace(persisted)
    }
    const restoredWorkspaceId = persisted?.backend?.id ?? null

    if (urlWorkspaceId) {
      setSharedWorkspaceId(urlWorkspaceId)
    } else if (restoredWorkspaceId) {
      setSharedWorkspaceId(restoredWorkspaceId)
      setWorkspaceIdInUrl(restoredWorkspaceId)
    }

    setHasRestoredWorkspace(true)
  }, [queryClient])

  useEffect(() => {
    if (!hasRestoredWorkspace || !sharedWorkspaceId) return

    let cancelled = false

    void (async () => {
      try {
        const serverWorkspace = await getPublicWorkspace({
          data: {
            id: sharedWorkspaceId,
          },
        })

        if (!serverWorkspace || cancelled) return
        if (
          workspaceMeta?.id === sharedWorkspaceId &&
          serverWorkspace.updatedAt <= workspaceMeta.updatedAt
        ) {
          return
        }

        setSyncError(null)

        hydrateWorkspace({
          version: 2,
          backend: {
            id: sharedWorkspaceId,
            revision: serverWorkspace.revision,
            updatedAt: serverWorkspace.updatedAt,
          },
          entries: serverWorkspace.entries.flatMap((entry) =>
            entry.ogData ? [{ url: entry.url, ogData: entry.ogData }] : [],
          ),
          collections: serverWorkspace.collections,
          activeCollectionId: serverWorkspace.activeCollectionId,
          selectedUrl: serverWorkspace.selectedUrl,
          urls: serverWorkspace.urls,
        })
      } catch (error) {
        if (!cancelled) {
          setSyncError(
            error instanceof Error
              ? error.message
              : 'Could not restore the shared board from Upstash.',
          )
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [getPublicWorkspace, hasRestoredWorkspace, queryClient, sharedWorkspaceId, workspaceMeta])

  useEffect(() => {
    if (!hasRestoredWorkspace || typeof window === 'undefined') return

    const payload: PersistedWorkspace = {
      version: 2,
      backend: workspaceMeta,
      urls,
      collections,
      activeCollectionId,
      selectedUrl: selectedUrl && urls.includes(selectedUrl) ? selectedUrl : null,
      entries: urls.flatMap((url) => {
        const ogData = ogDataMap.get(url)
        return ogData ? [{ url, ogData }] : []
      }),
    }
    latestWorkspaceRef.current = payload

    if (urls.length === 0 && collections.length === 0 && !workspaceMeta) {
      window.localStorage.removeItem(HOME_WORKSPACE_STORAGE_KEY)
      return
    }

    window.localStorage.setItem(HOME_WORKSPACE_STORAGE_KEY, JSON.stringify(payload))
  }, [
    activeCollectionId,
    collections,
    hasRestoredWorkspace,
    ogDataMap,
    selectedUrl,
    urls,
    workspaceMeta,
  ])

  useEffect(() => {
    if (!hasRestoredWorkspace || !canEditWorkspace || urls.length === 0) return

    const timeout = window.setTimeout(() => {
      void persistWorkspace()
    }, 800)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [
    activeCollectionId,
    canEditWorkspace,
    collections,
    hasRestoredWorkspace,
    ogDataMap,
    selectedUrl,
    urls,
  ])

  async function persistWorkspace() {
    const snapshot = latestWorkspaceRef.current
    if (!snapshot || snapshot.urls.length === 0 || !canEditWorkspace) return

    if (isSavingRef.current) {
      pendingSaveRef.current = true
      return
    }

    isSavingRef.current = true

    try {
      const serverSnapshot = {
        entries: snapshot.urls.map((url) => ({
          url,
          ogData: snapshot.entries.find((entry) => entry.url === url)?.ogData ?? null,
        })),
        selectedUrl: snapshot.selectedUrl,
        urls: snapshot.urls,
        collections: snapshot.collections,
        activeCollectionId: snapshot.activeCollectionId,
      }

      if (!snapshot.backend || !workspaceOwnerToken) {
        const created = await createWorkspace({
          data: {
            snapshot: serverSnapshot,
          },
        })

        const backend = {
          id: created.id,
          revision: created.workspace.revision,
          updatedAt: created.workspace.updatedAt,
        }

        saveWorkspaceOwnerToken(created.id, created.ownerToken)
        setWorkspaceOwnerToken(created.ownerToken)
        setSharedWorkspaceId(created.id)
        setWorkspaceIdInUrl(created.id)
        setSyncError(null)

        latestWorkspaceRef.current = {
          ...snapshot,
          backend,
        }
        setWorkspaceMeta(backend)
      } else {
        const updated = await patchWorkspace({
          data: {
            id: snapshot.backend.id,
            ownerToken: workspaceOwnerToken,
            expectedRevision: snapshot.backend.revision,
            snapshot: serverSnapshot,
          },
        })

        if (updated) {
          const backend = {
            id: snapshot.backend.id,
            revision: updated.revision,
            updatedAt: updated.updatedAt,
          }

          setSyncError(null)
          latestWorkspaceRef.current = {
            ...snapshot,
            backend,
          }
          setWorkspaceMeta(backend)
        }
      }
    } catch (error) {
      setSyncError(
        error instanceof Error ? error.message : 'Cloud sync failed for this board.',
      )
    } finally {
      isSavingRef.current = false

      if (pendingSaveRef.current) {
        pendingSaveRef.current = false
        void persistWorkspace()
      }
    }
  }

  return (
    <>
      <StickyInputBar
        ref={inputBarRef}
        onFetch={handleFetch}
        progress={progress}
        disabled={!canEditWorkspace}
        placeholder={
          canEditWorkspace ? undefined : 'This shared board is read-only in this browser'
        }
      />

      {urls.length > 0 && (
        <CollectionChips
          collections={collections}
          activeId={activeCollectionId}
          totalCount={urls.length}
          dynamicCount={systemCounts.dynamic}
          staticCount={systemCounts.static}
          onSelect={setActiveCollectionId}
          isReadOnly={!canEditWorkspace}
          onCreateNew={() => {
            setPendingCollectionUrl(null)
            setShowCreateModal(true)
          }}
          onDelete={(id) => {
            deleteCollection(id)
            if (activeCollectionId === id) setActiveCollectionId(null)
          }}
          onRename={renameCollection}
        />
      )}

      <main className="px-5 py-6 mx-auto max-w-6xl">
        {hasRestoredWorkspace && urls.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex flex-col gap-1">
                <p
                  className="font-semibold tracking-[0.12em] uppercase"
                  style={{
                    fontSize: '10px',
                    color: 'oklch(56% 0.016 68)',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  {filteredUrls.length}
                  {activeCollectionId ? ` of ${urls.length}` : ''}{' '}
                  {filteredUrls.length === 1 ? 'card' : 'cards'}
                  {progress.inProgress && (
                    <span style={{ color: 'oklch(50% 0.19 55)', marginLeft: '8px' }}>
                      {progress.completed}/{progress.total} fetched
                    </span>
                  )}
                </p>

                {(syncError || (sharedWorkspaceId && !canEditWorkspace)) && (
                  <p
                    style={{
                      fontSize: '11px',
                      color: syncError
                        ? 'oklch(44% 0.15 25)'
                        : canEditWorkspace
                          ? 'oklch(42% 0.11 155)'
                          : 'oklch(56% 0.016 68)',
                      fontFamily: 'var(--font-sans)',
                    }}
                  >
                    {syncError
                      ? `Cloud sync unavailable: ${syncError}`
                      : 'Viewing the Upstash board in read-only mode.'}
                  </p>
                )}
              </div>
            </div>

            <MasonryGrid>
              {filteredUrls.map((url) => (
                <div key={url} onContextMenu={(e) => handleContextMenu(e, url)}>
                  <OGCard
                    url={url}
                    onSelect={() => setSelectedUrl(url)}
                    isSelected={selectedUrl === url}
                    snapshotData={ogDataMap.get(url) ?? null}
                  />
                </div>
              ))}
            </MasonryGrid>

            {filteredUrls.length === 0 && activeCollectionId && (
              <div className="flex flex-col items-center justify-center min-h-[28vh] gap-2 text-center">
                <p style={{ fontSize: '13px', color: 'oklch(56% 0.016 68)', fontFamily: 'var(--font-sans)' }}>
                  No cards in this collection yet.
                </p>
                <p style={{ fontSize: '12px', color: 'oklch(64% 0.014 68)', fontFamily: 'var(--font-sans)' }}>
                  Right-click any card to add it.
                </p>
              </div>
            )}
          </>
        )}
      </main>

      <DetailDrawer
        url={selectedUrl}
        snapshotData={selectedUrl ? ogDataMap.get(selectedUrl) ?? null : null}
        onClose={() => setSelectedUrl(null)}
      />

      {contextMenu && (
        <CardContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          url={contextMenu.url}
          imageUrl={contextMenu.imageUrl}
          collections={collections}
          memberIds={collections.filter((c) => c.urls.includes(contextMenu.url)).map((c) => c.id)}
          canEdit={canEditWorkspace}
          onClose={() => setContextMenu(null)}
          onInspect={() => setSelectedUrl(contextMenu.url)}
          onCopyImageUrl={() => navigator.clipboard.writeText(contextMenu.imageUrl || contextMenu.url).catch(() => {})}
          onCopyImage={() => copyImageBinary(contextMenu.imageUrl || contextMenu.url)}
          onOpenUrl={() => window.open(contextMenu.url, '_blank', 'noopener,noreferrer')}
          onRemove={() => {
            removeUrlFromBoard(contextMenu.url)
            if (selectedUrl === contextMenu.url) setSelectedUrl(null)
          }}
          onToggleCollection={(colId, isMember) => {
            if (isMember) removeUrlFromCollection(colId, contextMenu.url)
            else addUrlToCollection(colId, contextMenu.url)
          }}
          onNewCollection={() => {
            setPendingCollectionUrl(contextMenu.url)
            setShowCreateModal(true)
          }}
        />
      )}

      {showCreateModal && canEditWorkspace && (
        <CreateCollectionModal
          onConfirm={handleCreateCollection}
          onCancel={() => {
            setShowCreateModal(false)
            setPendingCollectionUrl(null)
          }}
          initialColorIndex={collections.length}
        />
      )}

      {showCommandPalette && (
        <CommandPalette
          urls={urls}
          ogDataMap={ogDataMap}
          collections={collections}
          dynamicCount={systemCounts.dynamic}
          staticCount={systemCounts.static}
          canEdit={canEditWorkspace}
          onClose={() => setShowCommandPalette(false)}
          onInspect={(url) => setSelectedUrl(url)}
          onSelectCollection={setActiveCollectionId}
          onFocusInput={() => inputBarRef.current?.focus()}
          onAddUrl={handleFetch}
        />
      )}
    </>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[58vh] gap-5 text-center">
      {/* Archival mark */}
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '3px',
          border: '1px solid oklch(82% 0.016 68)',
          backgroundColor: 'oklch(99% 0.008 70)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '20px',
            lineHeight: 1,
            color: 'oklch(50% 0.19 55)',
          }}
        >
          OG
        </span>
      </div>

      <div style={{ maxWidth: '320px' }}>
        <p
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '20px',
            color: 'oklch(26% 0.020 58)',
            lineHeight: 1.25,
            marginBottom: '8px',
          }}
        >
          Inspect any URL's OG image
        </p>
        <p
          style={{
            fontSize: '13px',
            color: 'oklch(56% 0.016 68)',
            fontFamily: 'var(--font-sans)',
            lineHeight: 1.5,
          }}
        >
          Paste one URL or bulk-paste up to 50. Cards appear as they resolve.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {['vercel.com', 'linear.app', 'github.com', 'stripe.com'].map((domain) => (
          <span
            key={domain}
            className="font-mono rounded"
            style={{
              fontSize: '11px',
              color: 'oklch(56% 0.016 68)',
              border: '1px solid oklch(86% 0.012 70)',
              backgroundColor: 'oklch(99% 0.008 70)',
              padding: '3px 10px',
            }}
          >
            {domain}
          </span>
        ))}
      </div>
    </div>
  )
}
