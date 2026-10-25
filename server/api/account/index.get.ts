import { eq } from 'drizzle-orm'
import { users } from '../../db/schema'

export default defineEventHandler(async (event) => {
  requireAccountsEnabled(event)
  const { user } = await requireUserSession(event)
  const db = await useDb()
  const [row] = await db.select({ email: users.email, alertsEnabled: users.alertsEnabled }).from(users).where(eq(users.id, user.id))
  if (!row) {
    // Account deleted elsewhere: drop the stale session.
    await clearUserSession(event)
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  return row
})
