export default defineEventHandler(async (event) => {
  requireAccountsEnabled(event)
  const { user } = await requireUserSession(event)
  const body = await readBody<Record<string, unknown> | null>(event)
  const game = parseFavoriteGame({ ...body, id: getRouterParam(event, 'id') }, new Date())
  if (!game) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid favorite' })
  }
  return { result: await addFavorite(await useDb(), user.id, game) }
})
