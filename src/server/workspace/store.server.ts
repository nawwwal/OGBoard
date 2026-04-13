import { redis } from '#/server/redis'
import {
  normalizeCollections,
  SYSTEM_COLLECTION_DYNAMIC,
  SYSTEM_COLLECTION_STATIC,
  type WorkspaceCollection,
} from '#/lib/workspace-collections'
import type { OGResult } from '#/server/og/scrape.server'

export interface WorkspaceEntry {
  url: string
  ogData: OGResult | null
}

export interface WorkspaceSnapshot {
  entries: WorkspaceEntry[]
  selectedUrl: string | null
  urls: string[]
  collections: WorkspaceCollection[]
  activeCollectionId: string | null
}

export interface HomeWorkspace extends WorkspaceSnapshot {
  id: string
  ownerToken: string
  revision: number
  createdAt: number
  updatedAt: number
}

export type HomeWorkspacePublic = Omit<HomeWorkspace, 'ownerToken'>

function workspaceKey(id: string) {
  return `ws:${id}`
}

function normalizeWorkspaceSnapshot(snapshot: WorkspaceSnapshot): WorkspaceSnapshot {
  const urls = [...new Set(snapshot.urls)]
  const urlSet = new Set(urls)
  const entryMap = new Map(snapshot.entries.map((entry) => [entry.url, entry]))
  const collections = normalizeCollections(snapshot.collections).map((collection) => ({
    ...collection,
    urls: collection.urls.filter((url) => urlSet.has(url)),
  }))
  const activeCollectionId =
    snapshot.activeCollectionId === SYSTEM_COLLECTION_DYNAMIC ||
    snapshot.activeCollectionId === SYSTEM_COLLECTION_STATIC ||
    collections.some((collection) => collection.id === snapshot.activeCollectionId)
      ? snapshot.activeCollectionId
      : null

  return {
    urls,
    selectedUrl:
      snapshot.selectedUrl && urlSet.has(snapshot.selectedUrl)
        ? snapshot.selectedUrl
        : null,
    entries: urls.map((url) => ({
      url,
      ogData: entryMap.get(url)?.ogData ?? null,
    })),
    collections,
    activeCollectionId,
  }
}

export async function getWorkspace(
  id: string,
  ownerToken?: string,
): Promise<HomeWorkspacePublic | null> {
  const workspace = await redis.get<HomeWorkspace>(workspaceKey(id))
  if (!workspace) return null
  if (ownerToken !== undefined && workspace.ownerToken !== ownerToken) {
    throw new Error('Unauthorized')
  }

  const { ownerToken: _ownerToken, ...publicWorkspace } = workspace
  return publicWorkspace
}

export async function createWorkspace(
  id: string,
  ownerToken: string,
  snapshot: WorkspaceSnapshot,
): Promise<HomeWorkspacePublic> {
  const now = Date.now()
  const normalizedSnapshot = normalizeWorkspaceSnapshot(snapshot)
  const workspace: HomeWorkspace = {
    id,
    ownerToken,
    revision: 1,
    createdAt: now,
    updatedAt: now,
    ...normalizedSnapshot,
  }

  await redis.set(workspaceKey(id), workspace)
  const { ownerToken: _ownerToken, ...publicWorkspace } = workspace
  return publicWorkspace
}

export async function patchWorkspace(
  id: string,
  ownerToken: string,
  snapshot: WorkspaceSnapshot,
  expectedRevision?: number,
): Promise<HomeWorkspacePublic | null> {
  const current = await redis.get<HomeWorkspace>(workspaceKey(id))
  if (!current) return null
  if (current.ownerToken !== ownerToken) throw new Error('Unauthorized')
  if (expectedRevision !== undefined && current.revision !== expectedRevision) {
    throw new Error('Conflict')
  }

  const normalizedSnapshot = normalizeWorkspaceSnapshot(snapshot)
  const updated: HomeWorkspace = {
    ...current,
    ...normalizedSnapshot,
    revision: current.revision + 1,
    updatedAt: Date.now(),
  }

  await redis.set(workspaceKey(id), updated)
  const { ownerToken: _ownerToken, ...publicWorkspace } = updated
  return publicWorkspace
}

export async function deleteWorkspace(
  id: string,
  ownerToken: string,
): Promise<boolean> {
  const current = await redis.get<HomeWorkspace>(workspaceKey(id))
  if (!current) return false
  if (current.ownerToken !== ownerToken) throw new Error('Unauthorized')

  await redis.del(workspaceKey(id))
  return true
}
