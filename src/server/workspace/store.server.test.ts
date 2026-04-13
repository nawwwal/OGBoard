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
  const emptySnapshot = {
    entries: [],
    selectedUrl: null,
    urls: ['https://vercel.com/'],
    collections: [],
    activeCollectionId: null,
  }

  beforeEach(() => {
    store.clear()
  })

  it('creates and restores an owner-protected workspace', async () => {
    const created = await createWorkspace('ws1', 'secret', emptySnapshot)

    expect(created.revision).toBe(1)

    await expect(getWorkspace('ws1', 'secret')).resolves.toEqual(
      expect.objectContaining({
        id: 'ws1',
        urls: ['https://vercel.com/'],
      }),
    )
  })

  it('allows public reads without exposing the owner token', async () => {
    await createWorkspace('ws1', 'secret', {
      ...emptySnapshot,
      collections: [
        {
          id: 'col-1',
          name: 'Shared',
          color: 'oklch(50% 0.15 200)',
          urls: ['https://vercel.com/'],
        },
      ],
    })

    await expect(getWorkspace('ws1')).resolves.toEqual(
      expect.objectContaining({
        id: 'ws1',
        collections: [
          expect.objectContaining({
            id: 'col-1',
            name: 'Shared',
          }),
        ],
      }),
    )
  })

  it('rejects stale revisions and supports deletion', async () => {
    const created = await createWorkspace('ws1', 'secret', emptySnapshot)

    await patchWorkspace(
      'ws1',
      'secret',
      {
        entries: [],
        selectedUrl: null,
        urls: ['https://github.com/'],
        collections: [],
        activeCollectionId: null,
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
          collections: [],
          activeCollectionId: null,
        },
        created.revision,
      ),
    ).rejects.toThrow('Conflict')

    await expect(deleteWorkspace('ws1', 'secret')).resolves.toBe(true)
    await expect(getWorkspace('ws1', 'secret')).resolves.toBeNull()
  })

  it('normalizes collections to the current url set', async () => {
    const created = await createWorkspace('ws1', 'secret', {
      entries: [],
      selectedUrl: null,
      urls: ['https://vercel.com/'],
      collections: [
        {
          id: 'col-1',
          name: ' Shared ',
          color: 'oklch(50% 0.15 200)',
          urls: ['https://vercel.com/', 'https://stripe.com/', 'https://vercel.com/'],
        },
      ],
      activeCollectionId: 'col-1',
    })

    expect(created.collections).toEqual([
      {
        id: 'col-1',
        name: 'Shared',
        color: 'oklch(50% 0.15 200)',
        urls: ['https://vercel.com/'],
      },
    ])

    expect(created.activeCollectionId).toBe('col-1')
  })
})
