import { and, asc, count, eq } from 'drizzle-orm'
import { MAX_FAVORITES, type FavoriteGame, type FavoriteInput } from '../../app/utils/favorites'
import { favorites, users } from '../db/schema'
import type { Db } from './db'
import { isGameId } from './itad'
import { verifyUnsubscribe } from './unsubscribe'

// Account favorites first (their order), then the browser's missing ones,
// newest first, up to max.
export const mergeFavoriteLists = (account: FavoriteGame[], browser: FavoriteGame[], max: number): FavoriteGame[] => {
  const known = new Set(account.map((item) => item.id))
  const extra = browser
    .filter((item) => !known.has(item.id))
    .filter((item, index, list) => list.findIndex((other) => other.id === item.id) === index)
    .sort((a, b) => b.addedAt.localeCompare(a.addedAt))
  return [...account, ...extra].slice(0, max)
}

export const listFavorites = async (db: Db, userId: string): Promise<FavoriteGame[]> => {
  const rows = await db.select().from(favorites).where(eq(favorites.userId, userId)).orderBy(asc(favorites.addedAt))
  return rows.map((row) => ({ id: row.gameId, slug: row.slug, title: row.title, image: row.image, addedAt: row.addedAt.toISOString() }))
}

export const addFavorite = async (db: Db, userId: string, game: FavoriteInput): Promise<'added' | 'exists' | 'limit'> => {
  const [existing] = await db.select({ total: count() }).from(favorites).where(eq(favorites.userId, userId))
  const total = existing?.total ?? 0
  const [inserted] = total >= MAX_FAVORITES
    ? []
    : await db.insert(favorites)
      .values({ userId, gameId: game.id, slug: game.slug, title: game.title, image: game.image })
      .onConflictDoNothing()
      .returning({ gameId: favorites.gameId })
  if (inserted) {
    return 'added'
  }
  const current = await listFavorites(db, userId)
  return current.some((item) => item.id === game.id) ? 'exists' : 'limit'
}

export const removeFavorite = async (db: Db, userId: string, gameId: string): Promise<void> => {
  await db.delete(favorites).where(and(eq(favorites.userId, userId), eq(favorites.gameId, gameId)))
}

// New rows start with baselinePending, so a sale already running when they
// arrive counts as seen.
export const mergeBrowserFavorites = async (db: Db, userId: string, browser: FavoriteGame[]): Promise<FavoriteGame[]> => {
  const current = await listFavorites(db, userId)
  const known = new Set(current.map((item) => item.id))
  const added = mergeFavoriteLists(current, browser, MAX_FAVORITES).filter((item) => !known.has(item.id))
  if (added.length > 0) {
    await db.insert(favorites).values(added.map((item) => ({
      userId,
      gameId: item.id,
      slug: item.slug,
      title: item.title,
      image: item.image,
      addedAt: new Date(item.addedAt)
    }))).onConflictDoNothing()
  }
  return listFavorites(db, userId)
}

export const setAlertsEnabled = async (db: Db, userId: string, enabled: boolean): Promise<void> => {
  await db.update(users).set({ alertsEnabled: enabled }).where(eq(users.id, userId))
}

// Favorites go with it (on delete cascade).
export const deleteUser = async (db: Db, userId: string): Promise<void> => {
  await db.delete(users).where(eq(users.id, userId))
}

export const unsubscribeWithSignature = async (db: Db, userId: string, sig: string, secret: string): Promise<boolean> => {
  if (!secret || !verifyUnsubscribe(userId, sig, secret)) {
    return false
  }
  await setAlertsEnabled(db, userId, false)
  return true
}

const shortText = (value: unknown, max: number): string | null => {
  return typeof value === 'string' && value.length > 0 && value.length <= max ? value : null
}

// Favorites sent by the browser: checked before they reach the database.
export const parseFavoriteGame = (raw: unknown, now: Date): FavoriteGame | null => {
  const item = raw !== null && typeof raw === 'object' ? raw as Record<string, unknown> : null
  const slug = shortText(item?.slug, 300)
  const title = shortText(item?.title, 300)
  const image = typeof item?.image === 'string' && item.image.length <= 2000 ? item.image : null
  if (!item || !isGameId(item.id) || !slug || !title || image === null) {
    return null
  }
  const addedAt = typeof item.addedAt === 'string' && !Number.isNaN(Date.parse(item.addedAt)) ? new Date(item.addedAt) : now
  return { id: item.id, slug, title, image, addedAt: addedAt.toISOString() }
}
