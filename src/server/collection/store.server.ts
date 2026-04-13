import { redis } from '#/server/redis'
import type { CollectionItemInput } from '#/server/collection/contracts'

export type CollectionItem = CollectionItemInput

export interface Collection {
  id: string
  ownerToken: string
  name: string
  revision: number
  createdAt: number
  updatedAt: number
  items: CollectionItem[]
}

export type CollectionPublic = Omit<Collection, 'ownerToken'>

function colKey(id: string) {
  return `col:${id}`
}

function toPublicCollection(collection: Collection): CollectionPublic {
  const { ownerToken: _ownerToken, ...publicCollection } = collection
  return publicCollection
}

function normalizeCollectionItems(items: CollectionItem[]): CollectionItem[] {
  return [...items]
    .sort((left, right) => left.order - right.order || left.addedAt - right.addedAt)
    .map((item, index) => ({
      ...item,
      order: index,
      tags: [...new Set(item.tags.map((tag) => tag.trim()))],
    }))
}

export async function getCollection(id: string): Promise<CollectionPublic | null> {
  const col = await redis.get<Collection>(colKey(id))
  if (!col) return null
  return toPublicCollection(col)
}

export async function saveCollection(
  id: string,
  ownerToken: string,
  name: string,
  items: CollectionItem[],
): Promise<void> {
  const now = Date.now()
  const col: Collection = {
    id,
    ownerToken,
    name,
    revision: 1,
    createdAt: now,
    updatedAt: now,
    items: normalizeCollectionItems(items),
  }
  await redis.set(colKey(id), col)
}

export async function patchCollection(
  id: string,
  ownerToken: string,
  patch: Partial<Pick<Collection, 'name' | 'items'>>,
  expectedRevision?: number,
): Promise<CollectionPublic | null> {
  const current = await redis.get<Collection>(colKey(id))
  if (!current) return null

  const col: Collection = {
    ...current,
    revision: current.revision ?? 1,
  }

  if (col.ownerToken !== ownerToken) throw new Error('Unauthorized')
  if (expectedRevision !== undefined && col.revision !== expectedRevision) {
    throw new Error('Conflict')
  }

  const updated: Collection = {
    ...col,
    ...patch,
    items: patch.items ? normalizeCollectionItems(patch.items) : col.items,
    revision: col.revision + 1,
    updatedAt: Date.now(),
  }
  await redis.set(colKey(id), updated)

  return toPublicCollection(updated)
}
