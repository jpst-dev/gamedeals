import { DEAL_COLLECTIONS } from './catalog'

export type HeaderLink = { label: string; to: string }

// The collection titles are long for a nav bar; these fit one line.
const SHORT_LABELS: Record<string, string> = {
  'menor-preco-historico': 'Menor preço da história',
  gratis: 'Grátis',
  acabando: 'Acabando',
  '75-off': '75% off',
  'ate-20-reais': 'Até R$ 20'
}

export const HEADER_LINKS: HeaderLink[] = [
  { label: 'Ofertas', to: '/ofertas' },
  ...DEAL_COLLECTIONS.map((collection) => ({
    label: SHORT_LABELS[collection.slug] ?? collection.title,
    to: `/ofertas/${collection.slug}`
  }))
]

export const shopLink = (shopId: number): string => `/ofertas?lojas=${shopId}`

export const sortShops = <T extends { title: string }>(shops: T[]): T[] => {
  return [...shops].sort((a, b) => a.title.localeCompare(b.title, 'pt-BR', { sensitivity: 'base' }))
}

// "Ofertas" stays unmarked while a shop is picked from "Por loja".
export const isActiveLink = (path: string, fullPath: string, link: HeaderLink): boolean => {
  if (path !== link.to) {
    return false
  }
  return link.to !== '/ofertas' || !/[?&]lojas=/.test(fullPath)
}
