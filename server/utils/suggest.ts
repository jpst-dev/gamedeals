import type { Suggestion } from '../../shared/types/suggest'
import { pickBestPrice } from './alerts'
import type { ItadFetcher } from './deals'
import { ITAD_COUNTRY, itadFetch } from './itad'

type Raw = Record<string, unknown>

// Suggestion rows are wide, so banners come before the 2:3 boxart.
const thumbnailOf = (assets: unknown): string => {
  const node = (assets ?? {}) as Raw
  const image = [node.banner300, node.banner400, node.banner600, node.boxart]
    .find((value): value is string => typeof value === 'string' && value.length > 0)
  return image ?? ''
}

// Name search plus the current best price of each hit, in one cached
// response: two ITAD calls per new term, none while it is cached.
export const buildSuggestions = async (term: string, limit: number, fetcher: ItadFetcher = itadFetch): Promise<Suggestion[]> => {
  if (!term) {
    return []
  }

  const found = await fetcher<unknown>('/games/search/v1', { params: { title: term, results: limit } })
  const items: Omit<Suggestion, 'price'>[] = (Array.isArray(found) ? found : [])
    .map((entry) => entry as Raw)
    .filter((item) => (item.type === 'game' || item.type === 'dlc') && typeof item.id === 'string')
    .map((item) => ({
      id: String(item.id),
      slug: String(item.slug ?? ''),
      title: String(item.title ?? ''),
      image: thumbnailOf(item.assets),
      type: item.type as Suggestion['type']
    }))

  const prices = new Map<string, Suggestion['price']>()
  if (items.length > 0) {
    try {
      const rows = await fetcher<unknown>('/games/prices/v3', {
        method: 'POST',
        params: { country: ITAD_COUNTRY, deals: false, vouchers: true, capacity: 1 },
        body: items.map((item) => item.id)
      })
      for (const row of Array.isArray(rows) ? rows : []) {
        const best = pickBestPrice(row)
        if (best) {
          prices.set(best.gameId, {
            amount: best.price,
            regular: best.regular,
            cut: best.cut,
            shop: best.shop,
            isHistoryLow: best.isHistoryLow
          })
        }
      }
    } catch {
      // Prices are a bonus: the names still help when that call fails.
    }
  }

  return items.map((item) => ({ ...item, price: prices.get(item.id) ?? null }))
}
