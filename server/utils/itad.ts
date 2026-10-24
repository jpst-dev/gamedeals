import type { H3Event } from 'h3'

export const ITAD_BASE_URL = 'https://api.isthereanydeal.com'
export const ITAD_COUNTRY = 'BR'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const DEAL_SORTS = ['-hot', '-cut', 'price', '-price', '-added', 'title', 'expiry'] as const
export type DealSort = (typeof DEAL_SORTS)[number]

type QueryValue = string | string[] | undefined | null

const firstValue = (value: unknown): string | undefined => {
  const raw = Array.isArray(value) ? value[0] : value
  if (typeof raw === 'number') {
    return String(raw)
  }

  return typeof raw === 'string' ? raw : undefined
}

// Clamps user input so nobody can burn our ITAD quota with huge pages.
export const parseIntInRange = (value: unknown, fallback: number, min: number, max: number): number => {
  const parsed = Number.parseInt(firstValue(value) ?? '', 10)
  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.min(Math.max(parsed, min), max)
}

export const parseOptionalNumber = (value: unknown, min: number, max: number): number | undefined => {
  const raw = firstValue(value)
  if (raw === undefined || raw.trim() === '') {
    return undefined
  }

  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) {
    return undefined
  }

  return Math.min(Math.max(parsed, min), max)
}

export const isGameId = (value: unknown): value is string => {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

export const parseGameIds = (value: unknown, max: number): string[] => {
  const raw = firstValue(value) ?? ''
  const ids = raw.split(',').map((entry) => entry.trim()).filter(isGameId)
  return [...new Set(ids)].slice(0, max)
}

export const parseShopIds = (value: unknown): number[] => {
  const raw = firstValue(value) ?? ''
  const ids = raw
    .split(',')
    .map((entry) => Number.parseInt(entry.trim(), 10))
    .filter((entry) => Number.isInteger(entry) && entry > 0)
  return [...new Set(ids)].sort((a, b) => a - b).slice(0, 50)
}

export const parseDealSort = (value: unknown): DealSort => {
  const raw = firstValue(value)
  return DEAL_SORTS.includes(raw as DealSort) ? (raw as DealSort) : '-hot'
}

export const requireGameId = (event: H3Event): string => {
  const id = getRouterParam(event, 'id')
  if (!isGameId(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid game id' })
  }

  return id
}

export const buildItadUrl = (
  apiKey: string,
  path: string,
  params: Record<string, QueryValue | number | boolean> = {}
): string => {
  const url = new URL(path, ITAD_BASE_URL)
  url.searchParams.set('key', apiKey)
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') {
      continue
    }

    url.searchParams.set(key, Array.isArray(value) ? value.join(',') : String(value))
  }

  return url.toString()
}

export type ItadFetchOptions = {
  params?: Record<string, QueryValue | number | boolean>
  method?: 'GET' | 'POST'
  body?: unknown
}

export const itadFetch = async <T>(path: string, options: ItadFetchOptions = {}): Promise<T> => {
  const { itadApiKey } = useRuntimeConfig()
  if (!itadApiKey) {
    throw createError({
      statusCode: 503,
      statusMessage: 'ITAD_API_KEY is not configured'
    })
  }

  try {
    const response: unknown = await $fetch(buildItadUrl(itadApiKey, path, options.params), {
      method: options.method ?? 'GET',
      body: options.body as BodyInit | Record<string, unknown> | undefined,
      timeout: 10_000
    })
    return response as T
  } catch (error) {
    const status = (error as { response?: { status?: number } }).response?.status
    throw createError({
      statusCode: status === 404 ? 404 : 502,
      statusMessage: status === 404 ? 'Not found on ITAD' : 'Upstream ITAD request failed'
    })
  }
}
