import { neon } from '@neondatabase/serverless'
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import * as schema from '../db/schema'

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>

let dbPromise: Promise<Db> | undefined

// Neon over HTTP when DATABASE_URL is set. Without it (local development) a
// PGlite database in .data/pglite, loaded lazily so it stays out of the
// production bundle's hot path.
const connect = async (): Promise<Db> => {
  const { databaseUrl } = useRuntimeConfig()
  if (databaseUrl) {
    return drizzleNeon(neon(databaseUrl), { schema }) as unknown as Db
  }
  if (!import.meta.dev) {
    throw createError({ statusCode: 503, statusMessage: 'DATABASE_URL is not configured' })
  }

  const { PGlite } = await import('@electric-sql/pglite')
  const { drizzle } = await import('drizzle-orm/pglite')
  const { migrate } = await import('drizzle-orm/pglite/migrator')
  const db = drizzle(new PGlite('.data/pglite'), { schema })
  await migrate(db, { migrationsFolder: 'server/db/migrations' })
  return db as unknown as Db
}

export const useDb = (): Promise<Db> => {
  dbPromise ??= connect().catch((error: unknown) => {
    dbPromise = undefined
    throw error
  })
  return dbPromise
}
