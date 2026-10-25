import { MAX_FAVORITES, type FavoriteGame } from '../../../app/utils/favorites'

// Called after every sign-in with the browser's favorites; returns the
// account's final list.
export default defineEventHandler(async (event) => {
  requireAccountsEnabled(event)
  const { user } = await requireUserSession(event)
  const body = await readBody<{ items?: unknown } | null>(event)
  if (!Array.isArray(body?.items) || body.items.length > MAX_FAVORITES) {
    throw createError({ statusCode: 400, statusMessage: `items must be a list of up to ${MAX_FAVORITES}` })
  }
  const now = new Date()
  const items = body.items.map((raw) => parseFavoriteGame(raw, now))
  if (items.some((item) => item === null)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid favorite' })
  }
  return mergeBrowserFavorites(await useDb(), user.id, items as FavoriteGame[])
})
