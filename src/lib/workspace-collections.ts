export const CHIP_COLORS = [
  'oklch(50% 0.18 25)',
  'oklch(52% 0.17 42)',
  'oklch(50% 0.16 130)',
  'oklch(50% 0.15 200)',
  'oklch(50% 0.15 260)',
  'oklch(50% 0.16 310)',
  'oklch(50% 0.15 330)',
  'oklch(48% 0.13 60)',
] as const

export interface WorkspaceCollection {
  id: string
  name: string
  color: string
  urls: string[]
}

export type UserCollection = WorkspaceCollection

export const SYSTEM_COLLECTION_DYNAMIC = 'sys:dynamic'
export const SYSTEM_COLLECTION_STATIC = 'sys:static'

export function normalizeCollections(
  collections: WorkspaceCollection[],
): WorkspaceCollection[] {
  const seenIds = new Set<string>()

  return collections.flatMap((collection) => {
    const id = collection.id.trim()
    const name = collection.name.trim()

    if (!id || !name || seenIds.has(id)) return []
    seenIds.add(id)

    return [
      {
        id,
        name,
        color: collection.color,
        urls: [...new Set(collection.urls)],
      },
    ]
  })
}
