import { useMutation } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { saveCollFn } from '#/functions/collection.functions'
import type { OGResult } from '#/server/og/scrape.server'
import { nanoid } from 'nanoid'

interface Props {
  urls: string[]
  ogDataMap: Map<string, OGResult>
}

export default function SaveButton({ urls, ogDataMap }: Props) {
  const router = useRouter()

  const save = useServerFn(saveCollFn)

  const mutation = useMutation({
    mutationFn: async () => {
      const items = urls
        .filter((url) => ogDataMap.has(url))
        .map((url, index) => ({
          id: nanoid(8),
          url,
          ogData: ogDataMap.get(url)!,
          tags: [],
          order: index,
          addedAt: Date.now(),
        }))

      return save({
        data: {
          name: 'My Collection',
          items,
        },
      })
    },
    onSuccess: ({ id, ownerToken }) => {
      localStorage.setItem(`col-token-${id}`, ownerToken)
      router.navigate({ to: '/c/$id', params: { id } })
    },
  })

  const hasItems = urls.some((url) => ogDataMap.has(url))

  if (!hasItems) return null

  return (
    <button
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
      className="inline-flex items-center gap-1.5 rounded font-semibold tracking-[0.12em] uppercase"
      style={{
        fontSize: '10px',
        padding: '5px 12px',
        border: '1px solid oklch(82% 0.016 68)',
        color: 'oklch(32% 0.018 60)',
        backgroundColor: 'oklch(99% 0.008 70)',
        fontFamily: 'var(--font-sans)',
        opacity: mutation.isPending ? 0.5 : 1,
        cursor: mutation.isPending ? 'not-allowed' : 'pointer',
        transition: 'background-color 140ms ease',
      }}
      onMouseEnter={(e) => {
        if (!mutation.isPending) (e.currentTarget.style.backgroundColor = 'oklch(94% 0.010 72)')
      }}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'oklch(99% 0.008 70)')}
    >
      {mutation.isPending ? 'Saving…' : 'Save collection'}
    </button>
  )
}
