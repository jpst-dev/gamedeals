// One-click "stop receiving": works without signing in. Mail apps post here
// with the body List-Unsubscribe=One-Click; the /alertas/sair page too.
export default defineEventHandler(async (event) => {
  requireAccountsEnabled(event)
  const { u, sig } = getQuery(event)
  const db = await useDb()
  const secret = useRuntimeConfig(event).session.password
  const ok = typeof u === 'string' && typeof sig === 'string' && await unsubscribeWithSignature(db, u, sig, secret)
  if (!ok) {
    throw createError({ statusCode: 400, statusMessage: 'Link inválido' })
  }
  return { ok: true }
})
