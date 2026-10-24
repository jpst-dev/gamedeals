export default defineCachedEventHandler(async (event) => {
  const query = getQuery(event)
  const shops = parseShopIds(query.shops)
  const minCut = parseOptionalNumber(query.minCut, 0, 100)
  const filter = minCut ? JSON.stringify({ cut: { min: minCut, max: null } }) : undefined

  return await itadFetch('/deals/v2', {
    params: {
      country: ITAD_COUNTRY,
      limit: parseIntInRange(query.limit, 20, 1, 50),
      offset: parseIntInRange(query.offset, 0, 0, 5000),
      sort: parseDealSort(query.sort),
      nondeals: false,
      shops: shops.length > 0 ? shops.map(String) : undefined,
      filter
    }
  })
}, { maxAge: 60, swr: true, name: 'itad-deals' })
