import { queryOptions } from '@tanstack/react-query'
import { getCollFn } from '#/functions/collection.functions'

export function collectionQueryOptions(id: string) {
  return queryOptions({
    queryKey: ['collection', id],
    queryFn: () => getCollFn({ data: { id } }),
    staleTime: 1000 * 60 * 5,
  })
}
