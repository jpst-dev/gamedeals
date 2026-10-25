export default defineEventHandler(async (event) => {
  requireAccountsEnabled(event)
  await clearUserSession(event)
  return { ok: true }
})
