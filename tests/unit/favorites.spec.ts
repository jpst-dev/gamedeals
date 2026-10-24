import { describe, expect, it, vi } from 'vitest'
import { buildFavoriteCards, migrateLegacyIds, parseStoredFavorites, toggleFavoriteEntry, type FavoriteGame } from '../../app/utils/favorites'

const fav = (id: string): FavoriteGame => ({ id, slug: id, title: id.toUpperCase(), image: '', addedAt: '2026-10-24T00:00:00.000Z' })
const NOW = new Date('2026-10-24T12:00:00.000Z')

describe('parseStoredFavorites', () => {
  it('reads legacy id arrays and new objects, deduped and capped at 50', () => {
    const legacy = JSON.stringify(['a', 'b', 'a'])
    expect(parseStoredFavorites(legacy)).toEqual({ items: [], legacyIds: ['a', 'b'] })
    const mixed = JSON.stringify([{ id: 'x', slug: 'x', title: 'X', image: '', addedAt: '2026-10-24T00:00:00.000Z' }, 'y', { title: 'sem id' }])
    expect(parseStoredFavorites(mixed)).toEqual({ items: [expect.objectContaining({ id: 'x' })], legacyIds: ['y'] })
    const many = JSON.stringify(Array.from({ length: 80 }, (_, i) => `id-${i}`))
    expect(parseStoredFavorites(many).legacyIds).toHaveLength(50)
  })

  it('survives corrupted storage', () => {
    expect(parseStoredFavorites('{not json')).toEqual({ items: [], legacyIds: [] })
    expect(parseStoredFavorites('{"a":1}')).toEqual({ items: [], legacyIds: [] })
    expect(parseStoredFavorites(null)).toEqual({ items: [], legacyIds: [] })
  })
})

describe('toggleFavoriteEntry', () => {
  it('adds with a timestamp and removes on the second toggle', () => {
    const game = { id: 'g', slug: 'g', title: 'G', image: 'i.jpg' }
    const added = toggleFavoriteEntry({ items: [], legacyIds: [] }, game, NOW)
    expect(added.result).toBe('added')
    expect(added.items).toEqual([{ ...game, addedAt: NOW.toISOString() }])
    expect(toggleFavoriteEntry(added, game, NOW)).toEqual({ items: [], legacyIds: [], result: 'removed' })
  })

  it('removes a still-pending legacy id', () => {
    expect(toggleFavoriteEntry({ items: [], legacyIds: ['g'] }, { id: 'g', slug: 'g', title: 'G', image: '' }, NOW))
      .toEqual({ items: [], legacyIds: [], result: 'removed' })
  })

  it('refuses to go past 50 favorites, counting pending ids', () => {
    const state = { items: Array.from({ length: 49 }, (_, i) => fav(`f${i}`)), legacyIds: ['p'] }
    const next = toggleFavoriteEntry(state, { id: 'new', slug: 'new', title: 'New', image: '' }, NOW)
    expect(next.result).toBe('limit')
    expect(next.items).toHaveLength(49)
  })
})

describe('migrateLegacyIds', () => {
  it('converts what it can and keeps failures pending', async () => {
    const toFavorite = vi.fn(async (id: string) => {
      if (id === 'bad') {
        throw new Error('down')
      }
      return fav(id)
    })
    expect(await migrateLegacyIds(['a', 'bad'], toFavorite)).toEqual({ migrated: [fav('a')], pendingIds: ['bad'] })
  })
})

describe('buildFavoriteCards', () => {
  it('lists priced games first, then newest favorites', () => {
    const items = [
      { ...fav('old'), addedAt: '2026-01-01T00:00:00.000Z' },
      { ...fav('none'), addedAt: '2026-10-01T00:00:00.000Z' },
      { ...fav('new'), addedAt: '2026-09-01T00:00:00.000Z', image: 'n.jpg' }
    ]
    const cards = buildFavoriteCards(items, new Map([['old', 10], ['new', 5]]))
    expect(cards.map((card) => [card.game.id, card.noOffer])).toEqual([['new', false], ['old', false], ['none', true]])
    expect(cards[0]!.game).toMatchObject({ slug: 'new', title: 'NEW', image: 'n.jpg', images: ['n.jpg'], price: [{ amount: 5 }] })
    expect(cards[2]!.game.images).toEqual([])
  })
})
