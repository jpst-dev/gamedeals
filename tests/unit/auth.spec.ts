import { describe, expect, it } from 'vitest'
import { loginTokens } from '../../server/db/schema'
import { consumeLoginToken, findOrCreateUser, normalizeEmail, requestLoginLink } from '../../server/utils/auth'
import { createTestDb } from './helpers/test-db'

const now = new Date('2026-10-25T12:00:00Z')
const later = (ms: number) => new Date(now.getTime() + ms)

const tokenOf = (result: Awaited<ReturnType<typeof requestLoginLink>>): string => {
  if (!('token' in result)) {
    throw new Error('expected a token')
  }
  return result.token
}

describe('normalizeEmail', () => {
  it('normaliza espaços e maiúsculas', () => {
    expect(normalizeEmail(' Joao@Mail.com ')).toBe('joao@mail.com')
  })

  it('recusa formato inválido', () => {
    expect(normalizeEmail('sem-arroba')).toBeNull()
    expect(normalizeEmail(42)).toBeNull()
    expect(normalizeEmail(`${'a'.repeat(250)}@b.com`)).toBeNull()
  })
})

describe('link de login', () => {
  it('é consumido uma vez só', async () => {
    const db = await createTestDb()
    const token = tokenOf(await requestLoginLink(db, { email: 'joao@mail.com', ip: '1.1.1.1', now }))
    expect(await consumeLoginToken(db, token, later(1000))).toBe('joao@mail.com')
    expect(await consumeLoginToken(db, token, later(2000))).toBeNull()
  })

  it('expira depois de 15 minutos', async () => {
    const db = await createTestDb()
    const token = tokenOf(await requestLoginLink(db, { email: 'joao@mail.com', ip: '1.1.1.1', now }))
    expect(await consumeLoginToken(db, token, later(15 * 60_000 + 1000))).toBeNull()
  })

  it('pedir o link não consome o token', async () => {
    const db = await createTestDb()
    const token = tokenOf(await requestLoginLink(db, { email: 'joao@mail.com', ip: '1.1.1.1', now }))
    await requestLoginLink(db, { email: 'joao@mail.com', ip: '1.1.1.1', now: later(1000) })
    expect(await consumeLoginToken(db, token, later(2000))).toBe('joao@mail.com')
  })

  it('guarda só o hash do token', async () => {
    const db = await createTestDb()
    const token = tokenOf(await requestLoginLink(db, { email: 'joao@mail.com', ip: '1.1.1.1', now }))
    const rows = await db.select().from(loginTokens)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.tokenHash).not.toBe(token)
    expect(rows[0]?.ipHash).not.toBe('1.1.1.1')
  })

  it('token desconhecido não entra', async () => {
    const db = await createTestDb()
    expect(await consumeLoginToken(db, 'nada', now)).toBeNull()
  })
})

describe('limites de pedido', () => {
  it('3 por email, escrito de qualquer jeito', async () => {
    const db = await createTestDb()
    const spellings = ['Joao@Mail.com ', 'joao@mail.com', ' joao@MAIL.com']
    for (const [index, email] of spellings.entries()) {
      expect(await requestLoginLink(db, { email, ip: `10.0.0.${index}`, now })).toHaveProperty('token')
    }
    expect(await requestLoginLink(db, { email: 'JOAO@mail.com', ip: '10.0.0.9', now })).toEqual({ limited: true })
  })

  it('10 por IP', async () => {
    const db = await createTestDb()
    for (let index = 0; index < 10; index += 1) {
      expect(await requestLoginLink(db, { email: `p${index}@mail.com`, ip: '2.2.2.2', now })).toHaveProperty('token')
    }
    expect(await requestLoginLink(db, { email: 'outro@mail.com', ip: '2.2.2.2', now })).toEqual({ limited: true })
  })

  it('pedidos com mais de 15 minutos não contam', async () => {
    const db = await createTestDb()
    for (let index = 0; index < 3; index += 1) {
      await requestLoginLink(db, { email: 'joao@mail.com', ip: '3.3.3.3', now })
    }
    expect(await requestLoginLink(db, { email: 'joao@mail.com', ip: '3.3.3.3', now: later(15 * 60_000 + 1000) })).toHaveProperty('token')
  })
})

describe('findOrCreateUser', () => {
  it('cria uma vez e depois reaproveita', async () => {
    const db = await createTestDb()
    const first = await findOrCreateUser(db, 'joao@mail.com')
    const second = await findOrCreateUser(db, 'joao@mail.com')
    expect(first.created).toBe(true)
    expect(second).toEqual({ id: first.id, email: 'joao@mail.com', created: false })
  })
})
