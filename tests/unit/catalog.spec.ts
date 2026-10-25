import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CATALOG_STATE,
  activeFilterTags,
  catalogStateToQuery,
  findCollection,
  parseCatalogQuery,
  type CatalogState
} from '../../app/utils/catalog'

describe('utils/catalog URL state', () => {
  it('parses a malformed query into safe defaults', () => {
    expect(parseCatalogQuery({ preco: 'abc', lojas: 'x,,61', desconto: '33', ordem: 'foo', tipo: 'zzz', minima: 'yes' }))
      .toEqual({ ...DEFAULT_CATALOG_STATE, lojas: [61] })
  })

  it('applies the collection preset and lets the query override it', () => {
    expect(parseCatalogQuery({ ordem: 'titulo' }, findCollection('ate-20-reais')!.state))
      .toEqual({ ...DEFAULT_CATALOG_STATE, preco: 20, ordem: 'titulo' })
  })

  it('returns undefined for unknown collections', () => {
    expect(findCollection('xyz')).toBeUndefined()
  })

  it('round-trips state through the URL query, omitting defaults', () => {
    const state: CatalogState = { ...DEFAULT_CATALOG_STATE, lojas: [61, 35], desconto: 75, minima: true }
    expect(catalogStateToQuery(state)).toEqual({ lojas: '35,61', desconto: '75', minima: '1' })
    expect(parseCatalogQuery(catalogStateToQuery(state))).toEqual({ ...state, lojas: [35, 61] })
    expect(catalogStateToQuery(DEFAULT_CATALOG_STATE)).toEqual({})
  })

  it('keeps a free price cap in the URL', () => {
    expect(catalogStateToQuery({ ...DEFAULT_CATALOG_STATE, preco: 0 })).toEqual({ preco: '0' })
    expect(parseCatalogQuery({ preco: '0' }).preco).toBe(0)
  })

  it('lists removable filter tags', () => {
    const tags = activeFilterTags({ ...DEFAULT_CATALOG_STATE, preco: 20, lojas: [61], minima: true }, new Map([[61, 'Steam']]))
    expect(tags.map((tag) => tag.label)).toEqual(['Menor preço da história', 'Até R$ 20', 'na Steam'])
    expect(tags[2]!.remove).toEqual({ lojas: [] })
  })

  it('labels free, discount, expiring and DLC tags', () => {
    const tags = activeFilterTags({ ...DEFAULT_CATALOG_STATE, preco: 0, desconto: 50, ordem: 'acabando', tipo: 'dlcs', ativa: [61] }, new Map())
    expect(tags.map((tag) => tag.label)).toEqual(['Grátis', '-50% ou mais', 'Ativa na Steam', 'Acabando', 'DLCs'])
    expect(tags.find((tag) => tag.label === 'Acabando')!.remove).toEqual({ ordem: 'populares' })
  })
})

describe('DRM options', () => {
  it('offers only the activation filters verified on ITAD', async () => {
    const { DRM_OPTIONS } = await import('../../app/utils/catalog')
    expect(DRM_OPTIONS).toEqual([{ id: 61, label: 'Steam' }, { id: 1000, label: 'Sem DRM' }])
  })

  it('labels a DRM-free tag by name', () => {
    expect(activeFilterTags({ ...DEFAULT_CATALOG_STATE, ativa: [1000] }, new Map())[0]!.label).toBe('Sem DRM')
  })
})
