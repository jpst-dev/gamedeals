import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const globalScope = globalThis as Record<string, unknown>

beforeEach(() => {
  globalScope.createError = (details: { statusCode: number; statusMessage: string }) =>
    Object.assign(new Error(details.statusMessage), details)
})

afterEach(() => {
  delete globalScope.createError
})

const loadSitemap = async () => {
  vi.resetModules()
  return await import('../../server/utils/sitemap')
}

const collections = ['/ofertas/menor-preco-historico', '/ofertas/gratis', '/ofertas/acabando', '/ofertas/75-off', '/ofertas/ate-20-reais']

describe('server/utils/sitemap', () => {
  it('lists collections and popular games, following nextOffset and deduping slugs', async () => {
    const { buildSitemapUrls } = await loadSitemap()
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ list: [{ type: 'game', slug: 'hades' }, { type: 'game', slug: 'bg3' }], hasMore: true, nextOffset: 50 })
      .mockResolvedValueOnce({ list: [{ type: 'game', slug: 'hades' }, { type: 'game', slug: '' }], hasMore: false, nextOffset: 100 })

    const urls = await buildSitemapUrls(fetcher as never)

    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(fetcher.mock.calls[1]![1].params.offset).toBe(50)
    expect(urls.map((entry) => entry.loc)).toEqual([...collections, '/game/hades', '/game/bg3'])
    expect(urls.every((entry) => entry.changefreq === 'daily')).toBe(true)
  })

  it('stops after 10 pages', async () => {
    const { buildSitemapUrls } = await loadSitemap()
    let page = 0
    const fetcher = vi.fn(async () => {
      page++
      return { list: Array.from({ length: 50 }, (_, index) => ({ type: 'game', slug: `g${page}-${index}` })), hasMore: true, nextOffset: page * 50 }
    })
    await buildSitemapUrls(fetcher as never)
    expect(fetcher).toHaveBeenCalledTimes(10)
  })

  it('keeps the collections when ITAD fails', async () => {
    const { buildSitemapUrls } = await loadSitemap()
    const fetcher = vi.fn().mockRejectedValue(new Error('down'))
    expect((await buildSitemapUrls(fetcher as never)).map((entry) => entry.loc)).toEqual(collections)
  })
})
