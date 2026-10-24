// Catalog state shared by the app (URL <-> filters) and the server (home
// shelves). Keep it framework-free: the server imports it by relative path.

export type CatalogOrder = 'populares' | 'desconto' | 'menor-preco' | 'maior-preco' | 'recentes' | 'titulo' | 'acabando'

export type CatalogState = {
  ordem: CatalogOrder
  lojas: number[]
  ativa: number[]
  desconto?: 25 | 50 | 75 | 90
  preco?: number
  minima: boolean
  tipo: 'jogos' | 'dlcs'
}

export type DealCollection = {
  slug: string
  title: string
  description: string
  state: Partial<CatalogState>
}

export const DEFAULT_CATALOG_STATE: CatalogState = {
  ordem: 'populares',
  lojas: [],
  ativa: [],
  minima: false,
  tipo: 'jogos'
}

export const ORDER_TO_ITAD_SORT: Record<CatalogOrder, string> = {
  populares: '-hot',
  desconto: '-cut',
  'menor-preco': 'price',
  'maior-preco': '-price',
  recentes: '-added',
  titulo: 'title',
  acabando: 'expiry'
}

export const DEAL_COLLECTIONS: DealCollection[] = [
  {
    slug: 'menor-preco-historico',
    title: 'Menor preço da história',
    description: 'Jogos custando agora o menor preço já registrado.',
    state: { minima: true }
  },
  {
    slug: 'gratis',
    title: 'Grátis para resgatar',
    description: 'Jogos que estão de graça por tempo limitado.',
    state: { preco: 0 }
  },
  {
    slug: 'acabando',
    title: 'Acabando em breve',
    description: 'Promoções que terminam nos próximos 7 dias.',
    state: { ordem: 'acabando' }
  },
  {
    slug: '75-off',
    title: '75% ou mais de desconto',
    description: 'Os maiores descontos entre os jogos populares.',
    state: { desconto: 75 }
  },
  {
    slug: 'ate-20-reais',
    title: 'Até R$ 20',
    description: 'Jogos populares por até R$ 20.',
    state: { preco: 20 }
  }
]

const csv = (ids: number[]): string | undefined => (ids.length > 0 ? ids.join(',') : undefined)

// A price cap of 0 means "free"; any other cap excludes free games.
const priceParams = (preco: number | undefined): { minPrice?: number; maxPrice?: number } => {
  if (preco === undefined) {
    return {}
  }

  return preco === 0 ? { minPrice: 0, maxPrice: 0 } : { minPrice: 0.01, maxPrice: preco }
}

export const catalogStateToDealParams = (state: CatalogState): Record<string, string | number | undefined> => ({
  sort: ORDER_TO_ITAD_SORT[state.ordem],
  shops: csv(state.lojas),
  drm: csv(state.ativa),
  minCut: state.desconto,
  ...priceParams(state.preco),
  historyLow: state.minima ? '1' : undefined,
  kind: state.tipo === 'dlcs' ? 'dlcs' : undefined
})

// DRM ids verified against ITAD /deals/v2 (2026-10-24); others are unknown.
export const DRM_OPTIONS: Array<{ id: number; label: string }> = [
  { id: 61, label: 'Steam' },
  { id: 1000, label: 'Sem DRM' }
]

const drmTagLabel = (drmId: number): string => {
  if (drmId === 1000) {
    return 'Sem DRM'
  }

  const option = DRM_OPTIONS.find((entry) => entry.id === drmId)
  return option ? `Ativa na ${option.label}` : `Ativa: ${drmId}`
}

const CATALOG_ORDERS = Object.keys(ORDER_TO_ITAD_SORT) as CatalogOrder[]
const DISCOUNT_STEPS = [25, 50, 75, 90] as const

const firstString = (value: unknown): string => {
  const raw = Array.isArray(value) ? value[0] : value
  return typeof raw === 'string' ? raw.trim() : ''
}

const parseIds = (value: unknown): number[] => {
  const ids = firstString(value)
    .split(',')
    .map((entry) => Number(entry.trim()))
    .filter((entry) => Number.isInteger(entry) && entry > 0)
  return [...new Set(ids)].sort((a, b) => a - b)
}

