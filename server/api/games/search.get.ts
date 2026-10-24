export default defineCachedEventHandler(async (event) => {
  const query = getQuery(event)
  const title = String(query.q ?? '').trim().slice(0, 100)
  if (!title) {
    return []
  }

  return await itadFetch('/games/search/v1', {
    params: { title, results: parseIntInRange(query.limit, 20, 1, 50) }
  })
}, { maxAge: 300, swr: true, name: 'itad-search' })
