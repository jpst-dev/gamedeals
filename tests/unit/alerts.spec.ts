import { describe, expect, it } from 'vitest'
import { decideAlert, pickBestPrice, type AlertState, type BestPrice } from '../../server/utils/alerts'

const deal = (amount: number, cut: number, shop: string, regular = 100) => ({
  shop: { id: 1, name: shop },
  price: { amount, currency: 'BRL' },
  regular: { amount: regular, currency: 'BRL' },
  cut
})

const best = (price: number, cut: number): BestPrice => ({
  gameId: 'g1', price, regular: 100, cut, shop: 'Steam', historyLow: null, isHistoryLow: false
})

describe('pickBestPrice', () => {
  it('escolhe o deal mais barato', () => {
    const result = pickBestPrice({
      id: 'g1',
      historyLow: { all: { amount: 30 } },
      deals: [deal(50, 50, 'Steam'), deal(40, 60, 'Nuuvem')]
    })
    expect(result).toEqual({ gameId: 'g1', price: 40, regular: 100, cut: 60, shop: 'Nuuvem', historyLow: 30, isHistoryLow: false })
  })

  it('marca o menor preço da história', () => {
    const result = pickBestPrice({ id: 'g1', historyLow: { all: { amount: 40 } }, deals: [deal(40, 60, 'Nuuvem')] })
    expect(result?.isHistoryLow).toBe(true)
  })

  it('sem deals ou com lixo devolve null', () => {
    expect(pickBestPrice({ id: 'g1', deals: [] })).toBeNull()
    expect(pickBestPrice(null)).toBeNull()
    expect(pickBestPrice({})).toBeNull()
  })
})

describe('decideAlert', () => {
  const cases: Array<[string, AlertState, BestPrice | null, boolean, AlertState]> = [
    ['sem preço não muda nada', { notifiedPrice: null, baselinePending: false }, null, false, { notifiedPrice: null, baselinePending: false }],
    ['promoção acabou zera o estado', { notifiedPrice: 89.9, baselinePending: false }, best(100, 0), false, { notifiedPrice: null, baselinePending: false }],
    ['primeira leitura em promoção só registra', { notifiedPrice: null, baselinePending: true }, best(40, 50), false, { notifiedPrice: 40, baselinePending: false }],
    ['primeira leitura sem promoção', { notifiedPrice: null, baselinePending: true }, best(100, 0), false, { notifiedPrice: null, baselinePending: false }],
    ['entrou em promoção avisa', { notifiedPrice: null, baselinePending: false }, best(40, 50), true, { notifiedPrice: 40, baselinePending: false }],
    ['mesma promoção não avisa de novo', { notifiedPrice: 40, baselinePending: false }, best(40, 50), false, { notifiedPrice: 40, baselinePending: false }],
    ['preço caiu na mesma promoção avisa', { notifiedPrice: 40, baselinePending: false }, best(30, 70), true, { notifiedPrice: 30, baselinePending: false }],
    ['preço subiu na mesma promoção não avisa', { notifiedPrice: 40, baselinePending: false }, best(45, 40), false, { notifiedPrice: 40, baselinePending: false }]
  ]

  it.each(cases)('%s', (_name, state, price, notify, next) => {
    expect(decideAlert(state, price)).toEqual({ notify, next })
  })
})
