// The email link opens /entrar/confirmar, whose button posts here: link
// scanners that prefetch GET links can't use up the token.
export default defineEventHandler(async (event) => {
  requireAccountsEnabled(event)
  const body = await readBody<{ token?: unknown } | null>(event)
  const db = await useDb()
  const email = typeof body?.token === 'string' ? await consumeLoginToken(db, body.token, new Date()) : null
  if (!email) {
    throw createError({ statusCode: 400, statusMessage: 'Link inválido ou expirado' })
  }

  const user = await findOrCreateUser(db, email)
  await setUserSession(event, { user: { id: user.id, email: user.email } })
  return { ok: true, created: user.created }
})
