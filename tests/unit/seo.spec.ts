import { describe, expect, it } from 'vitest'
import { formatBrl } from '../../app/utils/money'
import type { RankedOffer } from '../../app/utils/offers'
import { buildGameSeoDescription, buildGameSeoTitle, buildProductJsonLd } from '../../app/utils/seo'

const offer = (store: string, price: number, url = `https://x/${store}`) =>
  ({ store, price, regularPrice: 199.99, discount: 30, activation: 'Steam', platforms: 'Windows', link: url, isBest: false, deltaFromBest: 0, isHistoryLow: false }) as RankedOffer

describe('utils/seo', () => {
  it('builds the game title with best price and shop count', () => {
    expect(buildGameSeoTitle("Baldur's Gate 3", [offer('GOG', 139.99), offer('Steam', 140.01)]))
      .toBe(`Baldur's Gate 3 por ${formatBrl(139.99)} — compare preços em 2 lojas`)
    expect(buildGameSeoTitle('Hades', [offer('GOG', 10)])).toBe(`Hades por ${formatBrl(10)} — compare preços em 1 loja`)
    expect(buildGameSeoTitle('Hades', [])).toBe('Hades — preços e histórico')
  })

  it('builds the game description', () => {
    expect(buildGameSeoDescription('Hades', [offer('GOG', 10), offer('Steam', 12)]))
      .toBe(`Compare o preço de Hades em 2 lojas no Brasil. Menor preço agora: ${formatBrl(10)} na GOG. Veja o histórico de preços.`)
    expect(buildGameSeoDescription('Hades', [offer('GOG', 10)]))
      .toBe(`Compare o preço de Hades em 1 loja no Brasil. Menor preço agora: ${formatBrl(10)} na GOG. Veja o histórico de preços.`)
    expect(buildGameSeoDescription('Hades', [])).toBe('Veja o histórico de preços de Hades nas lojas digitais.')
  })

  it('builds Product JSON-LD with an aggregate offer', () => {
    const ld = buildProductJsonLd({ name: 'BG3', url: 'https://site/game/bg3', image: 'img', offers: [offer('GOG', 139.99), offer('Epic', 149.99)] })
    expect(ld).toEqual({
      '@context': 'https://schema.org', '@type': 'Product', name: 'BG3', url: 'https://site/game/bg3', image: 'img',
      offers: { '@type': 'AggregateOffer', priceCurrency: 'BRL', lowPrice: 139.99, highPrice: 149.99, offerCount: 2,
        offers: [
          { '@type': 'Offer', price: 139.99, priceCurrency: 'BRL', url: 'https://x/GOG', availability: 'https://schema.org/InStock', seller: { '@type': 'Organization', name: 'GOG' } },
          { '@type': 'Offer', price: 149.99, priceCurrency: 'BRL', url: 'https://x/Epic', availability: 'https://schema.org/InStock', seller: { '@type': 'Organization', name: 'Epic' } }
        ] }
    })
  })

  it('omits offers when there are none', () => {
    expect(buildProductJsonLd({ name: 'X', url: 'u', offers: [] })).not.toHaveProperty('offers')
  })

  it('escapes markup-breaking characters when serialized for a script tag', async () => {
    const { serializeJsonLd } = await import('../../app/utils/seo')
    const json = serializeJsonLd({ name: '</script><b>' })
    expect(json).not.toMatch(/[<>]/)
    expect(json).toContain('\\' + 'u003c/script')
    expect(JSON.parse(json)).toEqual({ name: '</script><b>' })
  })
})
