import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_CATALOG_STATE, catalogStateToDealParams } from '../../utils/catalog'

const globalScope = globalThis as Record<string, unknown>

const loadHome = async () => {
  vi.resetModules()
  return await import('../../server/utils/home')
}

beforeEach(() => {
  globalScope.createError = (details: { statusCode: number; statusMessage: string }) =>
    Object.assign(new Error(details.statusMessage), details)
})

afterEach(() => {
  vi.restoreAllMocks()
  delete globalScope.createError
})

type FetchOptions = { params: Record<string, unknown> }

describe('utils/catalog collections', () => {
  it('maps catalog state to deal params', () => {
    expect(catalogStateToDealParams({
      ...DEFAULT_CATALOG_STATE,
      ordem: 'acabando',
      lojas: [61, 35],
      desconto: 75,
      preco: 20,
      minima: true,
      tipo: 'dlcs'
    })).toEqual({ sort: 'expiry', shops: '61,35', drm: undefined, minCut: 75, minPrice: 0.01, maxPrice: 20, historyLow: '1', kind: 'dlcs' })
    expect(catalogStateToDealParams({ ...DEFAULT_CATALOG_STATE, preco: 0 })).toMatchObject({ minPrice: 0, maxPrice: 0 })
  })
})

describe('server/utils/home', () => {
  it('builds shelves in order, capped at 12, skipping empty and failed ones', async () => {
    const { buildHome } = await loadHome()
    const game = (id: string) => ({ id, type: 'game', deal: { price: { amount: 1 } } })
    const fetcher = vi.fn(async (path: string, options: FetchOptions) => {
      if (path === '/games/info/v2') {
        throw new Error('down')
      }
      const filter = options.params.filter ? JSON.parse(String(options.params.filter)) : {}
      if (filter.flag === 'H') {
        throw new Error('boom')
      }
      if (filter.price?.max === 0) {
        return { list: [], hasMore: false, nextOffset: 0 }
      }
      return { list: Array.from({ length: 40 }, (_, index) => game(`g${index}`)), hasMore: false, nextOffset: 40 }
    })

    const home = await buildHome(fetcher as never, Date.parse('2026-10-24T12:00:00Z'))

    expect(home.shelves.map((shelf) => shelf.key)).toEqual(['em-alta', '75-off', 'ate-20-reais'])
    expect(home.shelves[0]).toMatchObject({ title: 'Em alta', href: '/ofertas' })
    expect(home.shelves[0]!.items).toHaveLength(12)
    expect(home.hero).toEqual([])
  })

  it('keeps free games out of every shelf but the free one and out of the hero', async () => {
    const { buildHome } = await loadHome()
    const filters: unknown[] = []
    const fetcher = vi.fn(async (path: string, options: FetchOptions) => {
      if (path === '/games/info/v2') {
        return {}
      }
      filters.push(options.params.filter ? JSON.parse(String(options.params.filter)) : {})
      return { list: [], hasMore: false, nextOffset: 0 }
    })

    await buildHome(fetcher as never)

    const notFree = { min: 0.01, max: null }
    expect(filters).toContainEqual({ price: notFree })
    expect(filters).toContainEqual({ price: notFree, flag: 'H' })
    expect(filters).toContainEqual({ cut: { min: 75, max: null }, price: notFree })
    expect(filters).toContainEqual({ cut: { min: 30, max: null }, price: notFree })
    expect(filters).toContainEqual({ price: { min: 0, max: 0 } })
    expect(filters).toContainEqual({ price: { min: 0.01, max: 20 } })
    expect(filters).not.toContainEqual({})
  })

  it('picks up to 5 hero games with a Steam appid, history lows first', async () => {
    const { buildHome } = await loadHome()
    const candidates = Array.from({ length: 10 }, (_, index) => ({
      id: `c${index}`,
      type: 'game',
      deal: { price: { amount: 1 }, cut: 50, flag: index === 7 ? 'H' : undefined }
    }))
    const fetcher = vi.fn(async (path: string, options: FetchOptions) => {
      if (path === '/games/info/v2') {
        const id = String(options.params.id)
        return { appid: id === 'c2' ? undefined : 100 + Number(id.slice(1)) }
      }
      return { list: candidates, hasMore: false, nextOffset: 10 }
    })

    const home = await buildHome(fetcher as never)

    expect(home.hero.map((item) => item.appid)).toEqual([107, 100, 101, 103, 104])
  })
})
