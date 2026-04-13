import { useCallback, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import PQueue from 'p-queue'
import { ogQueryOptions } from '#/queries/og.queries'
import { extractDomain } from '#/lib/domain'
import { CONCURRENCY, INTER_DOMAIN_DELAY_MS } from '#/lib/constants'
import type { OGResult } from '#/server/og/scrape.server'

export interface BulkProgress {
  total: number
  completed: number
  failed: number
  inProgress: boolean
}

export function useBulkOGFetch() {
  const queryClient = useQueryClient()
  const [progress, setProgress] = useState<BulkProgress>({
    total: 0,
    completed: 0,
    failed: 0,
    inProgress: false,
  })
  const lastDomainTime = useRef<Map<string, number>>(new Map())

  const fetchBulk = useCallback(
    async (urls: string[]) => {
      if (urls.length === 0) return

      const queue = new PQueue({ concurrency: CONCURRENCY })
      const results = new Map<string, OGResult>()
      setProgress({ total: urls.length, completed: 0, failed: 0, inProgress: true })

      let completed = 0
      let failed = 0

      for (const url of urls) {
        queue.add(async () => {
          // Per-domain rate limiting
          const domain = extractDomain(url)
          const lastTime = lastDomainTime.current.get(domain) ?? 0
          const elapsed = Date.now() - lastTime
          if (elapsed < INTER_DOMAIN_DELAY_MS) {
            await new Promise((r) =>
              setTimeout(r, INTER_DOMAIN_DELAY_MS - elapsed),
            )
          }
          lastDomainTime.current.set(domain, Date.now())

          try {
            const data = await queryClient.fetchQuery(ogQueryOptions(url))
            results.set(url, data)
            completed++
          } catch {
            failed++
          }
          setProgress({
            total: urls.length,
            completed,
            failed,
            inProgress: completed + failed < urls.length,
          })
        })
      }

      await queue.onIdle()
      setProgress((p) => ({ ...p, inProgress: false }))
      return results
    },
    [queryClient],
  )

  return { fetchBulk, progress }
}
