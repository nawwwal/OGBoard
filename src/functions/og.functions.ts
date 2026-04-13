import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { fetchOG } from '#/server/og/scrape.server'
import { assertPublicHttpUrl } from '#/server/og/url-policy.server'

export const fetchOGFn = createServerFn()
  .inputValidator((data: unknown) =>
    z.object({ url: z.string().min(1, 'Invalid URL') }).parse(data),
  )
  .handler(async ({ data }) => {
    const url = await assertPublicHttpUrl(data.url)
    return fetchOG(url)
  })
