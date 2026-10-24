import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_CATALOG_STATE } from '../../utils/catalog'

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

const loadModule = async () => {
  vi.resetModules()
  return await import('../../composables/useGamesApi')
}

const loadApi = async () => (await loadModule()).useGamesApi()

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
    const fetchMock = vi.fn(async () => ([
      { id: '1', slug: 'game-one', title: 'Game One', type: 'game', assets: { boxart: 'img-1' } },
      { id: '2', slug: 'bundle-pack', title: 'Bundle Pack', type: 'bundle', assets: { boxart: 'img-2' } },
      { id: '3', slug: 'dlc-one', title: 'DLC One', type: 'dlc', assets: { boxart: 'img-3' } }
    ]))
    setupComposableGlobals(fetchMock)

    const api = await loadApi()
    const result = await api.searchGameSuggestions('game', 50)

    expect(result.map((item) => item.slug)).toEqual(['game-one', 'dlc-one'])
    expect(fetchMock).toHaveBeenCalledWith('/api/games/search', {
      query: { q: 'game', limit: 20 }
    })
  })

  it('resolves game id through lookup when the slug matches', async () => {
    const fetchMock = vi.fn(async () => ({
      found: true,
      game: { id: 'x-2', slug: 'cyberpunk-2077' }
    }))
    setupComposableGlobals(fetchMock)

    const api = await loadApi()
    const gameId = await api.getGameIdBySlug('cyberpunk-2077')

    expect(gameId).toBe('x-2')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/games/lookup', { query: { title: 'cyberpunk 2077' } })
  })

  it('falls back to exact slug search when lookup does not match', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/games/lookup') {
        return { found: true, game: { id: 'other', slug: 'baldur-s-gate-3-deluxe' } }
      }

      return [
        { id: 'x-1', slug: 'other-game', type: 'game' },
        { id: 'x-2', slug: 'baldurs-gate-3', type: 'game' }
      ]
    })
    setupComposableGlobals(fetchMock)

    const api = await loadApi()

    await expect(api.getGameIdBySlug('baldurs-gate-3')).resolves.toBe('x-2')
  })

  it('throws when slug cannot be resolved', async () => {
    const fetchMock = vi.fn(async (url: string) => (url === '/api/games/lookup' ? { found: false } : []))
    setupComposableGlobals(fetchMock)

    const api = await loadApi()

    await expect(api.getGameIdBySlug('missing-game')).rejects.toThrow('Game not found for this slug.')
  })

  it('caches deal pages by catalog state and offset', async () => {
    const fetchMock = vi.fn(async () => ({
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
        },
        { id: 'b-1', slug: 'some-bundle', title: 'Some Bundle', type: 'package', deal: {} }
      ],
      hasMore: true,
      nextOffset: 20
    }))
    setupComposableGlobals(fetchMock)

    const api = await loadApi()
    const firstCall = await api.getDealsPage(DEFAULT_CATALOG_STATE, 0)
    const secondCall = await api.getDealsPage(DEFAULT_CATALOG_STATE, 0)
    expect(fetchMock).toHaveBeenCalledWith('/api/deals', { query: { sort: '-hot', limit: 20, offset: 0 } })

    await api.getDealsPage({ ...DEFAULT_CATALOG_STATE, lojas: [61], desconto: 50 }, 20)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenLastCalledWith('/api/deals', {
      query: { sort: '-hot', shops: '61', minCut: 50, limit: 20, offset: 20 }
    })
    expect(firstCall.games.map((game) => game.slug)).toEqual(['test-game'])
    expect(secondCall.games).toHaveLength(1)
  })

  it('keeps games with "bundle" in the title when they are real games', async () => {
    const fetchMock = vi.fn(async () => ({
      list: [{ id: 'g-1', title: 'Bundle of Joy', type: 'game', deal: { price: { amount: 5 } } }]
    }))
    setupComposableGlobals(fetchMock)

    const api = await loadApi()
    const result = await api.getDealsPage(DEFAULT_CATALOG_STATE, 0)

    expect(result.games.map((game) => game.title)).toEqual(['Bundle of Joy'])
  })

  it('fetches search prices in a single batch request', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/games/search') {
        return [
          { id: 'a', slug: 'a', title: 'A', type: 'game', assets: { boxart: 'img-a' } },
          { id: 'b', slug: 'b', title: 'B', type: 'game', assets: {} },
          { id: 'c', slug: 'c', title: 'C', type: 'game', assets: { boxart: 'img-c' } }
        ]
      }

      return [
        { id: 'a', deals: [{ price: { amount: 30 } }, { price: { amount: 25 } }] },
        { id: 'c', deals: [] }
      ]
    })
    setupComposableGlobals(fetchMock)

    const api = await loadApi()
    const result = await api.searchGames('a')

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenLastCalledWith('/api/games/prices', { query: { ids: 'a,c' } })
    expect(result).toEqual([expect.objectContaining({ id: 'a', price: [{ amount: 25 }] })])
  })

  it('builds the cheapest-price timeline across shops', async () => {
    const { buildLowestPriceTimeline } = await loadModule()
    const entry = (timestamp: string, shopId: number, shopName: string, amount: number) => ({
      timestamp,
      shop: { id: shopId, name: shopName },
      deal: { price: { amount } }
    })

    const timeline = buildLowestPriceTimeline([
      entry('2026-03-01T00:00:00Z', 2, 'GOG', 80),
      entry('2026-01-01T00:00:00Z', 1, 'Steam', 100),
      entry('2026-02-01T00:00:00Z', 2, 'GOG', 100),
      entry('2026-04-01T00:00:00Z', 2, 'GOG', 120)
    ])

    expect(timeline).toEqual([
      { timestamp: '2026-01-01T00:00:00Z', price: 100, shop: 'Steam' },
      { timestamp: '2026-03-01T00:00:00Z', price: 80, shop: 'GOG' },
      { timestamp: '2026-04-01T00:00:00Z', price: 100, shop: 'Steam' }
    ])
  })
})

