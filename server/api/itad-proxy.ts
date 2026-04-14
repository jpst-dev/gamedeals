type ItadOperation = 'search' | 'info' | 'prices' | 'top'

type ItadProxyBody = {
  operation: ItadOperation
  query?: string
  gameId?: string
  gameIds?: string[]
  onlyDeals?: boolean
  capacity?: number
  country?: string
  limit?: number
  offset?: number
  sort?: string
}

const ITAD_BASE_URL = 'https://api.isthereanydeal.com'
const PROXY_CACHE_MAX_ENTRIES = 250
const PROXY_CACHE_TTLS_MS: Record<ItadOperation, number> = {
  top: 60_000,
  search: 45_000,
  info: 300_000,
  prices: 90_000
}
const proxyResponseCache = new Map<string, { expiresAt: number; data: unknown }>()

const pruneExpiredCacheEntries = (): void => {
  const now = Date.now()
  for (const [key, value] of proxyResponseCache.entries()) {
    if (value.expiresAt <= now) {
      proxyResponseCache.delete(key)
    }
  }
}

const readFromProxyCache = (cacheKey: string): unknown | null => {
  const entry = proxyResponseCache.get(cacheKey)
  if (!entry) {
    return null
  }

  if (entry.expiresAt <= Date.now()) {
    proxyResponseCache.delete(cacheKey)
    return null
  }

  return entry.data
}

const writeToProxyCache = (cacheKey: string, ttlMs: number, data: unknown): void => {
  pruneExpiredCacheEntries()
  if (proxyResponseCache.size >= PROXY_CACHE_MAX_ENTRIES) {
    const oldestKey = proxyResponseCache.keys().next().value
    if (oldestKey) {
      proxyResponseCache.delete(oldestKey)
    }
  }

  proxyResponseCache.set(cacheKey, {
    expiresAt: Date.now() + ttlMs,
    data
  })
}

const withApiKey = (config: ReturnType<typeof useRuntimeConfig>, path: string): string => {
  const url = new URL(path, ITAD_BASE_URL)
  url.searchParams.set('key', config.itadApiKey)
  return url.toString()
}

const createTopGamesFallback = (limit: number): Array<Record<string, unknown>> => {
  return Array.from({ length: limit }).map((_, index) => {
    const numericId = index + 1
    return {
      id: `mock-${numericId}`,
      title: `Top Game ${numericId}`,
      image: `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/730/header.jpg`,
      price: [{ amount: Number((9.99 + index * 0.45).toFixed(2)) }]
    }
  })
}

const createCacheKey = (
  operation: ItadOperation,
  payload: Record<string, unknown>
): string => {
  const stablePayload = Object.keys(payload)
    .sort()
    .reduce<Record<string, unknown>>((accumulator, key) => {
      accumulator[key] = payload[key]
      return accumulator
    }, {})

  return `${operation}:${JSON.stringify(stablePayload)}`
}


export default defineEventHandler(
  async (event) => {
    const config = useRuntimeConfig(event)
    const body = await readBody<ItadProxyBody>(event).catch(() => undefined)
    const query = getQuery(event)
    const queryOperation = typeof query.operation === 'string' ? query.operation : undefined
    const operation = (body?.operation ?? queryOperation) as ItadOperation | undefined
    const limit = typeof body?.limit === 'number'
      ? body.limit
      : (typeof query.limit === 'string' ? Number(query.limit) : undefined)
    const offset = typeof body?.offset === 'number'
      ? body.offset
      : (typeof query.offset === 'string' ? Number(query.offset) : undefined)
    const sort = typeof body?.sort === 'string'
      ? body.sort
      : (typeof query.sort === 'string' ? query.sort : undefined)
    const hasValidApiKey = Boolean(config.itadApiKey)

    if (!operation) {
      return {
        data: [],
        warning: 'operation is required'
      }
    }

    if (!hasValidApiKey) {
      if (operation === 'top') {
        return {
          data: createTopGamesFallback(limit ?? 50)
        }
      }

      return {
        data: [],
        warning: 'Set ITAD_API_KEY in your environment variables.'
      }
    }

    if (operation === 'search') {
      const cacheKey = createCacheKey('search', {
        query: body?.query ?? '',
        limit: limit ?? 24
      })
      const cachedData = readFromProxyCache(cacheKey)
      if (cachedData) {
        return { data: cachedData }
      }

      const endpoint = withApiKey(
        config,
        `/games/search/v1?title=${encodeURIComponent(body?.query ?? '')}&results=${limit ?? 24}`
      )
      const response = await $fetch(endpoint)
      writeToProxyCache(cacheKey, PROXY_CACHE_TTLS_MS.search, response)
      return { data: response }
    }

    if (operation === 'info') {
      const cacheKey = createCacheKey('info', {
        gameId: body?.gameId ?? ''
      })
      const cachedData = readFromProxyCache(cacheKey)
      if (cachedData) {
        return { data: cachedData }
      }

      const endpoint = withApiKey(
        config,
        `/games/info/v2?id=${encodeURIComponent(body?.gameId ?? '')}`
      )
      const response = await $fetch(endpoint)
      writeToProxyCache(cacheKey, PROXY_CACHE_TTLS_MS.info, response)
      return { data: response }
    }

    if (operation === 'prices') {
      const idsPayload = Array.isArray(body?.gameIds) && body.gameIds.length > 0
        ? body.gameIds
        : (body?.gameId ? [body.gameId] : [])
      const normalizedIds = [...idsPayload].sort()
      const cacheKey = createCacheKey('prices', {
        ids: normalizedIds,
        country: body?.country ?? 'BR',
        onlyDeals: body?.onlyDeals ?? true,
        capacity: body?.capacity ?? 1
      })
      const cachedData = readFromProxyCache(cacheKey)
      if (cachedData) {
        return { data: cachedData }
      }

      const url = new URL(withApiKey(config, '/games/prices/v3'))
      url.searchParams.set('country', body?.country ?? 'BR')
      url.searchParams.set('deals', String(body?.onlyDeals ?? true))
      url.searchParams.set('vouchers', 'true')
      url.searchParams.set('capacity', String(body?.capacity ?? 1))

      const response = await $fetch(url.toString(), {
        method: 'POST',
        body: idsPayload
      })
      writeToProxyCache(cacheKey, PROXY_CACHE_TTLS_MS.prices, response)
      return { data: response }
    }

    if (operation === 'top') {
      const cacheKey = createCacheKey('top', {
        country: 'BR',
        limit: limit ?? 50,
        offset: offset ?? 0,
        sort: sort ?? '-hot',
        nondeals: false
      })
      const cachedData = readFromProxyCache(cacheKey)
      if (cachedData) {
        return { data: cachedData }
      }

      const url = new URL(withApiKey(config, '/deals/v2'))
      url.searchParams.set('country', 'BR')
      url.searchParams.set('limit', String(limit ?? 50))
      url.searchParams.set('offset', String(offset ?? 0))
      url.searchParams.set('sort', sort ?? '-hot')
      url.searchParams.set('nondeals', 'false')

      const response = await $fetch(url.toString())
      writeToProxyCache(cacheKey, PROXY_CACHE_TTLS_MS.top, response)
      return { data: response }
    }

    throw createError({
      statusCode: 400,
      statusMessage: 'Unsupported operation'
    })
  }
)
