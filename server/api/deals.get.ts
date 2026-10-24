export default defineCachedEventHandler(async (event) => {
  return await fetchDealsPage(parseDealQuery(getQuery(event)))
}, { maxAge: 60, swr: true, name: 'itad-deals' })
