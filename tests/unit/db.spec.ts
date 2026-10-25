import { describe, expect, it } from 'vitest'
import { users } from '../../server/db/schema'
import { createTestDb } from './helpers/test-db'

describe('banco', () => {
  it('migrações criam as tabelas e o email é único', async () => {
    const db = await createTestDb()
    await db.insert(users).values({ email: 'a@b.com' })
    await expect(db.insert(users).values({ email: 'a@b.com' })).rejects.toThrow()
    const [user] = await db.select().from(users)
    expect(user?.alertsEnabled).toBe(true)
  })
})
