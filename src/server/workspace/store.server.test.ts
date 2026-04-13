import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = new Map<string, unknown>()

vi.mock('#/server/redis', () => ({
  redis: {
    del: vi.fn(async (key: string) => (store.delete(key) ? 1 : 0)),
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: unknown) => {
      store.set(key, value)
      return 'OK'
    }),
  },
}))

import {
  createWorkspace,
  deleteWorkspace,
  getWorkspace,
  patchWorkspace,
} from '#/server/workspace/store.server'

describe('workspace store', () => {
  beforeEach(() => {
    store.clear()
  })

  it('creates and restores an owner-protected workspace', async () => {
    const created = await createWorkspace('ws1', 'secret', {
      entries: [],
      selectedUrl: null,
      urls: ['https://vercel.com/'],
    })

    expect(created.revision).toBe(1)

    await expect(getWorkspace('ws1', 'secret')).resolves.toEqual(
      expect.objectContaining({
        id: 'ws1',
        urls: ['https://vercel.com/'],
      }),
    )
  })

  it('rejects stale revisions and supports deletion', async () => {
    const created = await createWorkspace('ws1', 'secret', {
      entries: [],
      selectedUrl: null,
      urls: ['https://vercel.com/'],
    })

    await patchWorkspace(
      'ws1',
      'secret',
      {
        entries: [],
        selectedUrl: null,
        urls: ['https://github.com/'],
      },
      created.revision,
    )

    await expect(
      patchWorkspace(
        'ws1',
        'secret',
        {
          entries: [],
          selectedUrl: null,
          urls: ['https://stripe.com/'],
        },
        created.revision,
      ),
    ).rejects.toThrow('Conflict')

    await expect(deleteWorkspace('ws1', 'secret')).resolves.toBe(true)
    await expect(getWorkspace('ws1', 'secret')).resolves.toBeNull()
  })
})
