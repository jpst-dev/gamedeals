// Sale rules for the daily favorites alerts. Pure: no database, no network.

export type BestPrice = {
  gameId: string
  price: number
  regular: number
  cut: number
  shop: string
  historyLow: number | null
  isHistoryLow: boolean
}

export type AlertState = {
  // Price of the sale already announced (or seen); null while not on sale.
  notifiedPrice: number | null
  // True until the first price read, which only records the current state.
  baselinePending: boolean
}

type Raw = Record<string, unknown>

const asRecord = (value: unknown): Raw | null => {
  return value !== null && typeof value === 'object' ? value as Raw : null
}

const amountOf = (value: unknown): number | null => {
  const amount = Number(asRecord(value)?.amount)
  return Number.isFinite(amount) ? amount : null
}

// Cheapest BRL deal of one item from ITAD's /games/prices/v3.
export const pickBestPrice = (entry: unknown): BestPrice | null => {
  const item = asRecord(entry)
  const deals = item && Array.isArray(item.deals) ? item.deals : []
  if (!item || typeof item.id !== 'string') {
    return null
  }

  let best: Omit<BestPrice, 'gameId' | 'historyLow' | 'isHistoryLow'> | null = null
  for (const raw of deals) {
    const deal = asRecord(raw)
    const price = amountOf(deal?.price)
    if (!deal || price === null || (best && best.price <= price)) {
      continue
    }
    const cut = Number(deal.cut)
    best = {
      price,
      regular: amountOf(deal.regular) ?? price,
      cut: Number.isFinite(cut) ? cut : 0,
      shop: String(asRecord(deal.shop)?.name ?? '')
    }
  }
  if (!best) {
    return null
  }

  const historyLow = amountOf(asRecord(item.historyLow)?.all)
  return { gameId: item.id, ...best, historyLow, isHistoryLow: historyLow !== null && best.price <= historyLow }
}

// Steam-wishlist rule: announce a sale once, again only if it gets cheaper.
export const decideAlert = (state: AlertState, best: BestPrice | null): { notify: boolean; next: AlertState } => {
  if (!best) {
    return { notify: false, next: state }
  }
  if (best.cut <= 0) {
    return { notify: false, next: { notifiedPrice: null, baselinePending: false } }
  }
  if (state.baselinePending) {
    return { notify: false, next: { notifiedPrice: best.price, baselinePending: false } }
  }
  if (state.notifiedPrice === null || best.price < state.notifiedPrice) {
    return { notify: true, next: { notifiedPrice: best.price, baselinePending: false } }
  }
  return { notify: false, next: state }
}
