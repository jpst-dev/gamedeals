import { catalogStateToDealParams, type CatalogState } from '../utils/catalog'

// ITAD deal flags: H = all-time low, N = new all-time low, S = store low.
export type HistoryLowFlag = 'H' | 'N' | 'S'

export type Game = {
  id: string
  slug: string
  title: string
  image: string
  images: string[]
  price: { amount: number }[]
  historyLowFlag?: HistoryLowFlag
  regularPrice?: number
  discount?: number
  store?: string
  activation?: string
  platforms?: string
  expiryAt?: string
  dealTimestamp?: string
}

export type PriceRow = {
  store: string
  shopId?: number
  price: number
  regularPrice?: number
  discount: number
  activation: string
  platforms: string
  historyLow?: number
  storeLow?: number
  updatedAt?: string
  link: string
  voucher?: string
}

export type GameInfo = {
  id: string
  title: string
  image: string
  appid?: number
  description?: string
  releaseDate?: string
  developers: string[]
  publishers: string[]
  tags: string[]
  galleryImages: string[]
  reviewStats: Array<{ source: string; score: number; count: number; url: string }>
  gameUrl?: string
}

export type GameMedia = {
  shortDescription?: string
  screenshots: string[]
  videos: Array<{
    id: number
    name: string
    thumbnail: string
    webm?: string
    mp4?: string
    hls?: string
    dash?: string
  }>
}

export type TopGamesPageResult = {
  games: Game[]
  hasMore: boolean
  nextOffset: number
}

export type Shop = {
  id: number
  title: string
}

export type HeroGame = Game & { appid: number }

export type HomeShelf = {
  key: string
  title: string
  href: string
  games: Game[]
}

export type GameSuggestion = {
  id: string
  slug: string
  title: string
  image: string
  type: string
}

export type PriceHistoryPoint = {
  timestamp: string
  price: number
  shop: string
}

