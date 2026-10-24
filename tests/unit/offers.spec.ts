import { describe, expect, it } from 'vitest'
import type { PriceRow } from '../../composables/useGamesApi'
import { formatBrl } from '../../utils/money'
import { activationText, rankOffers } from '../../utils/offers'

const row = (store: string, price: number, extra: Partial<PriceRow> = {}): PriceRow =>
  ({ store, price, discount: 0, activation: 'Steam', platforms: 'Windows', link: '#', ...extra })

describe('utils/offers', () => {
  it('ranks offers by price with one best and deltas', () => {
    const ranked = rankOffers([row('Epic', 149.99), row('GOG', 139.99, { historyLow: 139.99 }), row('Steam', 140.01)])
    expect(ranked.map((o) => [o.store, o.isBest, o.deltaFromBest, o.isHistoryLow])).toEqual([
      ['GOG', true, 0, true], ['Steam', false, 0.02, false], ['Epic', false, 10, false]
    ])
  })

  it('marks only one best on ties and drops invalid prices', () => {
    const ranked = rankOffers([row('A', 10), row('B', 10), row('C', Number.NaN), row('D', -1)])
    expect(ranked.map((o) => [o.store, o.isBest, o.deltaFromBest])).toEqual([['A', true, 0], ['B', false, 0]])
  })

  it('returns an empty list without offers', () => {
    expect(rankOffers([])).toEqual([])
  })
})

describe('utils/money', () => {
  it('formats BRL and falls back to zero', () => {
    expect(formatBrl(59.9).replace(/\s/g, ' ')).toBe('R$ 59,90')
    expect(formatBrl(Number.NaN)).toBe(formatBrl(0))
  })
})

describe('activationText', () => {
  it('describes where the key activates', () => {
    expect(activationText('Steam')).toBe('Ativa na Steam')
    expect(activationText('Drm Free')).toBe('Sem DRM')
    expect(activationText('N/A')).toBe('')
    expect(activationText('')).toBe('')
  })
})
