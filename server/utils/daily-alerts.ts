import { and, asc, eq, inArray, isNull, ne, or, sql } from 'drizzle-orm'
import { favorites, priceSnapshots, users } from '../db/schema'
import { decideAlert, pickBestPrice, type AlertState, type BestPrice } from './alerts'
import { pruneLoginTokens } from './auth'
import type { Db } from './db'
import { ALERT_SEND_CEILING, countEmailsToday, recordEmail, renderAlertEmail, type AlertEmailGame, type SendEmail } from './email'
import { buildUnsubscribeUrls } from './unsubscribe'

// Raw items from ITAD's /games/prices/v3.
export type FetchPrices = (gameIds: string[]) => Promise<unknown[]>

export const PRICE_BATCH_SIZE = 200

type FavoriteRow = typeof favorites.$inferSelect

type Pending = { row: FavoriteRow; best: BestPrice; next: AlertState }

const fetchBestPrices = async (fetchPrices: FetchPrices, gameIds: string[]): Promise<Map<string, BestPrice>> => {
  const prices = new Map<string, BestPrice>()
  for (let start = 0; start < gameIds.length; start += PRICE_BATCH_SIZE) {
    const batch = gameIds.slice(start, start + PRICE_BATCH_SIZE)
    try {
      for (const item of await fetchPrices(batch)) {
        const best = pickBestPrice(item)
        if (best && batch.includes(best.gameId)) {
          prices.set(best.gameId, best)
        }
      }
    } catch {
      // This batch has no price today: its favorites keep their state.
      console.error(`[alerts] price batch failed (${batch.length} games)`)
    }
  }
  return prices
}

type StateChange = { row: FavoriteRow; next: AlertState }

// One UPDATE per game and new state, not per row: a big sale or the first
// run after launch touches most rows at once.
const saveStates = async (db: Db, changes: StateChange[]): Promise<void> => {
  const groups = new Map<string, { gameId: string; next: AlertState; userIds: string[] }>()
  for (const { row, next } of changes) {
    if (row.notifiedPrice === next.notifiedPrice && row.baselinePending === next.baselinePending) {
      continue
    }
    const key = JSON.stringify([row.gameId, next.notifiedPrice, next.baselinePending])
    const group = groups.get(key) ?? { gameId: row.gameId, next, userIds: [] }
    group.userIds.push(row.userId)
    groups.set(key, group)
  }
  for (const { gameId, next, userIds } of groups.values()) {
    await db.update(favorites)
      .set({ notifiedPrice: next.notifiedPrice, baselinePending: next.baselinePending })
      .where(and(eq(favorites.gameId, gameId), inArray(favorites.userId, userIds)))
  }
}

// Once a day: record today's prices of every favorited game, then send each
// person at most one email with the favorites that went on sale. A state
// that triggers an email is saved only after the email goes out, so a
// failed or deferred send is retried the next day.
export const runDailyAlerts = async (deps: {
  db: Db
  fetchPrices: FetchPrices
  sendEmail: SendEmail
  now: Date
  siteUrl: string
  secret: string
}): Promise<{ games: number; emails: number; deferred: number }> => {
  const { db, now } = deps
  await pruneLoginTokens(db, now)
  const rows = await db.select().from(favorites)
  const gameIds = [...new Set(rows.map((row) => row.gameId))]
  const prices = await fetchBestPrices(deps.fetchPrices, gameIds)

  const day = now.toISOString().slice(0, 10)
  const snapshots = [...prices.values()].map((best) => ({
    gameId: best.gameId, day, price: best.price, regular: best.regular, cut: best.cut, shop: best.shop, historyLow: best.historyLow
  }))
  for (let start = 0; start < snapshots.length; start += PRICE_BATCH_SIZE) {
    await db.insert(priceSnapshots)
      .values(snapshots.slice(start, start + PRICE_BATCH_SIZE))
      .onConflictDoUpdate({
        target: [priceSnapshots.gameId, priceSnapshots.day],
        set: {
          price: sql`excluded.price`,
          regular: sql`excluded.regular`,
          cut: sql`excluded.cut`,
          shop: sql`excluded.shop`,
          historyLow: sql`excluded.history_low`
        }
      })
  }

  const pendingByUser = new Map<string, Pending[]>()
  const seen: StateChange[] = []
  for (const row of rows) {
    const best = prices.get(row.gameId)
    if (!best) {
      continue
    }
    const { notify, next } = decideAlert({ notifiedPrice: row.notifiedPrice, baselinePending: row.baselinePending }, best)
    if (notify) {
      pendingByUser.set(row.userId, [...pendingByUser.get(row.userId) ?? [], { row, best, next }])
    } else {
      seen.push({ row, next })
    }
  }
  await saveStates(db, seen)

  let emails = 0
  let deferred = 0
  const people = await db.select().from(users).orderBy(asc(users.createdAt))
  for (const person of people) {
    const pending = pendingByUser.get(person.id)
    if (!pending) {
      continue
    }
    if (!person.alertsEnabled) {
      // Seen, not sent: switching alerts back on doesn't flood old sales.
      await saveStates(db, pending)
      continue
    }
    if (await countEmailsToday(db, now) >= ALERT_SEND_CEILING) {
      deferred += 1
      continue
    }
    // Claim today's email in one statement: a second run (Vercel may
    // deliver the cron twice, even at the same time) finds it taken.
    const [claimed] = await db.update(users)
      .set({ lastAlertDay: day })
      .where(and(eq(users.id, person.id), or(isNull(users.lastAlertDay), ne(users.lastAlertDay, day))))
      .returning({ id: users.id })
    if (!claimed) {
      continue
    }

    const games: AlertEmailGame[] = pending.map(({ row, best }) => ({ ...best, title: row.title, slug: row.slug, image: row.image }))
    const urls = buildUnsubscribeUrls(deps.siteUrl, person.id, deps.secret)
    try {
      await deps.sendEmail({
        to: person.email,
        ...renderAlertEmail({ games, siteUrl: deps.siteUrl, unsubscribeUrl: urls.page }),
        headers: {
          'List-Unsubscribe': `<${urls.oneClick}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
        }
      })
    } catch {
      console.error('[alerts] alert email failed')
      // Give the day back so tomorrow's run retries this person.
      await db.update(users).set({ lastAlertDay: person.lastAlertDay }).where(eq(users.id, person.id))
      continue
    }
    await recordEmail(db, 'alert', now)
    emails += 1
    await saveStates(db, pending)
  }

  return { games: gameIds.length, emails, deferred }
}
