import { createFileRoute, notFound } from '@tanstack/react-router'
import { useSuspenseQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { collectionQueryOptions } from '#/queries/collection.queries'
import { useOwnerToken } from '#/hooks/useOwnerToken'
import { useBulkOGFetch } from '#/hooks/useBulkOGFetch'
import StickyInputBar from '#/components/layout/StickyInputBar'
import SortableGrid from '#/components/grid/SortableGrid'
import MasonryGrid from '#/components/grid/MasonryGrid'
import OGCard from '#/components/cards/OGCard'
import DetailDrawer from '#/components/layout/DetailDrawer'
import ShareBar from '#/components/collection/ShareBar'
import { patchCollFn } from '#/functions/collection.functions'
import { useServerFn } from '@tanstack/react-start'
import { nanoid } from 'nanoid'
import type { OGResult } from '#/server/og/scrape.server'

export const Route = createFileRoute('/c/$id')({
  loader: async ({ params, context: { queryClient } }) => {
    const data = await queryClient.ensureQueryData(collectionQueryOptions(params.id))
    if (!data) throw notFound()
  },
  component: CollectionPage,
  notFoundComponent: () => (
    <div className="flex min-h-[60vh] items-center justify-center">
      <p style={{ fontSize: '13px', color: 'oklch(56% 0.016 68)', fontFamily: 'var(--font-sans)' }}>
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
    mutationFn: (args: Parameters<typeof patch>[0]['data']) =>
      patch({ data: args }),
    onSuccess: (updatedCollection) => {
      if (updatedCollection) {
        queryClient.setQueryData(collectionQueryOptions(id).queryKey, updatedCollection)
      } else {
        queryClient.invalidateQueries({ queryKey: ['collection', id] })
      }
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ['collection', id] })
    },
  })

  if (!collection) return null

  const { items } = collection

  async function handleAddUrls(urls: string[]) {
    const token = getToken()
    if (!token || !isOwner) return
    const uniqueUrls = urls.filter((url) => !items.some((i) => i.url === url))
    if (uniqueUrls.length === 0) return

    const fetched = await fetchBulk(uniqueUrls)
    const newItems = uniqueUrls
      .filter((url) => fetched.has(url))
      .filter((url) => !items.some((i) => i.url === url))
      .map((url, idx) => ({
        id: nanoid(8),
        url,
        ogData: fetched.get(url) ?? null,
        tags: [],
        order: items.length + idx,
        addedAt: Date.now(),
      }))
    if (newItems.length === 0) return

    try {
      await mutation.mutateAsync({
        id,
        ownerToken: token,
        expectedRevision: collection.revision,
        items: [...items, ...newItems],
      })
    } catch {
      // The mutation state handles recovery by invalidating the collection query.
    }
  }

  function handleReorder(orderedIds: string[]) {
    const token = getToken()
    if (!token) return
    const reordered = orderedIds.map((itemId, index) => {
      const item = items.find((i) => i.id === itemId)!
      return { ...item, order: index }
    })
    // Optimistic update
    queryClient.setQueryData(collectionQueryOptions(id).queryKey, (old: typeof collection) =>
      old ? { ...old, items: reordered } : old,
    )
    mutation.mutate({
      id,
      ownerToken: token,
      expectedRevision: collection.revision,
      items: reordered,
    })
  }

  function handleTagAdd(itemId: string, tag: string) {
    const token = getToken()
    if (!token) return
    const updated = items.map((i) =>
      i.id === itemId ? { ...i, tags: [...i.tags, tag] } : i,
    )
    mutation.mutate({
      id,
      ownerToken: token,
      expectedRevision: collection.revision,
      items: updated,
    })
  }

  function handleTagRemove(itemId: string, tag: string) {
    const token = getToken()
    if (!token) return
    const updated = items.map((i) =>
      i.id === itemId ? { ...i, tags: i.tags.filter((t) => t !== tag) } : i
    )
    mutation.mutate({
      id,
      ownerToken: token,
      expectedRevision: collection.revision,
      items: updated,
    })
  }

  const sortedItems = [...items].sort((a, b) => a.order - b.order)
  const selectedItem = selectedItemId
    ? sortedItems.find((item) => item.id === selectedItemId) ?? null
    : null

  return (
    <>
      {isOwner && (
        <StickyInputBar
          onFetch={handleAddUrls}
          progress={progress}
          placeholder="Add URLs to this collection"
        />
      )}

      <ShareBar
        collectionId={id}
        collectionName={collection.name}
        isOwner={isOwner}
        itemCount={items.length}
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
              <div key={item.id} className="mb-4">
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
