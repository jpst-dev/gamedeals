export default defineEventHandler(async (event) => {
  requireAccountsEnabled(event)
  const { user } = await requireUserSession(event)
  const body = await readBody<{ alertsEnabled?: unknown } | null>(event)
  if (typeof body?.alertsEnabled !== 'boolean') {
    throw createError({ statusCode: 400, statusMessage: 'alertsEnabled must be a boolean' })
  }
  await setAlertsEnabled(await useDb(), user.id, body.alertsEnabled)
  return { alertsEnabled: body.alertsEnabled }
})
