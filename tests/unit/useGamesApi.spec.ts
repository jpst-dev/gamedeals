import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type StateRef<T> = { value: T }

const globalScope = globalThis as Record<string, unknown>
const stateStore = new Map<string, StateRef<unknown>>()

const setupComposableGlobals = (fetchMock: ReturnType<typeof vi.fn>): void => {
  globalScope.$fetch = fetchMock
  globalScope.useState = <T>(key: string, init: () => T): StateRef<T> => {
    if (!stateStore.has(key)) {
      stateStore.set(key, { value: init() })
    }

    return stateStore.get(key) as StateRef<T>
  }
}

const loadApi = async () => {
  vi.resetModules()
  const module = await import('../../composables/useGamesApi')
  return module.useGamesApi()
}

beforeEach(() => {
  stateStore.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  delete globalScope.$fetch
  delete globalScope.useState
})

describe('composables/useGamesApi', () => {
  it('returns filtered lightweight suggestions and clamps limit', async () => {
    const fetchMock = vi.fn(async () => ({
      data: [
        { id: '1', slug: 'game-one', title: 'Game One', type: 'game', assets: { boxart: 'img-1' } },
        { id: '2', slug: 'bundle-pack', title: 'Bundle Pack', type: 'bundle', assets: { boxart: 'img-2' } },
        { id: '3', slug: 'dlc-one', title: 'DLC One', type: 'dlc', assets: { boxart: 'img-3' } }
      ]
    }))
    setupComposableGlobals(fetchMock)

    const api = await loadApi()
    const result = await api.searchGameSuggestions('game', 50)

    expect(result.map((item) => item.slug)).toEqual(['game-one', 'dlc-one'])
    expect(fetchMock).toHaveBeenCalledWith('/api/itad-proxy', expect.objectContaining({
      body: expect.objectContaining({
        operation: 'search',
        limit: 20
      })
    }))
  })

  it('resolves game id by exact slug', async () => {
    const fetchMock = vi.fn(async () => ({
      data: [
        { id: 'x-1', slug: 'other-game', type: 'game' },
        { id: 'x-2', slug: 'cyberpunk-2077', type: 'game' }
      ]
    }))
    setupComposableGlobals(fetchMock)

    const api = await loadApi()
    const gameId = await api.getGameIdBySlug('cyberpunk-2077')

    expect(gameId).toBe('x-2')
  })

  it('throws when slug cannot be resolved', async () => {
    const fetchMock = vi.fn(async () => ({ data: [] }))
    setupComposableGlobals(fetchMock)

    const api = await loadApi()

    await expect(api.getGameIdBySlug('missing-game')).rejects.toThrow('Game not found for this slug.')
  })

  it('caches top games by sort, limit and page', async () => {
    const fetchMock = vi.fn(async () => ({
      data: {
        list: [
          {
            id: 'g-1',
            slug: 'test-game',
            title: 'Test Game',
            type: 'game',
            assets: { boxart: 'img-1' },
            deal: {
              price: { amount: 19.9 },
              regular: { amount: 59.9 },
              cut: 67,
              shop: { name: 'Store A' },
              drm: [],
              platforms: []
            }
          }
        ],
        hasMore: true,
        nextOffset: 20
      }
    }))
    setupComposableGlobals(fetchMock)

    const api = await loadApi()
    const firstCall = await api.getTopGames(20, '-hot', 1)
    const secondCall = await api.getTopGames(20, '-hot', 1)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(firstCall.games[0]?.slug).toBe('test-game')
    expect(secondCall.games).toHaveLength(1)
  })
})
