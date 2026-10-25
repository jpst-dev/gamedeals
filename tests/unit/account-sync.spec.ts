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

describe('carregar o site logado', () => {
  // A merge on every load would bring back, from a device still signed in,
  // a favorite removed on another one. Merge only right after sign-in.
  it('busca a lista da conta em vez de juntar com a do navegador', () => {
    const app = readFileSync('app/app.vue', 'utf8')
    const mounted = app.slice(app.indexOf('onMounted('), app.indexOf('})', app.indexOf('onMounted(')))
    expect(mounted).toContain('refreshFavorites()')
    expect(mounted).not.toContain('syncAfterLogin')
  })
})
