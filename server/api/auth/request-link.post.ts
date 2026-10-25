// Always the same answer for a well-formed email: it never tells whether an
// account exists or whether the request was rate limited.
export default defineEventHandler(async (event) => {
  requireAccountsEnabled(event)
  const body = await readBody<{ email?: unknown } | null>(event)
  const email = normalizeEmail(body?.email)
  if (!email) {
    throw createError({ statusCode: 400, statusMessage: 'Email inválido' })
  }

  const config = useRuntimeConfig(event)
  const db = await useDb()
  const now = new Date()
  const result = await requestLoginLink(db, { email, ip: getRequestIP(event, { xForwardedFor: true }) ?? 'unknown', now })
  if (!('token' in result) || await countEmailsToday(db, now) >= EMAIL_DAILY_LIMIT) {
    return { ok: true }
  }

  const siteUrl = config.public.siteUrl
  const link = `${siteUrl}/entrar/confirmar?token=${result.token}`
  if (import.meta.dev && !config.resendApiKey) {
    console.info(`[auth] sign-in link (dev only): ${link}`)
  }
  try {
    const sendEmail = createSendEmail({ apiKey: config.resendApiKey, from: config.emailFrom })
    await sendEmail({ to: email, ...renderLoginEmail({ link, siteUrl }) })
    await recordEmail(db, 'login')
  } catch {
    console.error('[auth] sign-in email failed')
  }
  return { ok: true }
})
