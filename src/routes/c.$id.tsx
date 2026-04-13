import { createFileRoute, notFound } from '@tanstack/react-router'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { nanoid } from 'nanoid'
import StickyInputBar from '#/components/layout/StickyInputBar'
import SortableGrid from '#/components/grid/SortableGrid'
import MasonryGrid from '#/components/grid/MasonryGrid'
import OGCard from '#/components/cards/OGCard'
import DetailDrawer from '#/components/layout/DetailDrawer'
import ShareBar from '#/components/collection/ShareBar'
import { patchCollFn } from '#/functions/collection.functions'
import { useOwnerToken } from '#/hooks/useOwnerToken'
import { useBulkOGFetch } from '#/hooks/useBulkOGFetch'
import { collectionQueryOptions } from '#/queries/collection.queries'
import type { PatchCollectionInput } from '#/server/collection/contracts'
import type { CollectionItem, CollectionPublic } from '#/server/collection/store.server'

export const Route = createFileRoute('/c/$id')({
  loader: async ({ params, context: { queryClient } }) => {
    const data = await queryClient.ensureQueryData(collectionQueryOptions(params.id))
    if (!data) throw notFound()
  },
  component: CollectionPage,
  notFoundComponent: () => (
    <div className="flex min-h-[60vh] items-center justify-center">
      <p
        style={{
          fontSize: '13px',
          color: 'oklch(56% 0.016 68)',
          fontFamily: 'var(--font-sans)',
        }}
      >
        Collection not found
      </p>
    </div>
  ),
})

function CollectionPage() {
  const { id } = Route.useParams()
  const queryClient = useQueryClient()
  const { data: collection } = useSuspenseQuery(collectionQueryOptions(id))
  const { isOwner, getToken } = useOwnerToken(id)
  const { fetchBulk, progress } = useBulkOGFetch()
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const patch = useServerFn(patchCollFn)

  const mutation = useMutation({
    mutationFn: (data: PatchCollectionInput) => patch({ data }),
    onSuccess: (updatedCollection) => {
      if (updatedCollection) {
        queryClient.setQueryData(collectionQueryOptions(id).queryKey, updatedCollection)
        return
      }

      void queryClient.invalidateQueries({ queryKey: ['collection', id] })
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: ['collection', id] })
    },
  })

  if (!collection) return null
  const collectionQueryKey = collectionQueryOptions(id).queryKey
  const collectionData = collection

  function getCurrentCollection(): CollectionPublic {
    return (
      queryClient.getQueryData<CollectionPublic | null>(collectionQueryKey) ??
      collectionData
    )
  }

  function setCachedCollection(
    updater: (current: CollectionPublic) => CollectionPublic,
  ) {
    queryClient.setQueryData<CollectionPublic | null | undefined>(
      collectionQueryKey,
      (current) => (current ? updater(current) : current),
    )
  }

  async function handleAddUrls(urls: string[]) {
    const token = getToken()
    if (!token || !isOwner) return

    const current = getCurrentCollection()
    const existingUrls = new Set(current.items.map((item) => item.url))
    const uniqueUrls = urls.filter((url) => !existingUrls.has(url))
    if (uniqueUrls.length === 0) return

    const fetched = await fetchBulk(uniqueUrls)
    const addedAtBase = Date.now()
    const newItems = uniqueUrls.flatMap((url, index): CollectionItem[] => {
      const ogData = fetched.get(url)
      if (!ogData) return []

      return [
        {
          id: nanoid(8),
          url,
          ogData,
          tags: [],
          order: current.items.length + index,
          addedAt: addedAtBase + index,
        },
      ]
    })

    if (newItems.length === 0) return

    try {
      await mutation.mutateAsync({
        id,
        ownerToken: token,
        expectedRevision: current.revision,
        items: [...current.items, ...newItems],
      })
    } catch {
      // The mutation already restores the latest collection state on error.
    }
  }

  function handleReorder(orderedIds: string[]) {
    const token = getToken()
    if (!token) return

    const current = getCurrentCollection()
    const reordered: CollectionItem[] = []

    for (const [index, itemId] of orderedIds.entries()) {
      const item = current.items.find((candidate) => candidate.id === itemId)
      if (!item) return

      reordered.push({ ...item, order: index })
    }

    setCachedCollection((cached) => ({
      ...cached,
      items: reordered,
      revision: current.revision + 1,
      updatedAt: Date.now(),
    }))

    mutation.mutate(
      {
        id,
        ownerToken: token,
        expectedRevision: current.revision,
        items: reordered,
      },
      {
        onError: () => {
          queryClient.setQueryData(collectionQueryKey, current)
        },
      },
    )
  }

  const sortedItems = [...collectionData.items].sort(
    (left, right) => left.order - right.order,
  )
  const selectedItem = selectedItemId
    ? sortedItems.find((item) => item.id === selectedItemId) ?? null
    : null

  return (
    <>
      {isOwner && (
        <StickyInputBar
          onFetch={handleAddUrls}
          progress={progress}
          disabled={mutation.isPending}
          placeholder="Add URLs to this collection"
        />
      )}

      <ShareBar
        collectionId={id}
        collectionName={collectionData.name}
        isOwner={isOwner}
        itemCount={collectionData.items.length}
      />

      <main className="px-4 py-6 mx-auto max-w-6xl">
        {isOwner ? (
          <SortableGrid
            items={sortedItems.map((item) => ({
              id: item.id,
              children: (
                <OGCard
                  url={item.url}
                  tags={item.tags}
                  onSelect={() => setSelectedItemId(item.id)}
                  isSelected={selectedItemId === item.id}
                  showTags
                  snapshotData={item.ogData}
                />
              ),
            }))}
            onReorder={handleReorder}
          />
        ) : (
          <MasonryGrid>
            {sortedItems.map((item) => (
              <div key={item.id}>
                <OGCard
                  url={item.url}
                  tags={item.tags}
                  onSelect={() => setSelectedItemId(item.id)}
                  isSelected={selectedItemId === item.id}
                  showTags
                  snapshotData={item.ogData}
                />
              </div>
            ))}
          </MasonryGrid>
        )}
      </main>

      <DetailDrawer
        url={selectedItem?.url ?? null}
        snapshotData={selectedItem?.ogData ?? null}
        onClose={() => setSelectedItemId(null)}
      />
    </>
  )
}
