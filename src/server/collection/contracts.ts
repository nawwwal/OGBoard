import { z } from 'zod'
import type { OGResult } from '#/server/og/scrape.server'
import { normalizeUserInputUrl } from '#/lib/domain'

const normalizedUrlSchema = z
  .string()
  .min(1)
  .transform(normalizeUserInputUrl)
  .pipe(z.string().url())

const detectionSchema = z.object({
  score: z.number(),
  label: z.enum(['Dynamic', 'Build-time', 'Static', 'Unknown']),
  signals: z.array(z.string()),
})

const ogResultSchema: z.ZodType<OGResult> = z.object({
  url: normalizedUrlSchema,
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

export const collectionNameSchema = z.string().trim().min(1).max(120)

export const collectionItemSchema = z.object({
  id: z.string().min(1),
  url: normalizedUrlSchema,
  ogData: ogResultSchema,
  tags: z.array(z.string().trim().min(1).max(40)).max(20),
  order: z.number().int().nonnegative(),
  addedAt: z.number().int().nonnegative(),
})

export const collectionItemsSchema = z.array(collectionItemSchema).max(200)

export const getCollectionInputSchema = z.object({
  id: z.string().min(1),
})

export const saveCollectionInputSchema = z.object({
  name: collectionNameSchema,
  items: collectionItemsSchema,
})

export const patchCollectionInputSchema = z
  .object({
    id: z.string().min(1),
    ownerToken: z.string().min(1),
    expectedRevision: z.number().int().positive().optional(),
    name: collectionNameSchema.optional(),
    items: collectionItemsSchema.optional(),
  })
  .refine((value) => value.name !== undefined || value.items !== undefined, {
    message: 'A collection patch must include a name or items update',
  })

export type CollectionItemInput = z.infer<typeof collectionItemSchema>
export type GetCollectionInput = z.infer<typeof getCollectionInputSchema>
export type SaveCollectionInput = z.infer<typeof saveCollectionInputSchema>
export type PatchCollectionInput = z.infer<typeof patchCollectionInputSchema>
