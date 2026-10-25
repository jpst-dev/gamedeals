import { describe, expect, it, vi } from 'vitest'
import { normalizeSearchTerm } from '../../app/utils/search'
import { buildSuggestions, suggestCacheKey } from '../../server/utils/suggest'
import type { ItadFetcher } from '../../server/utils/deals'

const GAME_A = '018d937f-0000-7000-8000-00000000000a'
const DLC_B = '018d937f-0000-7000-8000-00000000000b'
const PACKAGE_C = '018d937f-0000-7000-8000-00000000000c'

type Call = { path: string; options?: { method?: string; params?: Record<string, unknown>; body?: unknown } }

const fakeItad = (prices: () => unknown) => {
  const calls: Call[] = []
  const fetcher = (async (path: string, options?: Call['options']) => {
    calls.push({ path, options })
    if (path === '/games/search/v1') {
      return [
        { id: GAME_A, slug: 'a', title: 'Game A', type: 'game', assets: { boxart: 'box.jpg', banner300: 'a.jpg' } },
        { id: DLC_B, slug: 'b', title: 'DLC B', type: 'dlc', assets: {} },
        { id: PACKAGE_C, slug: 'c', title: 'Bundle C', type: 'package', assets: {} }
      ]
    }
    return prices()
  }) as ItadFetcher
  return { fetcher, calls }
}

const priceOfA = [{
  id: GAME_A,
  historyLow: { all: { amount: 59.95 } },
  deals: [{ shop: { name: 'GOG' }, price: { amount: 59.95 }, regular: { amount: 199.9 }, cut: 70 }]
}]

describe('normalizeSearchTerm', () => {
  it('normaliza o termo', () => {
    expect(normalizeSearchTerm('  Cyberpunk   2077 ')).toBe('cyberpunk 2077')
    expect(normalizeSearchTerm(42)).toBe('')
  })
})

describe('buildSuggestions', () => {
  it('junta busca e preços', async () => {
    const { fetcher, calls } = fakeItad(() => priceOfA)
    const result = await buildSuggestions('game', 8, fetcher)

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      id: GAME_A,
      slug: 'a',
      title: 'Game A',
      image: 'a.jpg',
      type: 'game',
      price: { amount: 59.95, regular: 199.9, cut: 70, shop: 'GOG', isHistoryLow: true }
    })
    expect(result[1]).toMatchObject({ id: DLC_B, type: 'dlc', price: null })

    const priceCalls = calls.filter((call) => call.path === '/games/prices/v3')
    expect(priceCalls).toHaveLength(1)
    expect(priceCalls[0]?.options?.method).toBe('POST')
    expect(priceCalls[0]?.options?.body).toEqual([GAME_A, DLC_B])
    expect(priceCalls[0]?.options?.params?.country).toBe('BR')
  })

  it('sem preços quando a ITAD de preços falha', async () => {
    const { fetcher } = fakeItad(() => {
      throw new Error('ITAD down')
    })
    const result = await buildSuggestions('game', 8, fetcher)
    expect(result).toHaveLength(2)
    expect(result.every((item) => item.price === null)).toBe(true)
  })

  it('termo vazio não chama a ITAD', async () => {
    const fetcher = vi.fn() as unknown as ItadFetcher
    await expect(buildSuggestions('', 8, fetcher)).resolves.toEqual([])
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('respeita o limite', async () => {
    const { fetcher, calls } = fakeItad(() => [])
    await buildSuggestions('game', 3, fetcher)
    expect(calls[0]?.options?.params?.results).toBe(3)
  })
})

describe('suggestCacheKey', () => {
  // Nitro strips every non-word character from custom cache keys.
  const stored = (key: string): string => key.replace(/\W/g, '')

  it('buscas diferentes não dividem a mesma entrada de cache', () => {
    const keys = [suggestCacheKey('halo 2', 8), suggestCacheKey('halo2', 8), suggestCacheKey('原神', 8), suggestCacheKey('ведьмак', 8), suggestCacheKey('pokémon', 8), suggestCacheKey('pokmon', 8)]
    expect(new Set(keys.map(stored)).size).toBe(keys.length)
    expect(keys.every((key) => stored(key) === key)).toBe(true)
  })

  it('mesmo termo escrito diferente usa a mesma entrada', () => {
    expect(suggestCacheKey('  Halo   2 ', 8)).toBe(suggestCacheKey('halo 2', 8))
    expect(suggestCacheKey('halo', 8)).not.toBe(suggestCacheKey('halo', 5))
  })
})
