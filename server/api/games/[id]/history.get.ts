const HISTORY_WINDOW_DAYS = 365

export default defineCachedEventHandler(async (event) => {
  const id = requireGameId(event)
  // ITAD defaults to the last 3 months; ask for a full year instead.
  const since = new Date(Date.now() - HISTORY_WINDOW_DAYS * 86_400_000)
  since.setUTCHours(0, 0, 0, 0)

  return await itadFetch('/games/history/v2', {
    // ITAD rejects fractional seconds ("Invalid 'since' format"), so drop the ".000".
    params: { id, country: ITAD_COUNTRY, since: since.toISOString().replace(/\.\d{3}Z$/, 'Z') }
  })
}, { maxAge: 3_600, swr: true, name: 'itad-history' })
