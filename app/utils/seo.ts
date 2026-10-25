import { formatBrl } from './money'
import type { RankedOffer } from './offers'

const shopCount = (count: number): string => `${count} ${count === 1 ? 'loja' : 'lojas'}`

export const buildGameSeoTitle = (title: string, offers: RankedOffer[]): string => {
  const best = offers[0]
  return best
    ? `${title} por ${formatBrl(best.price)} — compare preços em ${shopCount(offers.length)}`
    : `${title} — preços e histórico`
}

export const buildGameSeoDescription = (title: string, offers: RankedOffer[]): string => {
  const best = offers[0]
  if (!best) {
    return `Veja o histórico de preços de ${title} nas lojas digitais.`
  }

  return `Compare o preço de ${title} em ${shopCount(offers.length)} no Brasil. Menor preço agora: ${formatBrl(best.price)} na ${best.store}. Veja o histórico de preços.`
}

export const buildProductJsonLd = (input: {
  name: string
  url: string
  image?: string
  description?: string
  offers: RankedOffer[]
}): Record<string, unknown> => {
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: input.name,
    url: input.url
  }
  if (input.image) {
    ld.image = input.image
  }
  if (input.description) {
    ld.description = input.description
  }

  if (input.offers.length > 0) {
    const prices = input.offers.map((offer) => offer.price)
    ld.offers = {
      '@type': 'AggregateOffer',
      priceCurrency: 'BRL',
      lowPrice: Math.min(...prices),
      highPrice: Math.max(...prices),
      offerCount: input.offers.length,
      offers: input.offers.map((offer) => ({
        '@type': 'Offer',
        price: offer.price,
        priceCurrency: 'BRL',
        url: offer.link,
        availability: 'https://schema.org/InStock',
        seller: { '@type': 'Organization', name: offer.store }
      }))
    }
  }

  return ld
}

// Titles and descriptions come from ITAD; escape "<" and ">" so the JSON can
// never close the surrounding <script> tag.
export const serializeJsonLd = (data: Record<string, unknown>): string => {
  // Built from parts: a literal unicode escape here is too easy to lose in an edit.
  const escape = (char: string): string => '\\' + 'u' + char.charCodeAt(0).toString(16).padStart(4, '0')
  return JSON.stringify(data).replace(/[<>]/g, escape)
}
