import { createHash, randomBytes } from 'node:crypto'
import { and, eq, gt, isNull, lt, sql } from 'drizzle-orm'
import { loginTokens, users } from '../db/schema'
import type { Db } from './db'

export const LOGIN_TOKEN_TTL_MS = 15 * 60_000
export const LOGIN_LIMIT_PER_EMAIL = 3
export const LOGIN_LIMIT_PER_IP = 10
export const LOGIN_LIMIT_PER_IP_PER_DAY = 20
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
  const rateKey = rateLimitKey(email)
  const ipHash = hashValue(input.ip)
  const at = (offsetMs: number): string => new Date(input.now.getTime() + offsetMs).toISOString()
  const token = randomBytes(32).toString('base64url')

  // Check and insert in one statement, so parallel requests can't all slip
  // past the counts.
  const result = await db.execute(sql`
    insert into ${loginTokens} (token_hash, email, rate_key, ip_hash, expires_at, created_at)
    select ${hashValue(token)}, ${email}, ${rateKey}, ${ipHash}, ${at(LOGIN_TOKEN_TTL_MS)}::timestamptz, ${at(0)}::timestamptz
    where (select count(*) from ${loginTokens} where rate_key = ${rateKey} and created_at > ${at(-LOGIN_LIMIT_WINDOW_MS)}::timestamptz) < ${LOGIN_LIMIT_PER_EMAIL}
      and (select count(*) from ${loginTokens} where ip_hash = ${ipHash} and created_at > ${at(-LOGIN_LIMIT_WINDOW_MS)}::timestamptz) < ${LOGIN_LIMIT_PER_IP}
      and (select count(*) from ${loginTokens} where ip_hash = ${ipHash} and created_at > ${at(-86_400_000)}::timestamptz) < ${LOGIN_LIMIT_PER_IP_PER_DAY}
    returning token_hash`)
  return (result as unknown as { rows: unknown[] }).rows.length > 0 ? { token } : { limited: true }
}

// joao+promo@gmail.com, jo.ao@gmail.com and joao@googlemail.com all reach the
// same inbox, so they share one rate limit.
export const rateLimitKey = (email: string): string => {
  const [local = '', domain = ''] = email.split('@')
  const gmail = domain === 'gmail.com' || domain === 'googlemail.com'
  const name = local.split('+')[0] ?? ''
  return gmail ? `${name.replace(/\./g, '')}@gmail.com` : `${name}@${domain}`
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

// Sign-in requests keep an email only as long as the rate limits need it.
export const LOGIN_TOKEN_RETENTION_MS = 86_400_000

export const pruneLoginTokens = async (db: Db, now: Date): Promise<void> => {
  await db.delete(loginTokens).where(lt(loginTokens.createdAt, new Date(now.getTime() - LOGIN_TOKEN_RETENTION_MS)))
}
