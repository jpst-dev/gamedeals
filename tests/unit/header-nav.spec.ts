import { describe, expect, it } from 'vitest'
import { DEAL_COLLECTIONS } from '../../app/utils/catalog'
import { HEADER_LINKS, isActiveLink, shopLink, sortShops } from '../../app/utils/header-nav'

const link = (label: string) => {
  const found = HEADER_LINKS.find((entry) => entry.label === label)
  if (!found) {
    throw new Error(`missing ${label}`)
  }
  return found
}

describe('header-nav', () => {
  it('atalhos na ordem do spec', () => {
    expect(HEADER_LINKS.map((entry) => entry.label)).toEqual(['Ofertas', 'Menor preço da história', 'Grátis', 'Acabando', '75% off', 'Até R$ 20'])
    expect(HEADER_LINKS.map((entry) => entry.to)).toEqual(['/ofertas', ...DEAL_COLLECTIONS.map((collection) => `/ofertas/${collection.slug}`)])
  })

  it('link de loja', () => {
    expect(shopLink(16)).toBe('/ofertas?lojas=16')
  })

  it('lojas em ordem alfabética', () => {
    const shops = [{ id: 1, title: 'Steam' }, { id: 2, title: 'Epic Game Store' }, { id: 3, title: 'éXtra' }]
    expect(sortShops(shops).map((shop) => shop.title)).toEqual(['Epic Game Store', 'éXtra', 'Steam'])
    expect(shops[0]?.title).toBe('Steam')
  })

  it('link ativo', () => {
    expect(isActiveLink('/ofertas/gratis', '/ofertas/gratis', link('Grátis'))).toBe(true)
    expect(isActiveLink('/ofertas', '/ofertas?lojas=16', link('Ofertas'))).toBe(false)
    expect(isActiveLink('/ofertas', '/ofertas', link('Ofertas'))).toBe(true)
    expect(isActiveLink('/', '/', link('Ofertas'))).toBe(false)
  })
})
