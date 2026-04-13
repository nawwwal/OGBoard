import { queryOptions } from '@tanstack/react-query'
import { fetchOGFn } from '#/functions/og.functions'

export function ogQueryOptions(url: string) {
  return queryOptions({
    queryKey: ['og', url],
    queryFn: () => fetchOGFn({ data: { url } }),
    staleTime: 1000 * 60 * 60, // 1 hour (Redis is source of truth)
    retry: false,
    retryOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}