export const findCollection = (slug: string): DealCollection | undefined => {
  return DEAL_COLLECTIONS.find((collection) => collection.slug === slug)
}

// Invalid values fall back to the preset/default instead of failing the page.
export const parseCatalogQuery = (
  query: Record<string, unknown>,
  preset: Partial<CatalogState> = {}
): CatalogState => {
  const state: CatalogState = { ...DEFAULT_CATALOG_STATE, ...preset }

  const ordem = firstString(query.ordem)
  if (CATALOG_ORDERS.includes(ordem as CatalogOrder)) {
    state.ordem = ordem as CatalogOrder
  }

  const lojas = parseIds(query.lojas)
  if (lojas.length > 0) {
    state.lojas = lojas
  }

  const ativa = parseIds(query.ativa)
  if (ativa.length > 0) {
    state.ativa = ativa
  }

  const desconto = Number(firstString(query.desconto))
  if (DISCOUNT_STEPS.includes(desconto as (typeof DISCOUNT_STEPS)[number])) {
    state.desconto = desconto as CatalogState['desconto']
  }

  const precoRaw = firstString(query.preco)
  const preco = Number(precoRaw)
  if (precoRaw !== '' && Number.isInteger(preco) && preco >= 0 && preco <= 1000) {
    state.preco = preco
  }

  if (firstString(query.minima) === '1') {
    state.minima = true
  }

  const tipo = firstString(query.tipo)
  if (tipo === 'jogos' || tipo === 'dlcs') {
    state.tipo = tipo
  }

  return state
}

export const catalogStateToQuery = (state: CatalogState): Record<string, string> => {
  const query: Record<string, string> = {}
  if (state.ordem !== DEFAULT_CATALOG_STATE.ordem) {
    query.ordem = state.ordem
  }
  if (state.lojas.length > 0) {
    query.lojas = [...state.lojas].sort((a, b) => a - b).join(',')
  }
  if (state.ativa.length > 0) {
    query.ativa = [...state.ativa].sort((a, b) => a - b).join(',')
  }
  if (state.desconto !== undefined) {
    query.desconto = String(state.desconto)
  }
  if (state.preco !== undefined) {
    query.preco = String(state.preco)
  }
  if (state.minima) {
    query.minima = '1'
  }
  if (state.tipo !== DEFAULT_CATALOG_STATE.tipo) {
    query.tipo = state.tipo
  }

  return query
}

export type ActiveFilterTag = {
  key: string
  label: string
  remove: Partial<CatalogState>
}

export const activeFilterTags = (state: CatalogState, shopNames: Map<number, string>): ActiveFilterTag[] => {
  const tags: ActiveFilterTag[] = []
  if (state.minima) {
    tags.push({ key: 'minima', label: 'Menor preço da história', remove: { minima: false } })
  }
  if (state.preco !== undefined) {
    tags.push({ key: 'preco', label: state.preco === 0 ? 'Grátis' : `Até R$ ${state.preco}`, remove: { preco: undefined } })
  }
  if (state.desconto !== undefined) {
    tags.push({ key: 'desconto', label: `-${state.desconto}% ou mais`, remove: { desconto: undefined } })
  }
  for (const shopId of state.lojas) {
    tags.push({
      key: `loja-${shopId}`,
      label: `na ${shopNames.get(shopId) ?? shopId}`,
      remove: { lojas: state.lojas.filter((id) => id !== shopId) }
    })
  }
  for (const drmId of state.ativa) {
    tags.push({
      key: `ativa-${drmId}`,
      label: drmTagLabel(drmId),
      remove: { ativa: state.ativa.filter((id) => id !== drmId) }
    })
  }
  if (state.ordem === 'acabando') {
    tags.push({ key: 'acabando', label: 'Acabando', remove: { ordem: 'populares' } })
  }
  if (state.tipo === 'dlcs') {
    tags.push({ key: 'tipo', label: 'DLCs', remove: { tipo: 'jogos' } })
  }

  return tags
}
