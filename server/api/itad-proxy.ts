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
    const hasValidApiKey = Boolean(config.itadApiKey) && config.itadApiKey !== 'SUA_CHAVE_AQUI'

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
        warning: 'Use a valid ITAD key in runtime config.'
      }
    }

    if (operation === 'search') {
      const endpoint = withApiKey(
        config,
        `/games/search/v1?title=${encodeURIComponent(body?.query ?? '')}&results=${limit ?? 24}`
      )
      const response = await $fetch(endpoint)
      return { data: response }
    }

    if (operation === 'info') {
      const endpoint = withApiKey(
        config,
        `/games/info/v2?id=${encodeURIComponent(body?.gameId ?? '')}`
      )
      const response = await $fetch(endpoint)
      return { data: response }
    }

    if (operation === 'prices') {
      const url = new URL(withApiKey(config, '/games/prices/v3'))
      url.searchParams.set('country', body?.country ?? 'BR')
      url.searchParams.set('deals', String(body?.onlyDeals ?? true))
      url.searchParams.set('vouchers', 'true')
      url.searchParams.set('capacity', String(body?.capacity ?? 1))

      const idsPayload = Array.isArray(body?.gameIds) && body.gameIds.length > 0
        ? body.gameIds
        : (body?.gameId ? [body.gameId] : [])

      const response = await $fetch(url.toString(), {
        method: 'POST',
        body: idsPayload
      })
      return { data: response }
    }

    if (operation === 'top') {
      const url = new URL(withApiKey(config, '/deals/v2'))
      url.searchParams.set('country', 'BR')
      url.searchParams.set('limit', String(limit ?? 50))
      url.searchParams.set('offset', String(offset ?? 0))
      url.searchParams.set('sort', sort ?? '-hot')
      url.searchParams.set('nondeals', 'false')

      const response = await $fetch(url.toString())
      return { data: response }
    }

    throw createError({
      statusCode: 400,
      statusMessage: 'Unsupported operation'
    })
  }
)
