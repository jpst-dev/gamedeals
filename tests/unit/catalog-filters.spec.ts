import { describe, expect, it } from 'vitest'
import { priceDraftOf, priceUpdateFor, priceFromDraft, priceLabel, shopsToShow, togglePrice } from '../../app/utils/catalog-filters'

const shop = (id: number, title: string) => ({ id, title })
const steam = shop(61, 'Steam')
const epic = shop(16, 'Epic Game Store')
const nuuvem = shop(70, 'Nuuvem')
const ten = Array.from({ length: 10 }, (_, index) => shop(index + 1, `Loja ${index + 1}`))

describe('catalog-filters', () => {
  it('preço: rascunho e volta', () => {
    expect(priceDraftOf(undefined)).toBe(300)
    expect(priceDraftOf(500)).toBe(300)
    expect(priceFromDraft(300)).toBeUndefined()
    expect(priceFromDraft(20)).toBe(20)
    expect(priceLabel(300)).toBe('Sem limite')
    expect(priceLabel(0)).toBe('Grátis')
    expect(priceLabel(50)).toBe('Até R$ 50')
  })

  it('atalho de preço liga e desliga', () => {
    expect(togglePrice(undefined, 0)).toBe(0)
    expect(togglePrice(0, 0)).toBeUndefined()
    expect(togglePrice(20, 50)).toBe(50)
  })

  it('busca de loja ignora acentos e maiúsculas', () => {
    expect(shopsToShow([steam, epic, nuuvem], [], 'nuuvém', false)).toEqual([nuuvem])
    expect(shopsToShow([steam, epic, nuuvem], [], 'EPIC', false)).toEqual([epic])
  })

  it('mostra 6 lojas e todas com ver todas', () => {
    expect(shopsToShow(ten, [], '', false)).toHaveLength(6)
    expect(shopsToShow(ten, [], '', true)).toHaveLength(10)
  })

  it('loja marcada sempre aparece', () => {
    const shown = shopsToShow(ten, [9], '', false)
    expect(shown).toHaveLength(7)
    expect(shown[0]?.id).toBe(9)
    expect(shopsToShow([steam, epic, nuuvem], [70], 'steam', false)).toEqual([nuuvem, steam])
  })

  it('preço acima do limite vindo da URL não é apagado pelo controle', () => {
    expect(priceUpdateFor(300, 500)).toBeNull()
    expect(priceUpdateFor(300, undefined)).toBeNull()
    expect(priceUpdateFor(300, 20)).toEqual({ preco: undefined })
    expect(priceUpdateFor(60, 500)).toEqual({ preco: 60 })
    expect(priceUpdateFor(60, 60)).toBeNull()
  })
})
