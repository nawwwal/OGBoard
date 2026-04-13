import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import {
  getCollection,
  saveCollection,
  patchCollection,
} from '#/server/collection/store.server'
import type { CollectionItem } from '#/server/collection/store.server'
import { normalizeUserInputUrl } from '#/lib/domain'

const detectionSchema = z.object({
  score: z.number(),
  label: z.enum(['Dynamic', 'Build-time', 'Static', 'Unknown']),
  signals: z.array(z.string()),
})

const ogResultSchema = z.object({
  url: z.string().min(1).transform(normalizeUserInputUrl).pipe(z.string().url()),
  title: z.string(),
  description: z.string(),
  image: z.string(),
  siteName: z.string(),
  type: z.string(),
  twitterCard: z.string(),
  palette: z.array(z.string()),
  detection: detectionSchema,
  fetchedAt: z.number(),
  tier: z.union([z.literal(1), z.literal(2)]),
})

const collectionItemSchema = z.object({
  id: z.string().min(1),
  url: z.string().min(1).transform(normalizeUserInputUrl).pipe(z.string().url()),
  ogData: ogResultSchema.nullable(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20),
  order: z.number().int().nonnegative(),
  addedAt: z.number().int().nonnegative(),
})

export const getCollFn = createServerFn()
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data }) => {
    return getCollection(data.id)
  })

export const saveCollFn = createServerFn()
  .inputValidator((data: unknown) =>
    z
      .object({
        name: z.string().min(1).max(120),
        items: z.array(collectionItemSchema).max(200),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const id = nanoid(10)
    const ownerToken = nanoid(20)
    await saveCollection(id, ownerToken, data.name, data.items as CollectionItem[])
    return { id, ownerToken }
  })

export const patchCollFn = createServerFn()
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().min(1),
        ownerToken: z.string().min(1),
        expectedRevision: z.number().int().positive().optional(),
        name: z.string().min(1).max(120).optional(),
        items: z.array(collectionItemSchema).max(200).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const patch: Record<string, unknown> = {}
    if (data.name !== undefined) patch.name = data.name
    if (data.items !== undefined) patch.items = data.items
    return patchCollection(
      data.id,
      data.ownerToken,
      patch as Parameters<typeof patchCollection>[2],
      data.expectedRevision,
    )
  })
