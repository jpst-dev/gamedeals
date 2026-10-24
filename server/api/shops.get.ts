export default defineCachedEventHandler(async () => {
  const shops = await itadFetch<unknown[]>('/service/shops/v1', {
    params: { country: ITAD_COUNTRY }
  })

  return (Array.isArray(shops) ? shops : [])
    .map((entry) => {
      const shop = entry as Record<string, unknown>
      return { id: Number(shop.id), title: String(shop.title ?? shop.name ?? '') }
    })
    .filter((shop) => Number.isInteger(shop.id) && shop.title)
    .sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'))
}, { maxAge: 86_400, swr: true, name: 'itad-shops' })
