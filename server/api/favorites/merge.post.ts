import { MAX_FAVORITES } from '../../../app/utils/favorites'

// Called right after each sign-in with the browser's favorites; returns the
// account's final list. Invalid entries are skipped, not fatal.
export default defineEventHandler(async (event) => {
  requireAccountsEnabled(event)
  const { user } = await requireUserSession(event)
  const body = await readBody<{ items?: unknown } | null>(event)
  if (!Array.isArray(body?.items) || body.items.length > MAX_FAVORITES) {
    throw createError({ statusCode: 400, statusMessage: `items must be a list of up to ${MAX_FAVORITES}` })
  }
  return mergeBrowserFavorites(await useDb(), user.id, parseFavoriteList(body.items, new Date()))
})
