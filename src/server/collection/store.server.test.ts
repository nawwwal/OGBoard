import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = new Map<string, unknown>()

vi.mock('#/server/redis', () => ({
  redis: {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: unknown) => {
      store.set(key, value)
      return 'OK'
    }),
  },
}))

import { getCollection, patchCollection, saveCollection } from '#/server/collection/store.server'

describe('collection store', () => {
  beforeEach(() => {
    store.clear()
  })

  it('strips owner token from public reads', async () => {
    await saveCollection('abc', 'secret', 'Test', [])
    await expect(getCollection('abc')).resolves.toEqual(
      expect.objectContaining({
        id: 'abc',
        name: 'Test',
      }),
    )
  })

  it('rejects stale writes with a conflict error', async () => {
    await saveCollection('abc', 'secret', 'Test', [])
    const publicCollection = await getCollection('abc')
    expect(publicCollection).not.toBeNull()

    await patchCollection('abc', 'secret', { name: 'Updated' }, publicCollection!.revision)

    await expect(
      patchCollection('abc', 'secret', { name: 'Stale' }, publicCollection!.revision),
    ).rejects.toThrow('Conflict')
  })
})
