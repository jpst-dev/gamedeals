import {
  ITAD_COUNTRY,
  itadFetch,
  parseDealSort,
  parseIntInRange,
  parseOptionalNumber,
  parseShopIds,
  type DealSort,
  type ItadFetchOptions
} from './itad'

export type DealKind = 'games' | 'dlcs'

export type DealQuery = {
  sort: DealSort
  limit: number
  offset: number
  shops: number[]
  drm: number[]
  minCut?: number
  minPrice?: number
  maxPrice?: number
  historyLow: boolean
  kind: DealKind
}

export type DealsPage = {
  list: unknown[]
  hasMore: boolean
  nextOffset: number
}

export type ItadFetcher = <T>(path: string, options?: ItadFetchOptions) => Promise<T>

export const EXPIRING_WINDOW_MS = 7 * 86_400_000
// When we filter on our side (type, expiry) a page from ITAD can shrink a lot;
// fetch a few more pages to fill it, but never fan out unbounded.
export const MAX_ITAD_CALLS_PER_PAGE = 3
// ITAD's /deals/v2 page cap; used when local filters discard most results.
const ITAD_MAX_PAGE_SIZE = 200

export const parseDealQuery = (query: Record<string, unknown>): DealQuery => ({
  sort: parseDealSort(query.sort),
  limit: parseIntInRange(query.limit, 20, 1, 50),
  offset: parseIntInRange(query.offset, 0, 0, 5000),
  shops: parseShopIds(query.shops),
  drm: parseShopIds(query.drm),
  minCut: parseOptionalNumber(query.minCut, 0, 100),
  minPrice: parseOptionalNumber(query.minPrice, 0, 1000),
  maxPrice: parseOptionalNumber(query.maxPrice, 0, 1000),
  historyLow: query.historyLow === '1',
  kind: query.kind === 'dlcs' ? 'dlcs' : 'games'
})

export const buildDealsFilter = (query: DealQuery): string | undefined => {
  const filter: Record<string, unknown> = {}
  if (query.minCut) {
    filter.cut = { min: query.minCut, max: null }
  }
  // ITAD ignores a price filter unless both bounds are present.
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    filter.price = { min: query.minPrice ?? 0, max: query.maxPrice ?? null }
  }
  if (query.historyLow) {
    filter.flag = 'H'
  }
  if (query.drm.length > 0) {
    filter.drm = query.drm
  }

  return Object.keys(filter).length > 0 ? JSON.stringify(filter) : undefined
}

// ITAD can't filter by type (HTTP 500) and its expiry sort lists expired deals
// first, so both are handled here.
export const filterDealItems = (items: unknown[], query: DealQuery, now: number): unknown[] => {
  const wantedType = query.kind === 'dlcs' ? 'dlc' : 'game'

  return items.filter((entry) => {
    const item = (entry ?? {}) as Record<string, unknown>
    if (item.type !== wantedType) {
      return false
    }

    if (query.sort !== 'expiry') {
      return true
    }

    const expiry = Date.parse(String(((item.deal ?? {}) as Record<string, unknown>).expiry ?? ''))
    return Number.isFinite(expiry) && expiry > now && expiry <= now + EXPIRING_WINDOW_MS
  })
}

export const fetchDealsPage = async (
  query: DealQuery,
  fetcher: ItadFetcher = itadFetch,
  now = Date.now()
): Promise<DealsPage> => {
  const filter = buildDealsFilter(query)
  // Expired deals sort first and DLCs are a small share of the catalog, so
  // those queries would come back nearly empty with limit-sized ITAD pages.
  const pageSize = query.sort === 'expiry' || query.kind === 'dlcs' ? ITAD_MAX_PAGE_SIZE : query.limit
  const list: unknown[] = []
  let offset = query.offset
  let hasMore = true
  // Another ITAD round trip is only worth it for a mostly empty batch.
  const minItems = Math.ceil(query.limit / 2)

  for (let call = 0; call < MAX_ITAD_CALLS_PER_PAGE && hasMore && list.length < minItems; call++) {
    const response = await fetcher<{ list?: unknown[]; hasMore?: unknown; nextOffset?: unknown }>('/deals/v2', {
      params: {
        country: ITAD_COUNTRY,
        limit: pageSize,
        offset,
        sort: query.sort,
        nondeals: false,
        shops: query.shops.length > 0 ? query.shops.map(String) : undefined,
        filter
      }
    })

    const items = Array.isArray(response?.list) ? response.list : []
    list.push(...filterDealItems(items, query, now))
    hasMore = Boolean(response?.hasMore)
    const nextOffset = Number(response?.nextOffset)
    offset = Number.isFinite(nextOffset) ? nextOffset : offset + items.length
  }

  // Return everything read: nextOffset is already past these items.
  return { list, hasMore, nextOffset: offset }
}