const slugify = (value: string): string => {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

const namesOf = (value: unknown): string => {
  return (Array.isArray(value) ? value : [])
    .map((entry) => String((entry as { name?: unknown }).name ?? ''))
    .filter(Boolean)
    .join(', ')
}

const asList = (value: unknown): unknown[] => {
  if (Array.isArray(value)) {
    return value
  }

  const results = (value as { results?: unknown } | null)?.results
  return Array.isArray(results) ? results : []
}

const isComparableType = (item: Record<string, unknown>): boolean => {
  const type = String(item.type ?? '')
  return type === 'game' || type === 'dlc'
}

// Cover candidates in preference order: the 2:3 boxart first, then wider banners.
const coverImagesOf = (assets: unknown): string[] => {
  const node = (assets ?? {}) as Record<string, unknown>
  return [node.boxart, node.banner600, node.banner400, node.banner300]
    .filter((image): image is string => typeof image === 'string' && image.length > 0)
}

const normalizeGame = (item: Record<string, unknown>, fallbackIndex: number): Game => {
  const title = String(item.title ?? item.name ?? `game-${fallbackIndex}`)
  const images = coverImagesOf(item.assets)

  return {
    id: String(item.id ?? `game-${fallbackIndex}`),
    slug: String(item.slug ?? '') || slugify(title),
    title: String(item.title ?? item.name ?? 'Unknown game'),
    image: images[0] ?? '',
    images,
    price: [{ amount: 0 }]
  }
}

export const normalizeDealGame = (item: Record<string, unknown>, fallbackIndex: number): Game | null => {
  const itemType = String(item.type ?? '')
  if (itemType !== 'game' && itemType !== 'dlc') {
    return null
  }

  const itemTitle = String(item.title ?? 'Unknown game')
  const deal = (item.deal ?? {}) as Record<string, unknown>
  const dealPrice = (deal.price ?? {}) as Record<string, unknown>
  const regularPrice = (deal.regular ?? {}) as Record<string, unknown>
  const shop = (deal.shop ?? {}) as Record<string, unknown>
  const amount = Number(dealPrice.amount ?? 0)
  const regularAmount = Number(regularPrice.amount ?? 0)
  const cut = Number(deal.cut ?? 0)
  const images = coverImagesOf(item.assets)
  const flag = ['H', 'N', 'S'].includes(String(deal.flag)) ? (deal.flag as HistoryLowFlag) : undefined

  return {
    id: String(item.id ?? `deal-${fallbackIndex}`),
    slug: String(item.slug ?? '') || slugify(itemTitle),
    title: itemTitle,
    image: images[0] ?? '',
    images,
    price: [{ amount: Number.isFinite(amount) ? amount : 0 }],
    historyLowFlag: flag,
    regularPrice: Number.isFinite(regularAmount) ? regularAmount : 0,
    discount: Number.isFinite(cut) ? cut : 0,
    store: String(shop.name ?? ''),
    activation: namesOf(deal.drm),
    platforms: namesOf(deal.platforms),
    expiryAt: typeof deal.expiry === 'string' ? deal.expiry : undefined,
    dealTimestamp: typeof deal.timestamp === 'string' ? deal.timestamp : undefined
  }
}

// ITAD history is a list of per-shop price changes. Replay it to get the
// cheapest price available across all shops at each point in time.
export const buildLowestPriceTimeline = (entries: unknown[]): PriceHistoryPoint[] => {
  const changes = entries
    .map((entry) => {
      const row = entry as Record<string, unknown>
      const shop = (row.shop ?? {}) as Record<string, unknown>
      const deal = (row.deal ?? {}) as Record<string, unknown>
      const price = Number(((deal.price ?? {}) as Record<string, unknown>).amount)
      return {
        timestamp: String(row.timestamp ?? ''),
        time: new Date(String(row.timestamp ?? '')).getTime(),
        shopId: String(shop.id ?? shop.name ?? ''),
        shopName: String(shop.name ?? ''),
        price
      }
    })
    .filter((change) => Number.isFinite(change.time) && Number.isFinite(change.price))
    .sort((a, b) => a.time - b.time)

  const currentByShop = new Map<string, { price: number; shop: string }>()
  const timeline: PriceHistoryPoint[] = []

  for (const change of changes) {
    currentByShop.set(change.shopId, { price: change.price, shop: change.shopName })
    let cheapest = { price: Number.POSITIVE_INFINITY, shop: '' }
    for (const value of currentByShop.values()) {
      if (value.price < cheapest.price) {
        cheapest = value
      }
    }

    const previous = timeline[timeline.length - 1]
    if (previous && previous.price === cheapest.price) {
      continue
    }

    timeline.push({ timestamp: change.timestamp, price: cheapest.price, shop: cheapest.shop })
  }

  return timeline
}

export const useGamesApi = () => {
  const topGamesPageCache = useState<Record<string, TopGamesPageResult>>('top-games-page-cache', () => ({}))

  const getGameInfo = async (gameId: string): Promise<GameInfo> => {
    const entry = await $fetch<Record<string, unknown>>(`/api/games/${encodeURIComponent(gameId)}`) ?? {}
    const assets = (entry.assets ?? {}) as Record<string, unknown>
    const appidRaw = Number(entry.appid)
    const appid = Number.isFinite(appidRaw) ? appidRaw : undefined
    const steamHeader = appid
      ? `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`
      : ''
    return {
      id: String(entry.id ?? gameId),
      title: String(entry.title ?? entry.name ?? 'Unknown game'),
      image: String(assets.boxart ?? assets.banner300 ?? assets.banner400 ?? steamHeader),
      appid,
      releaseDate: typeof entry.releaseDate === 'string' ? entry.releaseDate : undefined,
      developers: Array.isArray(entry.developers)
        ? entry.developers
          .map((developer) => String((developer as { name?: unknown }).name ?? ''))
          .filter(Boolean)
        : [],
      publishers: Array.isArray(entry.publishers)
        ? entry.publishers
          .map((publisher) => String((publisher as { name?: unknown }).name ?? ''))
          .filter(Boolean)
        : [],
      tags: Array.isArray(entry.tags)
        ? entry.tags.map((tag) => String(tag)).filter(Boolean)
        : [],
      galleryImages: [assets.boxart, assets.banner145, assets.banner300, assets.banner400, assets.banner600]
        .map((image) => String(image ?? ''))
        .filter(Boolean),
      reviewStats: Array.isArray(entry.reviews)
        ? entry.reviews.map((review) => {
          const reviewData = review as Record<string, unknown>
          return {
            source: String(reviewData.source ?? 'Unknown'),
            score: Number(reviewData.score ?? 0),
            count: Number(reviewData.count ?? 0),
            url: String(reviewData.url ?? '')
          }
        })
        : [],
      gameUrl: typeof (entry.urls as { game?: unknown } | undefined)?.game === 'string'
        ? String((entry.urls as { game: string }).game)
        : undefined,
      description: typeof entry.description === 'string' ? entry.description : undefined
    }
  }

  const getBestPricesByGameId = async (gameIds: string[]): Promise<Map<string, number>> => {
    if (gameIds.length === 0) {
      return new Map()
    }

    const response = await $fetch<unknown>('/api/games/prices', {
      query: { ids: gameIds.join(',') }
    })

    const pricesMap = new Map<string, number>()
    for (const entry of asList(response)) {
      const row = entry as Record<string, unknown>
      const deals = Array.isArray(row.deals) ? row.deals : []
      const bestDealPrice = deals.reduce<number>((bestPrice, currentDeal) => {
        const priceNode = ((currentDeal as Record<string, unknown>).price ?? {}) as Record<string, unknown>
        const amount = Number(priceNode.amount ?? Number.POSITIVE_INFINITY)
        return amount < bestPrice ? amount : bestPrice
      }, Number.POSITIVE_INFINITY)

      if (Number.isFinite(bestDealPrice)) {
        pricesMap.set(String(row.id ?? ''), bestDealPrice)
      }
    }

    return pricesMap
  }

  const searchGames = async (query: string): Promise<Game[]> => {
    const response = await $fetch<unknown>('/api/games/search', {
      query: { q: query, limit: 50 }
    })

    const games = asList(response)
      .map((item) => item as Record<string, unknown>)
      .filter(isComparableType)
      .map((item, index) => normalizeGame(item, index))
      // Entries without cover are almost always obscure duplicates; skip them
      // instead of firing one extra request per result to look for an image.
      .filter((game) => Boolean(game.image))

    const pricesMap = await getBestPricesByGameId(games.map((game) => game.id))

    // Keep search grid focused on entries users can actually compare (cover + valid price).
    return games
      .filter((game) => pricesMap.has(game.id))
      .map((game) => ({ ...game, price: [{ amount: pricesMap.get(game.id) ?? 0 }] }))
  }

  const searchGameSuggestions = async (query: string, limit = 8): Promise<GameSuggestion[]> => {
    const cleanQuery = query.trim()
    if (!cleanQuery) {
      return []
    }

    const response = await $fetch<unknown>('/api/games/search', {
      query: { q: cleanQuery, limit: Math.min(Math.max(limit, 1), 20) }
    })

    return asList(response)
      .map((entry) => entry as Record<string, unknown>)
      .filter(isComparableType)
      .map((item, index) => {
        const { id, slug, title, image } = normalizeGame(item, index)
        return { id, slug, title, image, type: String(item.type ?? '') }
      })
  }

  // offset is ITAD's nextOffset from the previous page: the server may read
  // several ITAD pages per batch, so pages are not limit-sized steps.
  const getDealsPage = async (state: CatalogState, offset: number, limit = 20): Promise<TopGamesPageResult> => {
    const query = Object.fromEntries(
      Object.entries({ ...catalogStateToDealParams(state), limit, offset })
        .filter(([, value]) => value !== undefined)
    )
    const cacheKey = JSON.stringify(query)

    if (topGamesPageCache.value[cacheKey]) {
      return topGamesPageCache.value[cacheKey]
    }

    const payload = await $fetch<{ list?: unknown[]; hasMore?: unknown; nextOffset?: unknown }>('/api/deals', { query })

    const games = (Array.isArray(payload?.list) ? payload.list : [])
      .map((item, index) => normalizeDealGame(item as Record<string, unknown>, index))
      .filter((item): item is Game => item !== null)

    const pageResult: TopGamesPageResult = {
      games,
      hasMore: Boolean(payload?.hasMore),
      nextOffset: Number(payload?.nextOffset ?? offset + games.length)
    }

    topGamesPageCache.value[cacheKey] = pageResult
    return pageResult
  }

  const getShops = async (): Promise<Shop[]> => {
    const shops = await $fetch<Shop[]>('/api/shops')
    return Array.isArray(shops) ? shops : []
  }

  const getHome = async (): Promise<{ hero: HeroGame[]; shelves: HomeShelf[] }> => {
    const payload = await $fetch<{
      hero?: Array<{ deal?: unknown; appid?: unknown }>
      shelves?: Array<{ key?: unknown; title?: unknown; href?: unknown; items?: unknown[] }>
    }>('/api/home')

    const hero = (payload?.hero ?? []).flatMap((entry, index) => {
      const game = normalizeDealGame((entry.deal ?? {}) as Record<string, unknown>, index)
      const appid = Number(entry.appid)
      return game && Number.isInteger(appid) && appid > 0 ? [{ ...game, appid }] : []
    })

    const shelves = (payload?.shelves ?? []).map((shelf) => ({
      key: String(shelf.key ?? ''),
      title: String(shelf.title ?? ''),
      href: String(shelf.href ?? '/ofertas'),
      games: (shelf.items ?? [])
        .map((item, index) => normalizeDealGame((item ?? {}) as Record<string, unknown>, index))
        .filter((game): game is Game => game !== null)
    })).filter((shelf) => shelf.games.length > 0)

    return { hero, shelves }
  }

  const getGameIdBySlug = async (slug: string): Promise<string> => {
    const normalizedSlug = slug.trim().toLowerCase()
    if (!normalizedSlug) {
      throw new Error('Slug is required.')
    }

    const title = normalizedSlug.replace(/-/g, ' ')
    const lookup = await $fetch<{ found?: boolean; game?: { id?: string; slug?: string } }>('/api/games/lookup', {
      query: { title }
    }).catch(() => null)

    if (lookup?.found && lookup.game?.id && lookup.game.slug === normalizedSlug) {
      return lookup.game.id
    }

    // Lookup matches by title; slugs with punctuation (e.g. "baldurs-gate-3") may
    // not round-trip, so fall back to searching for an exact slug.
    const response = await $fetch<unknown>('/api/games/search', {
      query: { q: title, limit: 50 }
    })

    const exactMatch = asList(response).find((entry) => {
      const row = entry as Record<string, unknown>
      return String(row.slug ?? '').toLowerCase() === normalizedSlug && isComparableType(row)
    }) as Record<string, unknown> | undefined

    if (exactMatch?.id) {
      return String(exactMatch.id)
    }

    throw new Error('Game not found for this slug.')
  }

  const getPrices = async (gameId: string): Promise<PriceRow[]> => {
    const response = await $fetch<unknown>(`/api/games/${encodeURIComponent(gameId)}/prices`)
    const firstEntry = (asList(response)[0] ?? {}) as Record<string, unknown>
    const deals = Array.isArray(firstEntry.deals) ? firstEntry.deals : []
    // The all-time low is reported once per game, not per deal.
    const gameHistoryLow = ((firstEntry.historyLow ?? {}) as Record<string, unknown>).all as Record<string, unknown> | undefined

    return deals.map((entry) => {
      const deal = entry as Record<string, unknown>
      const shop = (deal.shop ?? {}) as Record<string, unknown>
      const price = (deal.price ?? {}) as Record<string, unknown>
      const regular = (deal.regular ?? {}) as Record<string, unknown>
      const storeLow = (deal.storeLow ?? {}) as Record<string, unknown>
      const historyLow = (gameHistoryLow ?? {}) as Record<string, unknown>

      return {
        store: String(shop.name ?? 'Loja desconhecida'),
        shopId: Number.isInteger(shop.id) ? Number(shop.id) : undefined,
        price: Number(price.amount ?? 0),
        regularPrice: Number(regular.amount ?? 0),
        discount: Number(deal.cut ?? 0),
        activation: namesOf(deal.drm) || 'N/A',
        platforms: namesOf(deal.platforms) || 'N/A',
        historyLow: Number(historyLow.amount ?? 0),
        storeLow: Number(storeLow.amount ?? 0),
        updatedAt: typeof deal.timestamp === 'string' ? deal.timestamp : undefined,
        link: String(deal.url ?? '#'),
        voucher: typeof deal.voucher === 'string' && deal.voucher ? deal.voucher : undefined
      }
    })
  }

  const getPriceHistory = async (gameId: string): Promise<PriceHistoryPoint[]> => {
    const response = await $fetch<unknown>(`/api/games/${encodeURIComponent(gameId)}/history`)
    return buildLowestPriceTimeline(asList(response))
  }

  const getGameMedia = async (appid: number): Promise<GameMedia> => {
    if (!Number.isFinite(appid) || appid <= 0) {
      return {
        shortDescription: '',
        screenshots: [],
        videos: []
      }
    }

    const dataNode = await $fetch<Record<string, unknown>>(`/api/steam/${appid}`) ?? {}
    const screenshotsNode = Array.isArray(dataNode.screenshots) ? dataNode.screenshots : []
    const videosNode = Array.isArray(dataNode.videos) ? dataNode.videos : []
    const shortDescription = typeof dataNode.shortDescription === 'string'
      ? dataNode.shortDescription
      : ''

    return {
      shortDescription,
      screenshots: screenshotsNode
        .map((item) => String((item as { path_full?: unknown }).path_full ?? ''))
        .filter(Boolean),
      videos: videosNode
        .map((item) => {
          const row = item as Record<string, unknown>
          const webmNode = (row.webm ?? {}) as Record<string, unknown>
          const mp4Node = (row.mp4 ?? {}) as Record<string, unknown>
          const hls = typeof row.hls_h264 === 'string' ? row.hls_h264 : undefined
          const dash = typeof row.dash_h264 === 'string' ? row.dash_h264 : undefined
          return {
            id: Number(row.id ?? 0),
            name: String(row.name ?? 'Trailer'),
            thumbnail: String(row.thumbnail ?? ''),
            webm: typeof webmNode.max === 'string' ? webmNode.max : undefined,
            mp4: typeof mp4Node.max === 'string' ? mp4Node.max : undefined,
            hls,
            dash
          }
        })
        .filter((video) => Boolean(video.webm || video.mp4 || video.hls || video.dash))
    }
  }

  return {
    searchGames,
    searchGameSuggestions,
    getDealsPage,
    getHome,
    getShops,
    getGameIdBySlug,
    getGameInfo,
    getPrices,
    getPriceHistory,
    getGameMedia
  }
}
