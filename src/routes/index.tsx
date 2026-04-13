import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { ogQueryOptions } from '#/queries/og.queries'
import {
  createWorkspaceFn,
  deleteWorkspaceFn,
  getWorkspaceFn,
  patchWorkspaceFn,
} from '#/functions/workspace.functions'
import { useBulkOGFetch } from '#/hooks/useBulkOGFetch'
import StickyInputBar from '#/components/layout/StickyInputBar'
import MasonryGrid from '#/components/grid/MasonryGrid'
import OGCard from '#/components/cards/OGCard'
import DetailDrawer from '#/components/layout/DetailDrawer'
import SaveButton from '#/components/collection/SaveButton'
import type { OGResult } from '#/server/og/scrape.server'

export const Route = createFileRoute('/')({
  component: HomePage,
})

const HOME_WORKSPACE_STORAGE_KEY = 'og-home-workspace-v1'

interface PersistedWorkspaceBackendMeta {
  id: string
  ownerToken: string
  revision: number
  updatedAt: number
}

interface PersistedWorkspace {
  backend: PersistedWorkspaceBackendMeta | null
  entries: Array<{ ogData: OGResult; url: string }>
  selectedUrl: string | null
  urls: string[]
  version: 1
}

function readPersistedWorkspace(): PersistedWorkspace | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(HOME_WORKSPACE_STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as PersistedWorkspace
    if (parsed.version !== 1 || !Array.isArray(parsed.urls) || !Array.isArray(parsed.entries)) {
      window.localStorage.removeItem(HOME_WORKSPACE_STORAGE_KEY)
      return null
    }

    return {
      ...parsed,
      backend: parsed.backend ?? null,
    }
  } catch {
    window.localStorage.removeItem(HOME_WORKSPACE_STORAGE_KEY)
    return null
  }
}