describe('normalizeDealGame', () => {
  it('normalizes deal images and history-low flag', async () => {
    const { normalizeDealGame } = await loadModule()
    const game = normalizeDealGame({
      id: 'g',
      title: 'G',
      type: 'game',
      assets: { banner300: 'b300', boxart: 'box', banner600: '' },
      deal: { price: { amount: 10 }, flag: 'H' }
    }, 0)
    expect(game?.images).toEqual(['box', 'b300'])
    expect(game?.image).toBe('box')
    expect(game?.historyLowFlag).toBe('H')
  })

  it('drops deals without a game type', async () => {
    const { normalizeDealGame } = await loadModule()
    expect(normalizeDealGame({ id: 'x', title: 'X', type: null, deal: {} }, 0)).toBeNull()
  })
})

describe('getHome', () => {
  it('normalizes the home payload', async () => {
    const fetchMock = vi.fn(async () => ({
      hero: [{ appid: 1086940, deal: { id: 'h', title: 'BG3', type: 'game', deal: { price: { amount: 139.99 } } } }],
      shelves: [{
        key: 'em-alta',
        title: 'Em alta',
        href: '/ofertas',
        items: [{ id: 'a', title: 'A', type: 'game', deal: {} }, { id: 'p', type: 'package' }]
      }]
    }))
    setupComposableGlobals(fetchMock)

    const home = await (await loadApi()).getHome()

    expect(fetchMock).toHaveBeenCalledWith('/api/home')
    expect(home.hero[0]).toMatchObject({ id: 'h', appid: 1086940, price: [{ amount: 139.99 }] })
    expect(home.shelves[0]!.games.map((game) => game.id)).toEqual(['a'])
  })
})

describe('normalizeDealGame types', () => {
  it('keeps DLC deals so the DLC catalog filter has results', async () => {
    const { normalizeDealGame } = await loadModule()
    expect(normalizeDealGame({ id: 'd', title: 'D', type: 'dlc', deal: {} }, 0)?.id).toBe('d')
    expect(normalizeDealGame({ id: 'p', title: 'P', type: 'package', deal: {} }, 0)).toBeNull()
  })
})

describe('getPrices shop details', () => {
  it('keeps the shop id and voucher of each deal', async () => {
    const fetchMock = vi.fn(async () => [{
      deals: [
        { shop: { id: 61, name: 'Steam' }, price: { amount: 10 }, url: 'https://s', voucher: 'GAMES10' },
        { shop: { id: 35, name: 'GOG' }, price: { amount: 12 }, url: 'https://g', voucher: null }
      ]
    }])
    setupComposableGlobals(fetchMock)

    const api = await loadApi()
    const rows = await api.getPrices('game-1')

    expect(rows.map((row) => [row.shopId, row.voucher])).toEqual([[61, 'GAMES10'], [35, undefined]])
  })
})

describe('getGameInfo slug', () => {
  it('keeps the ITAD slug so links resolve exactly', async () => {
    const fetchMock = vi.fn(async () => ({ id: 'g-1', slug: 'baldurs-gate-3', title: "Baldur's Gate 3", assets: {} }))
    setupComposableGlobals(fetchMock)

    const api = await loadApi()

    expect((await api.getGameInfo('g-1')).slug).toBe('baldurs-gate-3')
  })
})
