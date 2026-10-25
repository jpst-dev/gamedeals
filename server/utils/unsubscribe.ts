import { createHmac, timingSafeEqual } from 'node:crypto'

// "Stop receiving" links work without signing in, so they carry an HMAC of
// the user id instead of a stored token.
export const signUnsubscribe = (userId: string, secret: string): string => {
  return createHmac('sha256', secret).update(`unsubscribe:${userId}`).digest('hex')
}

export const verifyUnsubscribe = (userId: string, sig: string, secret: string): boolean => {
  const expected = Buffer.from(signUnsubscribe(userId, secret))
  const given = Buffer.from(sig)
  return expected.length === given.length && timingSafeEqual(expected, given)
}

export const buildUnsubscribeUrls = (siteUrl: string, userId: string, secret: string): { page: string; oneClick: string } => {
  const query = new URLSearchParams({ u: userId, sig: signUnsubscribe(userId, secret) }).toString()
  return {
    page: `${siteUrl}/alertas/sair?${query}`,
    oneClick: `${siteUrl}/api/alerts/unsubscribe?${query}`
  }
}
