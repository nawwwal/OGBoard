import { useCallback } from 'react'

function tokenKey(id: string) {
  return `col-token-${id}`
}

export function useOwnerToken(collectionId: string) {
  const getToken = useCallback((): string | null => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(tokenKey(collectionId))
  }, [collectionId])

  const saveToken = useCallback(
    (token: string) => {
      localStorage.setItem(tokenKey(collectionId), token)
    },
    [collectionId],
  )

  return { getToken, saveToken, isOwner: typeof window !== 'undefined' && !!localStorage.getItem(tokenKey(collectionId)) }
}
