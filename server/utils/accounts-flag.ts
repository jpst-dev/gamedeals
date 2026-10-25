import type { H3Event } from 'h3'

// Accounts and alerts stay hidden until the own domain exists (sign-in links
// are emails too). Off: every account route answers 404.
export const requireAccountsEnabled = (event: H3Event): void => {
  if (!useRuntimeConfig(event).public.accountsEnabled) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }
}
