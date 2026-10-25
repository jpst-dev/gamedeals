import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import * as schema from '../../../server/db/schema'
import type { Db } from '../../../server/utils/db'

// In-memory Postgres with the real migrations applied. `onQuery` sees every
// statement sent after the migrations.
export const createTestDb = async (onQuery?: (query: string) => void): Promise<Db> => {
  let ready = false
  const db = drizzle(new PGlite(), {
    schema,
    logger: { logQuery: (query) => { if (ready) onQuery?.(query) } }
  })
  await migrate(db, { migrationsFolder: 'server/db/migrations' })
  ready = true
  return db as unknown as Db
}
