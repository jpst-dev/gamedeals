export default defineCachedEventHandler(async (event) => {
  const id = requireGameId(event)
  return await itadFetch('/games/prices/v3', {
    method: 'POST',
    params: { country: ITAD_COUNTRY, deals: false, vouchers: true, capacity: 30 },
    body: [id]
  })
}, { maxAge: 120, swr: true, name: 'itad-prices' })
