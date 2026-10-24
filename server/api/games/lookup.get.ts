export default defineCachedEventHandler(async (event) => {
  const query = getQuery(event)
  const title = String(query.title ?? '').trim().slice(0, 100)
  if (!title) {
    throw createError({ statusCode: 400, statusMessage: 'title is required' })
  }

  return await itadFetch('/games/lookup/v1', { params: { title } })
}, { maxAge: 86_400, swr: true, name: 'itad-lookup' })
