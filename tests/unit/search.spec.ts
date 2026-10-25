import { describe, expect, it, vi } from 'vitest'
import {
  addRecentSearch,
  createSuggestionLoader,
  isSearchShortcut,
  readRecentSearches,
  writeRecentSearches
} from '../../app/utils/search'
import type { Suggestion } from '../../shared/types/suggest'

const item = (title: string): Suggestion => ({ id: title, slug: title, title, image: '', type: 'game', price: null })

const deferred = <T>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

const key = (overrides: Partial<{ key: string; ctrlKey: boolean; metaKey: boolean; target: unknown }>) => ({
  key: '/', ctrlKey: false, metaKey: false, target: {}, ...overrides
})

describe('createSuggestionLoader', () => {
  it('reaproveita termo já buscado', async () => {
    const fetch = vi.fn(async (term: string) => [item(term)])
    const loader = createSuggestionLoader(fetch)
    await loader.load('Cyber')
    await expect(loader.load(' cyber ')).resolves.toEqual([item('cyber')])
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('descarta resposta de termo antigo', async () => {
    const slow = deferred<Suggestion[]>()
    const fast = deferred<Suggestion[]>()
    const loader = createSuggestionLoader((term) => term === 'cy' ? slow.promise : fast.promise)

    const old = loader.load('cy')
    const latest = loader.load('cyber')
    fast.resolve([item('Cyberpunk 2077')])
    slow.resolve([item('Cytus')])

    await expect(latest).resolves.toEqual([item('Cyberpunk 2077')])
    await expect(old).resolves.toBeNull()
  })

  it('menos de 2 letras não busca', async () => {
    const fetch = vi.fn(async () => [item('x')])
    await expect(createSuggestionLoader(fetch).load('c')).resolves.toEqual([])
    expect(fetch).not.toHaveBeenCalled()
  })

  it('erro não fica no cache', async () => {
    const fetch = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce([item('Halo')])
    const loader = createSuggestionLoader(fetch)
    await expect(loader.load('halo')).rejects.toThrow('offline')
    await expect(loader.load('halo')).resolves.toEqual([item('Halo')])
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})

describe('buscas recentes', () => {
  it('recentes: mais novo primeiro, sem repetir, no máximo 5', () => {
    expect(addRecentSearch(['a', 'b', 'c', 'd', 'e'], 'B')).toEqual(['B', 'a', 'c', 'd', 'e'])
    expect(addRecentSearch(['a'], '  ')).toEqual(['a'])
  })

  it('recentes sobrevivem a storage quebrado', () => {
    expect(readRecentSearches({ getItem: () => '{oops' })).toEqual([])
    expect(readRecentSearches({ getItem: () => { throw new Error('blocked') } })).toEqual([])
    expect(readRecentSearches(null)).toEqual([])
    expect(readRecentSearches({ getItem: () => '[1,"x"]' })).toEqual(['x'])
    expect(() => writeRecentSearches({ setItem: () => { throw new Error('full') } }, ['x'])).not.toThrow()
  })
})

describe('isSearchShortcut', () => {
  it('atalhos / e Ctrl/Cmd+K', () => {
    expect(isSearchShortcut(key({}))).toBe(true)
    expect(isSearchShortcut(key({ key: 'k', ctrlKey: true }))).toBe(true)
    expect(isSearchShortcut(key({ key: 'K', metaKey: true }))).toBe(true)
    expect(isSearchShortcut(key({ key: 'k' }))).toBe(false)
  })

  it('ignora atalho dentro de campo de texto', () => {
    for (const target of [{ tagName: 'INPUT' }, { tagName: 'TEXTAREA' }, { tagName: 'SELECT' }, { isContentEditable: true }]) {
      expect(isSearchShortcut(key({ target }))).toBe(false)
    }
    expect(isSearchShortcut(key({ key: 'k', ctrlKey: true, target: { tagName: 'INPUT' } }))).toBe(false)
  })
})
