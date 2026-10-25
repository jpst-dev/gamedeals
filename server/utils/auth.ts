import { createHash, randomBytes } from 'node:crypto'
import { and, count, eq, gt, isNull } from 'drizzle-orm'
import { loginTokens, users } from '../db/schema'
import type { Db } from './db'

export const LOGIN_TOKEN_TTL_MS = 15 * 60_000
export const LOGIN_LIMIT_PER_EMAIL = 3
export const LOGIN_LIMIT_PER_IP = 10
export const LOGIN_LIMIT_WINDOW_MS = 15 * 60_000

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const normalizeEmail = (raw: unknown): string | null => {
  if (typeof raw !== 'string') {
    return null
  }
  const email = raw.trim().toLowerCase()
  return email.length <= 254 && EMAIL_PATTERN.test(email) ? email : null
}

export const hashValue = (value: string): string => createHash('sha256').update(value).digest('hex')

// Creates a sign-in link token unless this email or IP asked too often.
// Only hashes are stored; the plain token goes in the email.
export const requestLoginLink = async (
  db: Db,
  input: { email: string; ip: string; now: Date }
): Promise<{ token: string } | { limited: true }> => {
  const email = normalizeEmail(input.email)
  if (!email) {
    throw new Error('requestLoginLink needs a valid email')
  }
  const ipHash = hashValue(input.ip)
  const since = new Date(input.now.getTime() - LOGIN_LIMIT_WINDOW_MS)

  const [byEmail] = await db.select({ total: count() }).from(loginTokens)
    .where(and(eq(loginTokens.email, email), gt(loginTokens.createdAt, since)))
  const [byIp] = await db.select({ total: count() }).from(loginTokens)
    .where(and(eq(loginTokens.ipHash, ipHash), gt(loginTokens.createdAt, since)))
  if ((byEmail?.total ?? 0) >= LOGIN_LIMIT_PER_EMAIL || (byIp?.total ?? 0) >= LOGIN_LIMIT_PER_IP) {
    return { limited: true }
  }

  const token = randomBytes(32).toString('base64url')
  await db.insert(loginTokens).values({
    tokenHash: hashValue(token),
    email,
    ipHash,
    expiresAt: new Date(input.now.getTime() + LOGIN_TOKEN_TTL_MS),
    createdAt: input.now
  })
  return { token }
}

// Single use: the update only matches an unused, unexpired token.
export const consumeLoginToken = async (db: Db, token: string, now: Date): Promise<string | null> => {
  const [row] = await db.update(loginTokens)
    .set({ usedAt: now })
    .where(and(eq(loginTokens.tokenHash, hashValue(token)), isNull(loginTokens.usedAt), gt(loginTokens.expiresAt, now)))
    .returning({ email: loginTokens.email })
  return row?.email ?? null
}

export const findOrCreateUser = async (db: Db, email: string): Promise<{ id: string; email: string; created: boolean }> => {
  const [created] = await db.insert(users).values({ email }).onConflictDoNothing().returning({ id: users.id })
  if (created) {
    return { id: created.id, email, created: true }
  }
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email))
  if (!existing) {
    throw new Error('user vanished between insert and select')
  }
  return { id: existing.id, email, created: false }
}
