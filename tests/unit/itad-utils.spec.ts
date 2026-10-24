import { afterEach, describe, expect, it, vi } from 'vitest'

const globalScope = globalThis as Record<string, unknown>
const GAME_ID = '018d937f-11e6-715a-b03c-5d26f6a0ba0f'

const loadUtils = async () => {
  vi.resetModules()
  globalScope.createError = (details: { statusCode: number; statusMessage: string }) =>
    Object.assign(new Error(details.statusMessage), details)

  return await import('../../server/utils/itad')
}

afterEach(() => {
  vi.restoreAllMocks()
  delete globalScope.useRuntimeConfig
  delete globalScope.$fetch
  delete globalScope.createError
})

describe('server/utils/itad', () => {
  it('clamps numeric query params and falls back on garbage', async () => {
    const { parseIntInRange, parseOptionalNumber } = await loadUtils()

    expect(parseIntInRange('10000', 20, 1, 50)).toBe(50)
    expect(parseIntInRange('-3', 20, 1, 50)).toBe(1)
    expect(parseIntInRange('abc', 20, 1, 50)).toBe(20)
    expect(parseIntInRange(undefined, 20, 1, 50)).toBe(20)
    expect(parseOptionalNumber('150', 0, 100)).toBe(100)
    expect(parseOptionalNumber('', 0, 100)).toBeUndefined()
  })

  it('keeps only valid, unique game and shop ids', async () => {
    const { parseGameIds, parseShopIds } = await loadUtils()

    expect(parseGameIds(`${GAME_ID},not-a-uuid,${GAME_ID}`, 50)).toEqual([GAME_ID])
    expect(parseShopIds('61,abc,35,61,-1')).toEqual([35, 61])
  })

  it('only accepts whitelisted sorts', async () => {
    const { parseDealSort } = await loadUtils()

    expect(parseDealSort('-cut')).toBe('-cut')
    expect(parseDealSort('DROP TABLE')).toBe('-hot')
  })

  it('builds ITAD urls with key and skips empty params', async () => {
    const { buildItadUrl } = await loadUtils()
    const url = new URL(buildItadUrl('my-key', '/deals/v2', {
      country: 'BR',
      limit: 20,
      shops: ['61', '35'],
      filter: undefined,
      nondeals: false
    }))

    expect(url.pathname).toBe('/deals/v2')
    expect(url.searchParams.get('key')).toBe('my-key')
    expect(url.searchParams.get('shops')).toBe('61,35')
    expect(url.searchParams.get('nondeals')).toBe('false')
    expect(url.searchParams.has('filter')).toBe(false)
  })

  it('fails with 503 instead of serving fake data when the key is missing', async () => {
    const fetchMock = vi.fn()
    globalScope.useRuntimeConfig = vi.fn(() => ({ itadApiKey: '' }))
    globalScope.$fetch = fetchMock
    const { itadFetch } = await loadUtils()

    await expect(itadFetch('/deals/v2')).rejects.toMatchObject({ statusCode: 503 })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('maps upstream failures to 502 and 404', async () => {
    globalScope.useRuntimeConfig = vi.fn(() => ({ itadApiKey: 'my-key' }))
    globalScope.$fetch = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('boom'), { response: { status: 500 } }))
      .mockRejectedValueOnce(Object.assign(new Error('missing'), { response: { status: 404 } }))
    const { itadFetch } = await loadUtils()

    await expect(itadFetch('/games/info/v2')).rejects.toMatchObject({ statusCode: 502 })
    await expect(itadFetch('/games/info/v2')).rejects.toMatchObject({ statusCode: 404 })
  })

  it('posts body and query params to ITAD', async () => {
    const fetchMock = vi.fn(async () => [{ id: GAME_ID, deals: [] }])
    globalScope.useRuntimeConfig = vi.fn(() => ({ itadApiKey: 'my-key' }))
    globalScope.$fetch = fetchMock
    const { itadFetch } = await loadUtils()

    const response = await itadFetch('/games/prices/v3', {
      method: 'POST',
      params: { country: 'BR', capacity: 30 },
      body: [GAME_ID]
    })

    const [calledUrl, calledOptions] = (fetchMock.mock.calls[0] ?? []) as unknown as [string, { method: string; body: string[] }]
    expect(calledUrl).toContain('/games/prices/v3')
    expect(calledUrl).toContain('capacity=30')
    expect(calledOptions.method).toBe('POST')
    expect(calledOptions.body).toEqual([GAME_ID])
    expect(response).toEqual([{ id: GAME_ID, deals: [] }])
  })
})
