import { createServerFn } from '@tanstack/react-start'
import { nanoid } from 'nanoid'
import {
  getCollection,
  saveCollection,
  patchCollection,
} from '#/server/collection/store.server'
import {
  getCollectionInputSchema,
  patchCollectionInputSchema,
  saveCollectionInputSchema,
} from '#/server/collection/contracts'

export const getCollFn = createServerFn()
  .inputValidator((data: unknown) => getCollectionInputSchema.parse(data))
  .handler(async ({ data }) => {
    return getCollection(data.id)
  })

export const saveCollFn = createServerFn()
  .inputValidator((data: unknown) => saveCollectionInputSchema.parse(data))
  .handler(async ({ data }) => {
    const id = nanoid(10)
    const ownerToken = nanoid(20)
    await saveCollection(id, ownerToken, data.name, data.items)
    return { id, ownerToken }
  })

export const patchCollFn = createServerFn()
  .inputValidator((data: unknown) => patchCollectionInputSchema.parse(data))
  .handler(async ({ data }) => {
    const patch = {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.items !== undefined ? { items: data.items } : {}),
    }

    return patchCollection(
      data.id,
      data.ownerToken,
      patch,
      data.expectedRevision,
    )
  })
