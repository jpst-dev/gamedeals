import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { planFavoriteSync } from '../../app/composables/useAccount'

describe('sincronização dos favoritos', () => {
  const id = '018d9386-46b0-70e5-9b53-b1ca00522c36'

  it('adicionar vira PUT', () => {
    expect(planFavoriteSync('added', id)).toEqual({ method: 'PUT', url: `/api/favorites/${id}` })
  })

  it('remover vira DELETE', () => {
    expect(planFavoriteSync('removed', id)).toEqual({ method: 'DELETE', url: `/api/favorites/${id}` })
  })
})

describe('contas escondidas por padrão', () => {
  it('só ligam com NUXT_PUBLIC_ACCOUNTS_ENABLED=true', () => {
    expect(readFileSync('nuxt.config.ts', 'utf8')).toContain("accountsEnabled: process.env.NUXT_PUBLIC_ACCOUNTS_ENABLED === 'true'")
  })
})
