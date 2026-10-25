import { and, asc, eq } from 'drizzle-orm'
import { favorites, priceSnapshots, users } from '../db/schema'
import { decideAlert, pickBestPrice, type AlertState, type BestPrice } from './alerts'
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

const saveState = async (db: Db, row: FavoriteRow, next: AlertState): Promise<void> => {
  if (row.notifiedPrice === next.notifiedPrice && row.baselinePending === next.baselinePending) {
    return
  }
  await db.update(favorites)
    .set({ notifiedPrice: next.notifiedPrice, baselinePending: next.baselinePending })
    .where(and(eq(favorites.userId, row.userId), eq(favorites.gameId, row.gameId)))
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
  const rows = await db.select().from(favorites)
  const gameIds = [...new Set(rows.map((row) => row.gameId))]
  const prices = await fetchBestPrices(deps.fetchPrices, gameIds)

  const day = now.toISOString().slice(0, 10)
  for (const best of prices.values()) {
    const snapshot = { price: best.price, regular: best.regular, cut: best.cut, shop: best.shop, historyLow: best.historyLow }
    await db.insert(priceSnapshots)
      .values({ gameId: best.gameId, day, ...snapshot })
      .onConflictDoUpdate({ target: [priceSnapshots.gameId, priceSnapshots.day], set: snapshot })
  }

  const pendingByUser = new Map<string, Pending[]>()
  for (const row of rows) {
    const best = prices.get(row.gameId)
    if (!best) {
      continue
    }
    const { notify, next } = decideAlert({ notifiedPrice: row.notifiedPrice, baselinePending: row.baselinePending }, best)
    if (notify) {
      pendingByUser.set(row.userId, [...pendingByUser.get(row.userId) ?? [], { row, best, next }])
    } else {
      await saveState(db, row, next)
    }
  }

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
      for (const item of pending) {
        await saveState(db, item.row, item.next)
      }
      continue
    }
    if (await countEmailsToday(db, now) >= ALERT_SEND_CEILING) {
      deferred += 1
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
      continue
    }
    await recordEmail(db, 'alert', now)
    emails += 1
    for (const item of pending) {
      await saveState(db, item.row, item.next)
    }
  }

  return { games: gameIds.length, emails, deferred }
}
