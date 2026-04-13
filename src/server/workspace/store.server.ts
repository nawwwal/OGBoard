import { redis } from '#/server/redis'
import type { OGResult } from '#/server/og/scrape.server'

export interface WorkspaceEntry {
  url: string
  ogData: OGResult | null
}

export interface WorkspaceSnapshot {
  entries: WorkspaceEntry[]
  selectedUrl: string | null
  urls: string[]
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

export async function getWorkspace(
  id: string,
  ownerToken: string,
): Promise<HomeWorkspacePublic | null> {
  const workspace = await redis.get<HomeWorkspace>(workspaceKey(id))
  if (!workspace) return null
  if (workspace.ownerToken !== ownerToken) throw new Error('Unauthorized')

  const { ownerToken: _ownerToken, ...publicWorkspace } = workspace
  return publicWorkspace
}

export async function createWorkspace(
  id: string,
  ownerToken: string,
  snapshot: WorkspaceSnapshot,
): Promise<HomeWorkspacePublic> {
  const now = Date.now()
  const workspace: HomeWorkspace = {
    id,
    ownerToken,
    revision: 1,
    createdAt: now,
    updatedAt: now,
    ...snapshot,
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

  const updated: HomeWorkspace = {
    ...current,
    ...snapshot,
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
