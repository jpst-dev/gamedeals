import type { CatalogOrder, CatalogState } from './catalog'

type Shop = { id: number; title: string }

// The price slider's top position means "no limit".
export const PRICE_UNLIMITED = 300
export const PRICE_DEBOUNCE_MS = 400
export const VISIBLE_SHOPS = 6

export const PRICE_SHORTCUTS: Array<{ label: string; value: number }> = [
  { label: 'Grátis', value: 0 },
  { label: 'R$ 20', value: 20 },
  { label: 'R$ 50', value: 50 },
  { label: 'R$ 100', value: 100 }
]

export const DISCOUNT_OPTIONS: Array<{ label: string; value: CatalogState['desconto'] }> = [
  { label: 'Qualquer', value: undefined },
  { label: '25%', value: 25 },
  { label: '50%', value: 50 },
  { label: '75%', value: 75 },
  { label: '90%', value: 90 }
]

export const TYPE_OPTIONS: Array<{ label: string; value: CatalogState['tipo'] }> = [
  { label: 'Jogos', value: 'jogos' },
  { label: 'DLCs', value: 'dlcs' }
]

export const ORDER_OPTIONS: Array<{ value: CatalogOrder; label: string }> = [
  { value: 'populares', label: 'Populares' },
  { value: 'desconto', label: 'Maior desconto' },
  { value: 'menor-preco', label: 'Menor preço' },
  { value: 'maior-preco', label: 'Maior preço' },
  { value: 'recentes', label: 'Mais recentes' },
  { value: 'titulo', label: 'Título A-Z' },
  { value: 'acabando', label: 'Acabando' }
]

export const priceDraftOf = (preco: number | undefined): number => {
  return preco === undefined ? PRICE_UNLIMITED : Math.min(preco, PRICE_UNLIMITED)
}

export const priceFromDraft = (draft: number): number | undefined => {
  return draft >= PRICE_UNLIMITED ? undefined : draft
}

export const priceLabel = (draft: number): string => {
  if (draft >= PRICE_UNLIMITED) {
    return 'Sem limite'
  }
  return draft === 0 ? 'Grátis' : `Até R$ ${draft}`
}

// What a resting slider should change, or null when it already shows the
// current filter (a URL price above the slider's range sits at its top, and
// must not be read as "no limit").
export const priceUpdateFor = (draft: number, current: number | undefined): { preco: number | undefined } | null => {
  return draft === priceDraftOf(current) ? null : { preco: priceFromDraft(draft) }
}

// Clicking the shortcut that is already on turns the price filter off.
export const togglePrice = (current: number | undefined, value: number): number | undefined => {
  return current === value ? undefined : value
}

export const toggleId = (ids: number[], id: number): number[] => {
  return ids.includes(id) ? ids.filter((entry) => entry !== id) : [...ids, id]
}

const fold = (value: string): string => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

// Ticked shops always stay on screen (first), so they can be unticked even
// when the list is collapsed or the search hides them.
export const shopsToShow = <T extends Shop>(shops: T[], selected: number[], query: string, showAll: boolean): T[] => {
  const needle = fold(query.trim())
  const ticked = shops.filter((shop) => selected.includes(shop.id))
  const matches = shops.filter((shop) => !selected.includes(shop.id) && fold(shop.title).includes(needle))
  return [...ticked, ...(showAll ? matches : matches.slice(0, VISIBLE_SHOPS))]
}
