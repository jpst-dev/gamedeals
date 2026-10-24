// Batch current-price lookup (used by search results): ?ids=uuid,uuid,...
export default defineCachedEventHandler(async (event) => {
  const ids = parseGameIds(getQuery(event).ids, 50)
  if (ids.length === 0) {
    return []
  }

  return await itadFetch('/games/prices/v3', {
    method: 'POST',
    params: { country: ITAD_COUNTRY, deals: false, vouchers: true, capacity: 1 },
    body: ids
  })
}, { maxAge: 120, swr: true, name: 'itad-prices-batch' })