function HomePage() {
  const [urls, setUrls] = useState<string[]>([])
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null)
  const [hasRestoredWorkspace, setHasRestoredWorkspace] = useState(false)
  const [workspaceMeta, setWorkspaceMeta] = useState<PersistedWorkspaceBackendMeta | null>(null)
  const queryClient = useQueryClient()
  const { fetchBulk, progress } = useBulkOGFetch()
  const restoredRef = useRef(false)
  const createWorkspace = useServerFn(createWorkspaceFn)
  const getWorkspace = useServerFn(getWorkspaceFn)
  const patchWorkspace = useServerFn(patchWorkspaceFn)
  const deleteWorkspace = useServerFn(deleteWorkspaceFn)
  const isSavingRef = useRef(false)
  const pendingSaveRef = useRef(false)
  const latestWorkspaceRef = useRef<PersistedWorkspace | null>(null)

  function hydrateWorkspace(workspace: PersistedWorkspace) {
    for (const entry of workspace.entries) {
      queryClient.setQueryData(ogQueryOptions(entry.url).queryKey, entry.ogData)
    }

    setUrls(workspace.urls)
    setSelectedUrl(
      workspace.selectedUrl && workspace.urls.includes(workspace.selectedUrl)
        ? workspace.selectedUrl
        : null,
    )
    setWorkspaceMeta(workspace.backend)
  }

  function handleFetch(newUrls: string[]) {
    const unique = newUrls.filter((u) => !urls.includes(u))
    if (unique.length === 0) return
    setUrls((prev) => [...prev, ...unique])
    fetchBulk(unique)
  }

  const ogDataMap = useMemo(() => {
    const map = new Map<string, OGResult>()
    for (const url of urls) {
      const cached = queryClient.getQueryData<OGResult>(ogQueryOptions(url).queryKey)
      if (cached) map.set(url, cached)
    }
    return map
  }, [urls, queryClient, progress.completed])

  useEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true

    const persisted = readPersistedWorkspace()
    if (persisted) {
      hydrateWorkspace(persisted)
    }
    setHasRestoredWorkspace(true)
  }, [queryClient])

  useEffect(() => {
    if (!hasRestoredWorkspace || !workspaceMeta) return

    let cancelled = false

    void (async () => {
      try {
        const serverWorkspace = await getWorkspace({
          data: {
            id: workspaceMeta.id,
            ownerToken: workspaceMeta.ownerToken,
          },
        })

        if (!serverWorkspace || cancelled) return
        if (serverWorkspace.updatedAt <= workspaceMeta.updatedAt) return

        hydrateWorkspace({
          version: 1,
          backend: {
            id: workspaceMeta.id,
            ownerToken: workspaceMeta.ownerToken,
            revision: serverWorkspace.revision,
            updatedAt: serverWorkspace.updatedAt,
          },
          entries: serverWorkspace.entries.flatMap((entry) =>
            entry.ogData ? [{ url: entry.url, ogData: entry.ogData }] : [],
          ),
          selectedUrl: serverWorkspace.selectedUrl,
          urls: serverWorkspace.urls,
        })
      } catch {
        // Keep the latest local snapshot if the backend draft can't be restored.
      }
    })()

    return () => {
      cancelled = true
    }
  }, [getWorkspace, hasRestoredWorkspace, queryClient, workspaceMeta])

  useEffect(() => {
    if (!hasRestoredWorkspace || typeof window === 'undefined') return

    const payload: PersistedWorkspace = {
      version: 1,
      backend: workspaceMeta,
      urls,
      selectedUrl: selectedUrl && urls.includes(selectedUrl) ? selectedUrl : null,
      entries: urls.flatMap((url) => {
        const ogData = ogDataMap.get(url)
        return ogData ? [{ url, ogData }] : []
      }),
    }
    latestWorkspaceRef.current = payload

    if (urls.length === 0 && !workspaceMeta) {
      window.localStorage.removeItem(HOME_WORKSPACE_STORAGE_KEY)
      return
    }

    window.localStorage.setItem(HOME_WORKSPACE_STORAGE_KEY, JSON.stringify(payload))
  }, [hasRestoredWorkspace, ogDataMap, selectedUrl, urls, workspaceMeta])

  useEffect(() => {
    if (!hasRestoredWorkspace || urls.length === 0) return

    const timeout = window.setTimeout(() => {
      void persistWorkspace()
    }, 800)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [hasRestoredWorkspace, ogDataMap, selectedUrl, urls])

  async function persistWorkspace() {
    const snapshot = latestWorkspaceRef.current
    if (!snapshot || snapshot.urls.length === 0) return

    if (isSavingRef.current) {
      pendingSaveRef.current = true
      return
    }

    isSavingRef.current = true

    try {
      if (!snapshot.backend) {
        const created = await createWorkspace({
          data: {
            snapshot: {
              entries: snapshot.urls.map((url) => ({
                url,
                ogData: snapshot.entries.find((entry) => entry.url === url)?.ogData ?? null,
              })),
              selectedUrl: snapshot.selectedUrl,
              urls: snapshot.urls,
            },
          },
        })

        const backend = {
          id: created.id,
          ownerToken: created.ownerToken,
          revision: created.workspace.revision,
          updatedAt: created.workspace.updatedAt,
        }

        latestWorkspaceRef.current = {
          ...snapshot,
          backend,
        }
        setWorkspaceMeta(backend)
      } else {
        const updated = await patchWorkspace({
          data: {
            id: snapshot.backend.id,
            ownerToken: snapshot.backend.ownerToken,
            expectedRevision: snapshot.backend.revision,
            snapshot: {
              entries: snapshot.urls.map((url) => ({
                url,
                ogData: snapshot.entries.find((entry) => entry.url === url)?.ogData ?? null,
              })),
              selectedUrl: snapshot.selectedUrl,
              urls: snapshot.urls,
            },
          },
        })

        if (updated) {
          const backend = {
            id: snapshot.backend.id,
            ownerToken: snapshot.backend.ownerToken,
            revision: updated.revision,
            updatedAt: updated.updatedAt,
          }

          latestWorkspaceRef.current = {
            ...snapshot,
            backend,
          }
          setWorkspaceMeta(backend)
        }
      }
    } catch {
      // Keep local persistence even if backend draft sync fails temporarily.
    } finally {
      isSavingRef.current = false

      if (pendingSaveRef.current) {
        pendingSaveRef.current = false
        void persistWorkspace()
      }
    }
  }

  async function handleClear() {
    const meta = workspaceMeta

    setUrls([])
    setSelectedUrl(null)
    setWorkspaceMeta(null)
    latestWorkspaceRef.current = null

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(HOME_WORKSPACE_STORAGE_KEY)
    }

    if (!meta) return

    try {
      await deleteWorkspace({
        data: {
          id: meta.id,
          ownerToken: meta.ownerToken,
        },
      })
    } catch {
      // The local workspace is already cleared; ignore backend cleanup failures.
    }
  }

  return (
    <>
      <StickyInputBar onFetch={handleFetch} progress={progress} />

      <main className="px-5 py-6 mx-auto max-w-6xl">
        {hasRestoredWorkspace && urls.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex items-center justify-between mb-5">
              <p
                className="font-semibold tracking-[0.12em] uppercase"
                style={{ fontSize: '10px', color: 'oklch(56% 0.016 68)', fontFamily: 'var(--font-sans)' }}
              >
                {urls.length} {urls.length === 1 ? 'URL' : 'URLs'}
                {progress.inProgress && (
                  <span style={{ color: 'oklch(50% 0.19 55)', marginLeft: '8px' }}>
                    {progress.completed}/{progress.total} fetched
                  </span>
                )}
              </p>
              <div className="flex items-center gap-3">
                <SaveButton urls={urls} ogDataMap={ogDataMap} />
                <button
                  onClick={() => {
                    void handleClear()
                  }}
                  className="font-semibold tracking-[0.12em] uppercase transition-opacity"
                  style={{
                    fontSize: '10px',
                    color: 'oklch(60% 0.014 68)',
                    fontFamily: 'var(--font-sans)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'oklch(40% 0.016 65)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'oklch(60% 0.014 68)')}
                >
                  Clear
                </button>
              </div>
            </div>

            <MasonryGrid>
              {urls.map((url) => (
                <div key={url} className="mb-4">
                  <OGCard
                    url={url}
                    onSelect={() => setSelectedUrl(url)}
                    isSelected={selectedUrl === url}
                    snapshotData={ogDataMap.get(url) ?? null}
                  />
                </div>
              ))}
            </MasonryGrid>
          </>
        )}
      </main>

      <DetailDrawer
        url={selectedUrl}
        snapshotData={selectedUrl ? ogDataMap.get(selectedUrl) ?? null : null}
        onClose={() => setSelectedUrl(null)}
      />
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
