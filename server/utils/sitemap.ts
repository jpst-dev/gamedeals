import { DEAL_COLLECTIONS } from '../../utils/catalog'
import { fetchDealsPage, parseDealQuery, type ItadFetcher } from './deals'
import { itadFetch } from './itad'

export type SitemapUrl = { loc: string; changefreq: 'daily' }

const SITEMAP_PAGES = 10
const SITEMAP_PAGE_SIZE = 50

// Collections plus the game pages of the most popular deals (~500 games).
export const buildSitemapUrls = async (fetcher: ItadFetcher = itadFetch): Promise<SitemapUrl[]> => {
  const locs = DEAL_COLLECTIONS.map((collection) => `/ofertas/${collection.slug}`)
  const slugs = new Set<string>()

  try {
    let offset = 0
    for (let page = 0; page < SITEMAP_PAGES; page++) {
      const result = await fetchDealsPage(parseDealQuery({ sort: '-hot', limit: SITEMAP_PAGE_SIZE, offset }), fetcher)
      for (const item of result.list) {
        const slug = String(((item ?? {}) as Record<string, unknown>).slug ?? '').trim()
        if (slug) {
          slugs.add(slug)
        }
      }
      if (!result.hasMore) {
        break
      }
      offset = result.nextOffset
    }
  } catch {
    // ITAD down: keep whatever was collected; collections are always listed.
  }

  return [...locs, ...[...slugs].map((slug) => `/game/${slug}`)].map((loc) => ({ loc, changefreq: 'daily' }))
}
