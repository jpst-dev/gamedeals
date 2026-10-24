import { DEAL_COLLECTIONS, DEFAULT_CATALOG_STATE, catalogStateToDealParams, type CatalogState } from '../../utils/catalog'
import { fetchDealsPage, parseDealQuery, type ItadFetcher } from './deals'
import { itadFetch } from './itad'

export type HomePayload = {
  hero: Array<{ deal: unknown; appid: number }>
  shelves: Array<{ key: string; title: string; href: string; items: unknown[] }>
}

const SHELF_FETCH_LIMIT = 40
const SHELF_SIZE = 12
const HERO_CANDIDATES = 8
const HERO_SIZE = 5

const SHELVES: Array<{ key: string; title: string; href: string; state: CatalogState }> = [
  { key: 'em-alta', title: 'Em alta', href: '/ofertas', state: DEFAULT_CATALOG_STATE },
  ...DEAL_COLLECTIONS.map((collection) => ({
    key: collection.slug,
    title: collection.title,
    href: `/ofertas/${collection.slug}`,
    state: { ...DEFAULT_CATALOG_STATE, ...collection.state }
  }))
]

const isHistoryLow = (item: unknown): boolean => {
  const flag = (((item ?? {}) as Record<string, unknown>).deal as Record<string, unknown> | undefined)?.flag
  return flag === 'H' || flag === 'N'
}

// Free games top every popularity list; they get their own shelf, so keep
// them out of the others (and the hero) to avoid the same games everywhere.
const NOT_FREE = { minPrice: 0.01 }

const buildShelves = async (fetcher: ItadFetcher, now: number): Promise<HomePayload['shelves']> => {
  const results = await Promise.allSettled(SHELVES.map((shelf) => {
    const query = parseDealQuery({
      ...(shelf.state.preco === undefined ? NOT_FREE : {}),
      ...catalogStateToDealParams(shelf.state),
      limit: SHELF_FETCH_LIMIT
    })
    return fetchDealsPage(query, fetcher, now)
  }))

  // A full ITAD outage must fail the request: an empty home would be cached.
  if (results.every((result) => result.status === 'rejected')) {
    throw createError({ statusCode: 502, statusMessage: 'Ofertas indisponíveis no momento' })
  }

  return SHELVES.flatMap((shelf, index) => {
    const result = results[index]
    if (result?.status !== 'fulfilled' || result.value.list.length === 0) {
      return []
    }

    return [{ key: shelf.key, title: shelf.title, href: shelf.href, items: result.value.list.slice(0, SHELF_SIZE) }]
  })
}

// The hero needs Steam art, and deals don't carry the Steam appid, so look it
// up for a handful of popular discounted games (history lows first).
const buildHero = async (fetcher: ItadFetcher, now: number): Promise<HomePayload['hero']> => {
  const page = await fetchDealsPage(parseDealQuery({ ...NOT_FREE, sort: '-hot', minCut: 30, limit: 20 }), fetcher, now)
  const candidates = [...page.list]
    .sort((a, b) => Number(isHistoryLow(b)) - Number(isHistoryLow(a)))
    .slice(0, HERO_CANDIDATES)

  const infos = await Promise.allSettled(candidates.map((candidate) => {
    const id = String(((candidate ?? {}) as Record<string, unknown>).id ?? '')
    return fetcher<{ appid?: unknown }>('/games/info/v2', { params: { id } })
  }))

  return candidates.flatMap((deal, index) => {
    const info = infos[index]
    const appid = info?.status === 'fulfilled' ? Number(info.value?.appid) : Number.NaN
    return Number.isInteger(appid) && appid > 0 ? [{ deal, appid }] : []
  }).slice(0, HERO_SIZE)
}

export const buildHome = async (fetcher: ItadFetcher = itadFetch, now = Date.now()): Promise<HomePayload> => {
  const [hero, shelves] = await Promise.all([
    buildHero(fetcher, now).catch(() => []),
    buildShelves(fetcher, now)
  ])

  return { hero, shelves }
}
