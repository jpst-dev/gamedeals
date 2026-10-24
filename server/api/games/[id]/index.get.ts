export default defineCachedEventHandler(async (event) => {
  const id = requireGameId(event)
  return await itadFetch('/games/info/v2', { params: { id } })
}, { maxAge: 3_600, swr: true, name: 'itad-info' })
