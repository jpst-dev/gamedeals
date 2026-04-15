import { afterEach, describe, expect, it, vi } from 'vitest'

type Handler = (event: unknown) => Promise<{ data: unknown; warning?: string }>

const globalScope = globalThis as Record<string, unknown>

const loadProxyHandler = async (): Promise<Handler> => {
  vi.resetModules()
  globalScope.defineEventHandler = (handler: Handler) => handler
  globalScope.createError = (details: { statusCode: number; statusMessage: string }) =>
    Object.assign(new Error(details.statusMessage), details)

  const module = await import('../../server/api/itad-proxy')
  return module.default as Handler
}

afterEach(() => {
  vi.restoreAllMocks()
  delete globalScope.useRuntimeConfig
  delete globalScope.readBody
  delete globalScope.getQuery
  delete globalScope.$fetch
  delete globalScope.defineEventHandler
  delete globalScope.createError
})

describe('server/api/itad-proxy', () => {
  it('returns warning when operation is missing', async () => {
    globalScope.useRuntimeConfig = vi.fn(() => ({ itadApiKey: 'test-key' }))
    globalScope.readBody = vi.fn(async () => undefined)
    globalScope.getQuery = vi.fn(() => ({}))
    globalScope.$fetch = vi.fn()

    const handler = await loadProxyHandler()
    const response = await handler({})

    expect(response.warning).toBe('operation is required')
    expect(response.data).toEqual([])
  })

  it('returns top fallback when API key is missing', async () => {
    const fetchMock = vi.fn()
    globalScope.useRuntimeConfig = vi.fn(() => ({ itadApiKey: '' }))
    globalScope.readBody = vi.fn(async () => ({ operation: 'top', limit: 3 }))
    globalScope.getQuery = vi.fn(() => ({}))
    globalScope.$fetch = fetchMock

    const handler = await loadProxyHandler()
    const response = await handler({})

    expect(Array.isArray(response.data)).toBe(true)
    expect((response.data as Array<{ title: string }>)).toHaveLength(3)
    expect((response.data as Array<{ title: string }>)[0]?.title).toBe('Top Game 1')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('calls deals endpoint for top operation with valid key', async () => {
    const fetchMock = vi.fn(async () => ({ list: [{ id: '1' }], hasMore: false, nextOffset: 1 }))
    globalScope.useRuntimeConfig = vi.fn(() => ({ itadApiKey: 'my-key' }))
    globalScope.readBody = vi.fn(async () => ({ operation: 'top', limit: 20, offset: 40, sort: '-price' }))
    globalScope.getQuery = vi.fn(() => ({}))
    globalScope.$fetch = fetchMock

    const handler = await loadProxyHandler()
    const response = await handler({})

    const calls = (fetchMock as unknown as { mock: { calls: unknown[][] } }).mock.calls
    const calledUrl = String(calls[0]?.[0] ?? '')
    expect(calledUrl).toContain('/deals/v2')
    expect(calledUrl).toContain('key=my-key')
    expect(calledUrl).toContain('limit=20')
    expect(calledUrl).toContain('offset=40')
    expect(calledUrl).toContain('sort=-price')
    expect(response.data).toEqual({ list: [{ id: '1' }], hasMore: false, nextOffset: 1 })
  })

  it('posts ids payload for prices operation', async () => {
    const fetchMock = vi.fn(async () => ([{ id: 'game-1', deals: [] }]))
    globalScope.useRuntimeConfig = vi.fn(() => ({ itadApiKey: 'my-key' }))
    globalScope.readBody = vi.fn(async () => ({
      operation: 'prices',
      gameIds: ['game-2', 'game-1'],
      onlyDeals: false,
      capacity: 3,
      country: 'US'
    }))
    globalScope.getQuery = vi.fn(() => ({}))
    globalScope.$fetch = fetchMock

    const handler = await loadProxyHandler()
    const response = await handler({})

    const calls = (fetchMock as unknown as { mock: { calls: unknown[][] } }).mock.calls
    const calledUrl = String(calls[0]?.[0] ?? '')
    const calledOptions = (calls[0]?.[1] ?? {}) as { method: string; body: string[] }
    expect(calledUrl).toContain('/games/prices/v3')
    expect(calledUrl).toContain('country=US')
    expect(calledUrl).toContain('deals=false')
    expect(calledUrl).toContain('capacity=3')
    expect(calledOptions.method).toBe('POST')
    expect(calledOptions.body).toEqual(['game-2', 'game-1'])
    expect(response.data).toEqual([{ id: 'game-1', deals: [] }])
  })
})
