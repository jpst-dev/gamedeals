import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import type { FavoriteGame } from '../../app/utils/favorites'
import { favorites, users } from '../../server/db/schema'
import {
  addFavorite,
  deleteUser,
  listFavorites,
  mergeBrowserFavorites,
  mergeFavoriteLists,
  parseFavoriteGame,
  removeFavorite,
  unsubscribeWithSignature
} from '../../server/utils/account'
import { findOrCreateUser } from '../../server/utils/auth'
import { signUnsubscribe } from '../../server/utils/unsubscribe'
import { createTestDb } from './helpers/test-db'

const fav = (id: string, addedAt = '2026-10-01T00:00:00.000Z', title = `Jogo ${id}`): FavoriteGame => ({
  id, slug: `jogo-${id}`, title, image: `https://img/${id}.jpg`, addedAt
})

const range = (n: number, prefix: string) => Array.from({ length: n }, (_, index) => fav(`${prefix}${index}`))

describe('mergeFavoriteLists', () => {
  it('conta primeiro, depois os mais recentes do navegador até o máximo', () => {
    const account = range(49, 'a')
    const browser = [fav('old', '2026-01-01T00:00:00.000Z'), fav('new', '2026-10-20T00:00:00.000Z'), fav('mid', '2026-05-01T00:00:00.000Z')]
    const merged = mergeFavoriteLists(account, browser, 50)
    expect(merged).toHaveLength(50)
    expect(merged.slice(0, 49)).toEqual(account)
    expect(merged[49]?.id).toBe('new')
  })

  it('duplicado aparece uma vez, com os dados da conta', () => {
    const merged = mergeFavoriteLists([fav('x', undefined, 'Da conta')], [fav('x', undefined, 'Do navegador')], 50)
    expect(merged).toEqual([fav('x', undefined, 'Da conta')])
  })
})

describe('favoritos no banco', () => {
  it('limite de 50 e repetido', async () => {
    const db = await createTestDb()
    const { id } = await findOrCreateUser(db, 'a@b.com')
    for (const game of range(50, 'g')) {
      expect(await addFavorite(db, id, game)).toBe('added')
    }
    expect(await addFavorite(db, id, fav('g0'))).toBe('exists')
    expect(await addFavorite(db, id, fav('extra'))).toBe('limit')
    await removeFavorite(db, id, 'g0')
    expect(await listFavorites(db, id)).toHaveLength(49)
  })

  it('remover um favorito não mexe nos de outra conta', async () => {
    const db = await createTestDb()
    const a = await findOrCreateUser(db, 'a@b.com')
    const b = await findOrCreateUser(db, 'b@b.com')
    await addFavorite(db, a.id, fav('1'))
    await addFavorite(db, b.id, fav('1'))
    await removeFavorite(db, a.id, '1')
    expect(await listFavorites(db, a.id)).toHaveLength(0)
    expect(await listFavorites(db, b.id)).toHaveLength(1)
  })

  it('merge do navegador não duplica e novos ficam pendentes', async () => {
    const db = await createTestDb()
    const { id } = await findOrCreateUser(db, 'a@b.com')
    await addFavorite(db, id, fav('conta'))
    await db.update(favorites).set({ baselinePending: false })
    const browser = [fav('conta'), fav('nav1'), fav('nav2')]
    await mergeBrowserFavorites(db, id, browser)
    const result = await mergeBrowserFavorites(db, id, browser)
    expect(result.map((item) => item.id).sort()).toEqual(['conta', 'nav1', 'nav2'])
    const rows = await db.select().from(favorites).where(eq(favorites.userId, id))
    expect(rows.find((row) => row.gameId === 'conta')?.baselinePending).toBe(false)
    expect(rows.filter((row) => row.gameId !== 'conta').every((row) => row.baselinePending)).toBe(true)
  })

  it('excluir conta apaga só os favoritos dela', async () => {
    const db = await createTestDb()
    const a = await findOrCreateUser(db, 'a@b.com')
    const b = await findOrCreateUser(db, 'b@b.com')
    await addFavorite(db, a.id, fav('1'))
    await addFavorite(db, b.id, fav('1'))
    await deleteUser(db, a.id)
    expect(await db.select().from(users)).toHaveLength(1)
    expect(await listFavorites(db, b.id)).toHaveLength(1)
    expect(await db.select().from(favorites)).toHaveLength(1)
  })
})

describe('sair dos emails', () => {
  const secret = 's'.repeat(32)

  it('assinatura de outro usuário não altera ninguém', async () => {
    const db = await createTestDb()
    const a = await findOrCreateUser(db, 'a@b.com')
    const b = await findOrCreateUser(db, 'b@b.com')
    expect(await unsubscribeWithSignature(db, a.id, signUnsubscribe(b.id, secret), secret)).toBe(false)
    expect(await unsubscribeWithSignature(db, 'nao-e-uuid', 'x', secret)).toBe(false)
    const rows = await db.select().from(users)
    expect(rows.every((row) => row.alertsEnabled)).toBe(true)
  })

  it('assinatura certa desliga os alertas', async () => {
    const db = await createTestDb()
    const a = await findOrCreateUser(db, 'a@b.com')
    expect(await unsubscribeWithSignature(db, a.id, signUnsubscribe(a.id, secret), secret)).toBe(true)
    const [row] = await db.select().from(users).where(eq(users.id, a.id))
    expect(row?.alertsEnabled).toBe(false)
  })
})

describe('parseFavoriteGame', () => {
  const now = new Date('2026-10-25T12:00:00Z')
  const id = '018d9386-46b0-70e5-9b53-b1ca00522c36'

  it('aceita um favorito válido e completa a data', () => {
    expect(parseFavoriteGame({ id, slug: 's', title: 'T', image: '' }, now)).toEqual({ id, slug: 's', title: 'T', image: '', addedAt: now.toISOString() })
  })

  it('recusa id que não é da ITAD e campos faltando', () => {
    expect(parseFavoriteGame({ id: 'x', slug: 's', title: 'T', image: '' }, now)).toBeNull()
    expect(parseFavoriteGame({ id, title: 'T', image: '' }, now)).toBeNull()
    expect(parseFavoriteGame('lixo', now)).toBeNull()
  })
})
