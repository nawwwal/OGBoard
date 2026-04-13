import { useCallback, useEffect, useState } from 'react'
import { nanoid } from 'nanoid'

export const CHIP_COLORS = [
  'oklch(50% 0.18 25)',   // red
  'oklch(52% 0.17 42)',   // orange
  'oklch(50% 0.16 130)',  // green
  'oklch(50% 0.15 200)',  // teal
  'oklch(50% 0.15 260)',  // indigo
  'oklch(50% 0.16 310)',  // purple
  'oklch(50% 0.15 330)',  // pink
  'oklch(48% 0.13 60)',   // gold
]

export interface UserCollection {
  id: string
  name: string
  color: string
  urls: string[]
}

export const SYSTEM_COLLECTION_DYNAMIC = 'sys:dynamic'
export const SYSTEM_COLLECTION_STATIC = 'sys:static'

const STORAGE_KEY = 'ogboard:collections'

function load(): UserCollection[] {
  if (typeof window === 'undefined') return []

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []

    return parsed.flatMap((value): UserCollection[] => {
      if (
        !value ||
        typeof value !== 'object' ||
        typeof value.id !== 'string' ||
        typeof value.name !== 'string' ||
        typeof value.color !== 'string' ||
        !Array.isArray(value.urls)
      ) {
        return []
      }

      const urls = (value.urls as unknown[]).filter(
        (url): url is string => typeof url === 'string',
      )
      return [
        {
          id: value.id,
          name: value.name.trim(),
          color: value.color,
          urls: [...new Set(urls)],
        },
      ]
    })
  } catch {
    return []
  }
}

function persist(collections: UserCollection[]) {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collections))
  } catch {
    // Ignore quota and privacy-mode write failures.
  }
}

export function useLocalCollections() {
  const [collections, setCollections] = useState<UserCollection[]>(load)

  useEffect(() => {
    persist(collections)
  }, [collections])

  const updateCollections = useCallback(
    (updater: (current: UserCollection[]) => UserCollection[]) => {
      setCollections((current) => updater(current))
    },
    [],
  )

  const createCollection = useCallback(
    (name: string, color?: string): UserCollection => {
      const trimmedName = name.trim()
      let created!: UserCollection

      updateCollections((current) => {
        created = {
          id: nanoid(8),
          name: trimmedName,
          color: color ?? CHIP_COLORS[current.length % CHIP_COLORS.length],
          urls: [],
        }

        return [...current, created]
      })

      return created
    },
    [updateCollections],
  )

  const addUrl = useCallback((collectionId: string, url: string) => {
    updateCollections((current) =>
      current.map((collection) =>
        collection.id === collectionId && !collection.urls.includes(url)
          ? { ...collection, urls: [...collection.urls, url] }
          : collection,
      ),
    )
  }, [updateCollections])

  const removeUrl = useCallback((collectionId: string, url: string) => {
    updateCollections((current) =>
      current.map((collection) =>
        collection.id === collectionId
          ? { ...collection, urls: collection.urls.filter((currentUrl) => currentUrl !== url) }
          : collection,
      ),
    )
  }, [updateCollections])

  const deleteCollection = useCallback((collectionId: string) => {
    updateCollections((current) =>
      current.filter((collection) => collection.id !== collectionId),
    )
  }, [updateCollections])

  const renameCollection = useCallback((collectionId: string, newName: string) => {
    const trimmedName = newName.trim()
    if (!trimmedName) return

    updateCollections((current) =>
      current.map((collection) =>
        collection.id === collectionId
          ? { ...collection, name: trimmedName }
          : collection,
      ),
    )
  }, [updateCollections])

  return { collections, createCollection, addUrl, removeUrl, deleteCollection, renameCollection }
}
