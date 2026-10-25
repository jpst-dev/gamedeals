// Called once a day by Vercel Cron (vercel.json), which sends
// Authorization: Bearer <CRON_SECRET>.
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  if (!config.public.accountsEnabled) {
    return { skipped: true }
  }
  if (!config.cronSecret || getHeader(event, 'authorization') !== `Bearer ${config.cronSecret}`) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  return runDailyAlerts({
    db: await useDb(),
    // Same request as /api/games/prices but without `capacity`, so every
    // shop of each game comes back.
    fetchPrices: (ids) => itadFetch<unknown[]>('/games/prices/v3', {
      method: 'POST',
      params: { country: ITAD_COUNTRY, deals: false, vouchers: true },
      body: ids
    }),
    sendEmail: createSendEmail({ apiKey: config.resendApiKey, from: config.emailFrom }),
    now: new Date(),
    siteUrl: config.public.siteUrl,
    secret: config.session.password
  })
})
