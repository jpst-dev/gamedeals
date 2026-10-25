export default defineEventHandler(async (event) => {
  requireAccountsEnabled(event)
  const { user } = await requireUserSession(event)
  const gameId = getRouterParam(event, 'id')
  if (!isGameId(gameId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid game id' })
  }
  await removeFavorite(await useDb(), user.id, gameId)
  return { ok: true }
})
