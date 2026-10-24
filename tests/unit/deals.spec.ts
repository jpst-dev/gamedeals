import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const globalScope = globalThis as Record<string, unknown>

const loadDeals = async () => {
  vi.resetModules()
  return await import('../../server/utils/deals')
}

beforeEach(() => {
  globalScope.createError = (details: { statusCode: number; statusMessage: string }) =>
    Object.assign(new Error(details.statusMessage), details)
})

afterEach(() => {
  vi.restoreAllMocks()
  delete globalScope.createError
})

type Row = { id: string }
const ids = (items: unknown[]) => (items as Row[]).map((item) => item.id)

describe('server/utils/deals', () => {
  it('sanitizes malformed query params', async () => {
    const { parseDealQuery } = await loadDeals()
    const query = parseDealQuery({ sort: 'foo', limit: '999', shops: 'x,,61', minCut: 'abc', maxPrice: '-5', kind: 'zzz' })
    expect(query).toMatchObject({ sort: '-hot', limit: 50, shops: [61], minCut: undefined, maxPrice: 0, kind: 'games', historyLow: false })
  })

  it('accepts numeric values as well as query strings', async () => {
    const { parseDealQuery } = await loadDeals()
    expect(parseDealQuery({ minCut: 75, minPrice: 0, maxPrice: 0, limit: 40 }))
      .toMatchObject({ minCut: 75, minPrice: 0, maxPrice: 0, limit: 40 })
  })

  it('builds a single ITAD filter with price min and max', async () => {
    const { parseDealQuery, buildDealsFilter } = await loadDeals()
    const query = parseDealQuery({ minCut: '75', maxPrice: '20', historyLow: '1', drm: '61' })
    expect(JSON.parse(buildDealsFilter(query)!)).toEqual({
      cut: { min: 75, max: null }, price: { min: 0, max: 20 }, flag: 'H', drm: [61]
    })
  })

  it('keeps an explicit minimum price', async () => {
    const { parseDealQuery, buildDealsFilter } = await loadDeals()
    const query = parseDealQuery({ minPrice: '0.01', maxPrice: '20' })
    expect(JSON.parse(buildDealsFilter(query)!).price).toEqual({ min: 0.01, max: 20 })
  })

  it('returns no filter when nothing is set', async () => {
    const { parseDealQuery, buildDealsFilter } = await loadDeals()
    expect(buildDealsFilter(parseDealQuery({}))).toBeUndefined()
  })

  it('filters by kind and drops expired or far expiries when sorting by expiry', async () => {
    const { parseDealQuery, filterDealItems } = await loadDeals()
    const now = Date.parse('2026-10-24T12:00:00Z')
    const items = [
      { id: 'a', type: 'game', deal: { expiry: '2026-10-25T00:00:00Z' } },
      { id: 'b', type: 'game', deal: { expiry: '2026-10-01T00:00:00Z' } },
      { id: 'c', type: 'game', deal: { expiry: '2026-12-01T00:00:00Z' } },
      { id: 'd', type: 'dlc', deal: { expiry: '2026-10-25T00:00:00Z' } },
      { id: 'e', type: null, deal: {} },
      { id: 'f', type: 'game', deal: { expiry: 'not-a-date' } }
    ]
    expect(ids(filterDealItems(items, parseDealQuery({ sort: 'expiry' }), now))).toEqual(['a'])
    expect(ids(filterDealItems(items, parseDealQuery({ kind: 'dlcs' }), now))).toEqual(['d'])
  })

  it('keeps fetching until the page is full, up to 3 ITAD calls', async () => {
    const { parseDealQuery, fetchDealsPage } = await loadDeals()
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ list: [{ id: '1', type: 'dlc' }], hasMore: true, nextOffset: 20 })
      .mockResolvedValueOnce({ list: [{ id: '2', type: 'game' }], hasMore: true, nextOffset: 40 })
      .mockResolvedValueOnce({ list: [{ id: '3', type: 'game' }], hasMore: true, nextOffset: 60 })
    const page = await fetchDealsPage(parseDealQuery({ limit: '20' }), fetcher as never)
    expect(fetcher).toHaveBeenCalledTimes(3)
    expect(page).toEqual({ list: [{ id: '2', type: 'game' }, { id: '3', type: 'game' }], hasMore: true, nextOffset: 60 })
  })

  it('stops when ITAD has no more results', async () => {
    const { parseDealQuery, fetchDealsPage } = await loadDeals()
    const fetcher = vi.fn().mockResolvedValueOnce({ list: [{ id: '1', type: 'game' }], hasMore: false, nextOffset: 1 })
    const page = await fetchDealsPage(parseDealQuery({}), fetcher as never)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(page.hasMore).toBe(false)
  })

  it('sends country, sort, shops and filter to /deals/v2', async () => {
    const { parseDealQuery, fetchDealsPage } = await loadDeals()
    const fetcher = vi.fn().mockResolvedValue({ list: [], hasMore: false, nextOffset: 0 })
    await fetchDealsPage(parseDealQuery({ sort: '-cut', shops: '61,35', minCut: '50', offset: '40' }), fetcher as never)
    expect(fetcher).toHaveBeenCalledWith('/deals/v2', {
      params: expect.objectContaining({
        country: 'BR',
        sort: '-cut',
        shops: ['35', '61'],
        offset: 40,
        nondeals: false,
        filter: JSON.stringify({ cut: { min: 50, max: null } })
      })
    })
  })
})
