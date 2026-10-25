import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { emailSends, favorites, priceSnapshots, users } from '../../server/db/schema'
import { addFavorite } from '../../server/utils/account'
import { findOrCreateUser } from '../../server/utils/auth'
import { runDailyAlerts, type FetchPrices } from '../../server/utils/daily-alerts'
import type { EmailMessage } from '../../server/utils/email'
import { buildUnsubscribeUrls } from '../../server/utils/unsubscribe'
import type { Db } from '../../server/utils/db'
import { createTestDb } from './helpers/test-db'

const secret = 's'.repeat(32)
const siteUrl = 'https://dealsgamer.com'
const day = (n: number) => new Date(Date.UTC(2026, 9, n, 12))

type Prices = Record<string, { price: number; cut: number }>

const fakeItad = (prices: Prices): FetchPrices => async (ids) => ids
  .filter((id) => prices[id])
  .map((id) => ({
    id,
    historyLow: { all: { amount: 10 } },
    deals: [{ shop: { id: 1, name: 'Steam' }, price: { amount: prices[id]?.price }, regular: { amount: 100 }, cut: prices[id]?.cut }]
  }))

const setup = async (gameIds: string[] = ['g1']) => {
  const db = await createTestDb()
  const user = await findOrCreateUser(db, 'a@b.com')
  for (const id of gameIds) {
    await addFavorite(db, user.id, { id, slug: `jogo-${id}`, title: `Jogo ${id}`, image: '' })
  }
  const sent: EmailMessage[] = []
  const run = (prices: Prices, now: Date, overrides: { fetchPrices?: FetchPrices; failSend?: boolean } = {}) => runDailyAlerts({
    db,
    fetchPrices: overrides.fetchPrices ?? fakeItad(prices),
    sendEmail: async (message) => {
      if (overrides.failSend) {
        throw new Error('resend down')
      }
      sent.push(message)
    },
    now,
    siteUrl,
    secret
  })
  return { db, user, sent, run }
}

const stateOf = async (db: Db, gameId = 'g1') => {
  const [row] = await db.select().from(favorites).where(eq(favorites.gameId, gameId))
  return { notifiedPrice: row?.notifiedPrice ?? null, baselinePending: row?.baselinePending }
}

describe('runDailyAlerts', () => {
  it('primeira execução com promoção em andamento só registra', async () => {
    const { db, sent, run } = await setup()
    await run({ g1: { price: 40, cut: 60 } }, day(1))
    expect(sent).toHaveLength(0)
    expect(await stateOf(db)).toEqual({ notifiedPrice: 40, baselinePending: false })
  })

  it('avisa só quando o preço cai na mesma promoção', async () => {
    const { sent, run } = await setup()
    await run({ g1: { price: 40, cut: 60 } }, day(1))
    await run({ g1: { price: 40, cut: 60 } }, day(2))
    expect(sent).toHaveLength(0)
    await run({ g1: { price: 30, cut: 70 } }, day(3))
    expect(sent).toHaveLength(1)
    expect(sent[0]?.subject).toBe('Jogo g1 entrou em promoção')
  })

  it('promoção acaba e volta: avisa de novo', async () => {
    const { sent, run } = await setup()
    await run({ g1: { price: 100, cut: 0 } }, day(1))
    await run({ g1: { price: 40, cut: 60 } }, day(2))
    await run({ g1: { price: 100, cut: 0 } }, day(3))
    await run({ g1: { price: 40, cut: 60 } }, day(4))
    expect(sent).toHaveLength(2)
  })

  it('dois jogos no mesmo dia: um email só', async () => {
    const { sent, run } = await setup(['g1', 'g2'])
    await run({ g1: { price: 100, cut: 0 }, g2: { price: 100, cut: 0 } }, day(1))
    const result = await run({ g1: { price: 40, cut: 60 }, g2: { price: 20, cut: 80 } }, day(2))
    expect(sent).toHaveLength(1)
    expect(sent[0]?.subject).toBe('2 jogos da sua lista entraram em promoção')
    expect(result).toEqual({ games: 2, emails: 1, deferred: 0 })
  })

  it('rodar duas vezes no mesmo dia não repete o email', async () => {
    const { sent, run } = await setup()
    await run({ g1: { price: 100, cut: 0 } }, day(1))
    await run({ g1: { price: 40, cut: 60 } }, day(2))
    await run({ g1: { price: 40, cut: 60 } }, day(2))
    expect(sent).toHaveLength(1)
  })

  it('ITAD fora do ar: nada muda e nada é enviado', async () => {
    const { db, sent, run } = await setup()
    await run({ g1: { price: 100, cut: 0 } }, day(1))
    const before = await stateOf(db)
    const result = await run({}, day(2), { fetchPrices: async () => { throw new Error('itad down') } })
    expect(sent).toHaveLength(0)
    expect(await stateOf(db)).toEqual(before)
    expect(result.emails).toBe(0)
  })

  it('quota perto do fim adia para o dia seguinte', async () => {
    const { db, sent, run } = await setup()
    await run({ g1: { price: 100, cut: 0 } }, day(1))
    await db.insert(emailSends).values(Array.from({ length: 80 }, () => ({ kind: 'login' as const, sentAt: day(2) })))
    const result = await run({ g1: { price: 40, cut: 60 } }, day(2))
    expect(result.deferred).toBe(1)
    expect(sent).toHaveLength(0)
    expect((await stateOf(db)).notifiedPrice).toBeNull()
    await run({ g1: { price: 40, cut: 60 } }, day(3))
    expect(sent).toHaveLength(1)
  })

  it('falha no envio não grava o estado', async () => {
    const { db, sent, run } = await setup()
    await run({ g1: { price: 100, cut: 0 } }, day(1))
    await run({ g1: { price: 40, cut: 60 } }, day(2), { failSend: true })
    expect((await stateOf(db)).notifiedPrice).toBeNull()
    await run({ g1: { price: 40, cut: 60 } }, day(3))
    expect(sent).toHaveLength(1)
    expect(await db.select().from(emailSends)).toHaveLength(1)
  })

  it('alertas desligados: sem email, estado gravado', async () => {
    const { db, user, sent, run } = await setup()
    await run({ g1: { price: 100, cut: 0 } }, day(1))
    await db.update(users).set({ alertsEnabled: false }).where(eq(users.id, user.id))
    await run({ g1: { price: 40, cut: 60 } }, day(2))
    expect(sent).toHaveLength(0)
    expect((await stateOf(db)).notifiedPrice).toBe(40)
  })

  it('um registro de preço por jogo por dia', async () => {
    const { db, run } = await setup()
    await run({ g1: { price: 40, cut: 60 } }, day(1))
    await run({ g1: { price: 35, cut: 65 } }, day(1))
    const rows = await db.select().from(priceSnapshots)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ gameId: 'g1', day: '2026-10-01', price: 35, cut: 65, shop: 'Steam', historyLow: 10 })
  })

  it('email traz o link de sair do próprio usuário e os cabeçalhos', async () => {
    const { user, sent, run } = await setup()
    await run({ g1: { price: 100, cut: 0 } }, day(1))
    await run({ g1: { price: 40, cut: 60 } }, day(2))
    const urls = buildUnsubscribeUrls(siteUrl, user.id, secret)
    expect(sent[0]?.to).toBe('a@b.com')
    expect(sent[0]?.text).toContain(urls.page)
    expect(sent[0]?.headers).toEqual({
      'List-Unsubscribe': `<${urls.oneClick}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
    })
  })
})
