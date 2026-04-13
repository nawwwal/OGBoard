import { createServerFn } from '@tanstack/react-start'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { normalizeUserInputUrl } from '#/lib/domain'
import {
  createWorkspace,
  deleteWorkspace,
  getWorkspace,
  patchWorkspace,
} from '#/server/workspace/store.server'

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

const ogResultSchema = z.object({
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

const workspaceEntrySchema = z.object({
  url: normalizedUrlSchema,
  ogData: ogResultSchema.nullable(),
})

const workspaceCollectionSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1).max(120),
  color: z.string().min(1).max(64),
  urls: z.array(normalizedUrlSchema).max(200),
})

const workspaceSnapshotSchema = z.object({
  entries: z.array(workspaceEntrySchema).max(200),
  selectedUrl: z
    .string()
    .min(1)
    .transform(normalizeUserInputUrl)
    .pipe(z.string().url())
    .nullable(),
  urls: z.array(normalizedUrlSchema).max(200),
  collections: z.array(workspaceCollectionSchema).max(50),
  activeCollectionId: z.string().trim().min(1).nullable(),
})

export const getWorkspaceFn = createServerFn()
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().min(1),
        ownerToken: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    return getWorkspace(data.id, data.ownerToken)
  })

export const getPublicWorkspaceFn = createServerFn()
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    return getWorkspace(data.id)
  })

export const createWorkspaceFn = createServerFn()
  .inputValidator((data: unknown) =>
    z.object({ snapshot: workspaceSnapshotSchema }).parse(data),
  )
  .handler(async ({ data }) => {
    const id = nanoid(10)
    const ownerToken = nanoid(20)
    const workspace = await createWorkspace(id, ownerToken, data.snapshot)
    return { id, ownerToken, workspace }
  })

export const patchWorkspaceFn = createServerFn()
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().min(1),
        ownerToken: z.string().min(1),
        expectedRevision: z.number().int().positive().optional(),
        snapshot: workspaceSnapshotSchema,
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    return patchWorkspace(
      data.id,
      data.ownerToken,
      data.snapshot,
      data.expectedRevision,
    )
  })

export const deleteWorkspaceFn = createServerFn()
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().min(1),
        ownerToken: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    return deleteWorkspace(data.id, data.ownerToken)
  })
