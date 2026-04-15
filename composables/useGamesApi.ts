export type Game = {
  id: string
  slug: string
  title: string
  image: string
  price: { amount: number }[]
  regularPrice?: number
  discount?: number
  store?: string
  activation?: string
  platforms?: string
  region?: string
  expiryAt?: string
  dealTimestamp?: string
}

export type PriceRow = {
  store: string
  price: number
  regularPrice?: number
  discount: number
  activation: string
  platforms: string
  region: string
  historyLow?: number
  storeLow?: number
  updatedAt?: string
  link: string
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

type ProxyResponse<T> = {
  data: T
  warning?: string
}

export type TopGamesPageResult = {
  games: Game[]
  hasMore: boolean
  nextOffset: number
}

export type GameSuggestion = {
  id: string
  slug: string
  title: string
  image: string
  type: string
}

const normalizeGame = (item: Record<string, unknown>, fallbackIndex: number): Game => {
  const assets = (item.assets ?? {}) as Record<string, unknown>
  const maybePrice = item.price
  const priceArray = Array.isArray(maybePrice) ? maybePrice : []
  const normalizedPrice = priceArray
    .map((entry) => {
      const amount = typeof (entry as { amount?: unknown }).amount === 'number'
        ? (entry as { amount: number }).amount
        : Number((entry as { amount?: string }).amount ?? 0)
      return { amount: Number.isNaN(amount) ? 0 : amount }
    })
    .filter((entry) => entry.amount >= 0)

  const rawSlug = String(item.slug ?? '')
  const normalizedSlug = rawSlug
    || String(item.title ?? item.name ?? `game-${fallbackIndex}`)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')

  return {
    id: String(item.id ?? `game-${fallbackIndex}`),
    slug: normalizedSlug,
    title: String(item.title ?? item.name ?? 'Unknown game'),
    image: String(item.image ?? item.thumb ?? assets.boxart ?? assets.banner300 ?? assets.banner400 ?? ''),
    price: normalizedPrice.length > 0 ? normalizedPrice : [{ amount: 0 }]
  }
}

const normalizeDealGame = (item: Record<string, unknown>, fallbackIndex: number): Game | null => {
  const itemType = String(item.type ?? '')
  const itemTitle = String(item.title ?? 'Unknown game')
  const lowerTitle = itemTitle.toLowerCase()

  // Keep the home focused on actual games and avoid bundle-heavy noise.
  if (itemType !== 'game' || lowerTitle.includes('bundle')) {
    return null
  }

  const deal = (item.deal ?? {}) as Record<string, unknown>
  const dealPrice = (deal.price ?? {}) as Record<string, unknown>
  const regularPrice = (deal.regular ?? {}) as Record<string, unknown>
  const shop = (deal.shop ?? {}) as Record<string, unknown>
  const drm = Array.isArray(deal.drm) ? deal.drm : []
  const platforms = Array.isArray(deal.platforms) ? deal.platforms : []
  const amount = Number(dealPrice.amount ?? 0)
  const regularAmount = Number(regularPrice.amount ?? 0)
  const cut = Number(deal.cut ?? 0)
  const timestamp = typeof deal.timestamp === 'string' ? deal.timestamp : undefined
  const expiry = typeof deal.expiry === 'string' ? deal.expiry : undefined
  const assets = (item.assets ?? {}) as Record<string, unknown>
  const rawSlug = String(item.slug ?? '')
  const normalizedSlug = rawSlug
    || itemTitle
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')

  return {
    id: String(item.id ?? `deal-${fallbackIndex}`),
    slug: normalizedSlug,
    title: itemTitle,
    image: String(assets.boxart ?? assets.banner300 ?? assets.banner400 ?? ''),
    price: [{ amount: Number.isFinite(amount) ? amount : 0 }],
    regularPrice: Number.isFinite(regularAmount) ? regularAmount : 0,
    discount: Number.isFinite(cut) ? cut : 0,
    store: String(shop.name ?? ''),
    activation: drm
      .map((entry) => String((entry as { name?: unknown }).name ?? ''))
      .filter(Boolean)
      .join(', '),
    platforms: platforms
      .map((entry) => String((entry as { name?: unknown }).name ?? ''))
      .filter(Boolean)
      .join(', '),
    region: 'Global',
    expiryAt: expiry,
    dealTimestamp: timestamp
  }
}

export const useGamesApi = () => {
  const topGamesPageCache = useState<Record<string, TopGamesPageResult>>('top-games-page-cache', () => ({}))

  const getGameInfo = async (gameId: string): Promise<GameInfo> => {
    const response = await $fetch<ProxyResponse<Record<string, unknown>>>('/api/itad-proxy', {
      method: 'POST',
      body: {
        operation: 'info',
        gameId
      }
    })

    const entry = response.data ?? {}
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

    const response = await $fetch<ProxyResponse<unknown>>('/api/itad-proxy', {
      method: 'POST',
      body: {
        operation: 'prices',
        gameIds,
        onlyDeals: false
      }
    })

    const entries = Array.isArray(response.data) ? response.data : []
    const pricesMap = new Map<string, number>()

    for (const entry of entries) {
      const row = entry as Record<string, unknown>
      const deals = Array.isArray(row.deals) ? row.deals : []
      const bestDealPrice = deals.reduce<number>((bestPrice, currentDeal) => {
        const deal = currentDeal as Record<string, unknown>
        const priceNode = (deal.price ?? {}) as Record<string, unknown>
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
    const response = await $fetch<ProxyResponse<unknown>>('/api/itad-proxy', {
      method: 'POST',
      body: {
        operation: 'search',
        query,
        limit: 50
      }
    })

    const resultList = Array.isArray(response.data)
      ? response.data
      : ((response.data as { results?: unknown[] })?.results ?? [])

    const normalizedGames = resultList
      .map((item, index) => normalizeGame(item as Record<string, unknown>, index))
      .filter((item, index) => {
        const source = resultList[index] as Record<string, unknown>
        const type = String(source.type ?? '')
        return type === 'game' || type === 'dlc'
      })

    const gameIds = normalizedGames.map((game) => game.id)
    const pricesMap = await getBestPricesByGameId(gameIds)

    const gamesWithPrices = normalizedGames.map((game) => ({
      ...game,
      price: [{ amount: pricesMap.get(game.id) ?? game.price[0]?.amount ?? 0 }]
    }))

    const missingImageGames = gamesWithPrices.filter((game) => !game.image)
    if (missingImageGames.length === 0) {
      return gamesWithPrices
    }

    // Some search entries come without assets; try filling cover from detailed info endpoint.
    const imageEnrichmentResults = await Promise.allSettled(
      missingImageGames.map((game) => getGameInfo(game.id))
    )

    const imageById = new Map<string, string>()
    imageEnrichmentResults.forEach((result) => {
      if (result.status === 'fulfilled' && result.value.image) {
        imageById.set(result.value.id, result.value.image)
      }
    })

    const enrichedGames = gamesWithPrices.map((game) => ({
      ...game,
      image: imageById.get(game.id) ?? game.image
    }))

    // Keep search grid focused on entries users can actually compare (cover + valid price).
    return enrichedGames.filter((game) => {
      const hasImage = Boolean(game.image)
      const hasPrice = pricesMap.has(game.id)
      return hasImage && hasPrice
    })
  }

  const searchGameSuggestions = async (query: string, limit = 8): Promise<GameSuggestion[]> => {
    const cleanQuery = query.trim()
    if (!cleanQuery) {
      return []
    }

    const response = await $fetch<ProxyResponse<unknown>>('/api/itad-proxy', {
      method: 'POST',
      body: {
        operation: 'search',
        query: cleanQuery,
        limit: Math.min(Math.max(limit, 1), 20)
      }
    })

    const resultList = Array.isArray(response.data)
      ? response.data
      : ((response.data as { results?: unknown[] })?.results ?? [])

    return resultList
      .map((entry, index) => {
        const item = entry as Record<string, unknown>
        const normalizedGame = normalizeGame(item, index)
        const type = String(item.type ?? '')
        return {
          id: normalizedGame.id,
          slug: normalizedGame.slug,
          title: normalizedGame.title,
          image: normalizedGame.image,
          type
        }
      })
      .filter((entry) => entry.type === 'game' || entry.type === 'dlc')
  }

  const getTopGames = async (limit = 50, sort = '-hot', page = 1): Promise<TopGamesPageResult> => {
    const safePage = Math.max(page, 1)
    const offset = (safePage - 1) * limit
    const cacheKey = `${sort}:${limit}:${offset}`

    if (topGamesPageCache.value[cacheKey]) {
      return topGamesPageCache.value[cacheKey]
    }

    const response = await $fetch<ProxyResponse<unknown>>('/api/itad-proxy', {
      method: 'POST',
      body: {
        operation: 'top',
        limit,
        offset,
        sort
      }
    })

    const payload = response.data as { list?: unknown[]; hasMore?: unknown; nextOffset?: unknown } | unknown[]
    const resultList = Array.isArray(payload)
      ? payload
      : (Array.isArray(payload?.list) ? payload.list : [])

    const games = resultList
      .map((item, index) => normalizeDealGame(item as Record<string, unknown>, index))
      .filter((item): item is Game => item !== null)

    const pageResult: TopGamesPageResult = {
      games,
      hasMore: Array.isArray(payload) ? false : Boolean(payload?.hasMore),
      nextOffset: Array.isArray(payload) ? offset + games.length : Number(payload?.nextOffset ?? offset + games.length)
    }

    topGamesPageCache.value[cacheKey] = pageResult
    return pageResult
  }

  const getGameIdBySlug = async (slug: string): Promise<string> => {
    const normalizedSlug = slug.trim().toLowerCase()
    if (!normalizedSlug) {
      throw new Error('Slug is required.')
    }

    const response = await $fetch<ProxyResponse<unknown>>('/api/itad-proxy', {
      method: 'POST',
      body: {
        operation: 'search',
        query: normalizedSlug.replace(/-/g, ' '),
        limit: 100
      }
    })

    const resultList = Array.isArray(response.data)
      ? response.data
      : ((response.data as { results?: unknown[] })?.results ?? [])

    const exactMatch = resultList.find((entry) => {
      const row = entry as Record<string, unknown>
      const rowSlug = String(row.slug ?? '').toLowerCase()
      const rowType = String(row.type ?? '')
      return rowSlug === normalizedSlug && (rowType === 'game' || rowType === 'dlc')
    }) as Record<string, unknown> | undefined

    if (exactMatch?.id) {
      return String(exactMatch.id)
    }

    throw new Error('Game not found for this slug.')
  }

  const getPrices = async (gameId: string): Promise<PriceRow[]> => {
    const response = await $fetch<ProxyResponse<unknown>>('/api/itad-proxy', {
      method: 'POST',
      body: {
        operation: 'prices',
        gameId,
        onlyDeals: false,
        capacity: 30
      }
    })

    const entries = Array.isArray(response.data) ? response.data : []
    const firstEntry = (entries[0] ?? {}) as Record<string, unknown>
    const deals = (firstEntry.deals ?? []) as unknown[]

    return deals.map((entry) => {
      const deal = entry as Record<string, unknown>
      const shop = (deal.shop ?? {}) as Record<string, unknown>
      const price = (deal.price ?? {}) as Record<string, unknown>
      const regular = (deal.regular ?? {}) as Record<string, unknown>
      const drm = Array.isArray(deal.drm) ? deal.drm : []
      const platforms = Array.isArray(deal.platforms) ? deal.platforms : []
      const storeLow = (deal.storeLow ?? {}) as Record<string, unknown>
      const historyLow = (deal.historyLow ?? {}) as Record<string, unknown>

      return {
        store: String(shop.name ?? 'Unknown store'),
        price: Number(price.amount ?? 0),
        regularPrice: Number(regular.amount ?? 0),
        discount: Number(deal.cut ?? 0),
        activation: drm
          .map((item) => String((item as { name?: unknown }).name ?? ''))
          .filter(Boolean)
          .join(', ') || 'N/A',
        platforms: platforms
          .map((item) => String((item as { name?: unknown }).name ?? ''))
          .filter(Boolean)
          .join(', ') || 'N/A',
        region: 'Global',
        historyLow: Number(historyLow.amount ?? 0),
        storeLow: Number(storeLow.amount ?? 0),
        updatedAt: typeof deal.timestamp === 'string' ? deal.timestamp : undefined,
        link: String(deal.url ?? '#')
      }
    })
  }

  const getGameMedia = async (appid: number): Promise<GameMedia> => {
    if (!Number.isFinite(appid) || appid <= 0) {
      return {
        shortDescription: '',
        screenshots: [],
        videos: []
      }
    }

    const response = await $fetch<ProxyResponse<Record<string, unknown>>>('/api/itad-proxy', {
      method: 'POST',
      body: {
        operation: 'steamMedia',
        appid
      }
    })

    const dataNode = response.data ?? {}
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
    getTopGames,
    getGameIdBySlug,
    getGameInfo,
    getPrices,
    getGameMedia
  }
}
