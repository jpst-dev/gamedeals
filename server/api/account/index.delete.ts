export default defineEventHandler(async (event) => {
  requireAccountsEnabled(event)
  const { user } = await requireUserSession(event)
  await deleteUser(await useDb(), user.id)
  await clearUserSession(event)
  return { ok: true }
})
