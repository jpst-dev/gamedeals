import { boolean, date, integer, numeric, pgTable, primaryKey, serial, text, timestamp, uuid } from 'drizzle-orm/pg-core'

// Money columns hold BRL with 2 decimals; drizzle returns them as numbers.
const money = (name: string) => numeric(name, { precision: 10, scale: 2, mode: 'number' })

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Always stored normalized (trimmed, lower case).
  email: text('email').notNull().unique(),
  alertsEnabled: boolean('alerts_enabled').notNull().default(true),
  // Day (UTC) of the last alert email: at most one per person per day.
  lastAlertDay: date('last_alert_day'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})

// Sign-in links. Only the SHA-256 of the token is kept.
export const loginTokens = pgTable('login_tokens', {
  tokenHash: text('token_hash').primaryKey(),
  email: text('email').notNull(),
  // Email with +tags (and Gmail dots) removed: what the rate limits count.
  rateKey: text('rate_key').notNull(),
  ipHash: text('ip_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})

export const favorites = pgTable('favorites', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  gameId: text('game_id').notNull(),
  slug: text('slug').notNull(),
  title: text('title').notNull(),
  image: text('image').notNull(),
  addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  // Price of the sale already announced (or seen); null while not on sale.
  notifiedPrice: money('notified_price'),
  // True until the daily job reads this game's price once: a sale running
  // at that point counts as already seen, so it never triggers an email.
  baselinePending: boolean('baseline_pending').notNull().default(true)
}, (table) => [primaryKey({ columns: [table.userId, table.gameId] })])

// One row per favorited game per day: our own price history.
export const priceSnapshots = pgTable('price_snapshots', {
  gameId: text('game_id').notNull(),
  day: date('day').notNull(),
  price: money('price').notNull(),
  regular: money('regular').notNull(),
  cut: integer('cut').notNull(),
  shop: text('shop').notNull(),
  historyLow: money('history_low')
}, (table) => [primaryKey({ columns: [table.gameId, table.day] })])

// Every email sent, to stay under the provider's daily quota.
export const emailSends = pgTable('email_sends', {
  id: serial('id').primaryKey(),
  kind: text('kind', { enum: ['login', 'alert'] }).notNull(),
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow()
})
