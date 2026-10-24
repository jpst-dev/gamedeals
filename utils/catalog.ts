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
