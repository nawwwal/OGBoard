import { redis } from '#/server/redis'
import type { OGResult } from '#/server/og/scrape.server'

export interface CollectionItem {
  id: string
  url: string
  ogData: OGResult
  tags: string[]
  order: number
  addedAt: number
}

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

function colKey(id: string) { return `col:${id}` }

export async function getCollection(id: string): Promise<CollectionPublic | null> {
  const col = await redis.get<Collection>(colKey(id))
  if (!col) return null
  const { ownerToken: _stripped, ...pub } = col
  return pub
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
    items,
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
    revision: col.revision + 1,
    updatedAt: Date.now(),
  }
  await redis.set(colKey(id), updated)

  const { ownerToken: _stripped, ...pub } = updated
  return pub
}
