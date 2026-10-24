const STEAM_APPDETAILS_URL = 'https://store.steampowered.com/api/appdetails'

export default defineCachedEventHandler(async (event) => {
  const appid = Number.parseInt(getRouterParam(event, 'appid') ?? '', 10)
  if (!Number.isInteger(appid) || appid <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid appid' })
  }

  const emptyMedia = { screenshots: [], videos: [], shortDescription: '' }
  const url = new URL(STEAM_APPDETAILS_URL)
  url.searchParams.set('appids', String(appid))
  url.searchParams.set('cc', 'br')
  url.searchParams.set('l', 'brazilian')

  // Media is a nice-to-have: a Steam outage must not break the game page.
  const response = await $fetch<Record<string, unknown>>(url.toString(), { timeout: 10_000 })
    .catch(() => null)
  const appNode = (response?.[String(appid)] ?? {}) as Record<string, unknown>
  if (!appNode.success) {
    return emptyMedia
  }

  const dataNode = (appNode.data ?? {}) as Record<string, unknown>
  return {
    screenshots: Array.isArray(dataNode.screenshots) ? dataNode.screenshots : [],
    videos: Array.isArray(dataNode.movies) ? dataNode.movies : [],
    shortDescription: typeof dataNode.short_description === 'string' ? dataNode.short_description : ''
  }
}, { maxAge: 21_600, swr: true, name: 'steam-media' })
