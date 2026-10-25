import { describe, expect, it } from 'vitest'
import { buildUnsubscribeUrls, signUnsubscribe, verifyUnsubscribe } from '../../server/utils/unsubscribe'

const secret = 'x'.repeat(32)

describe('link de sair dos emails', () => {
  it('aceita a assinatura certa', () => {
    expect(verifyUnsubscribe('user-1', signUnsubscribe('user-1', secret), secret)).toBe(true)
  })

  it('recusa usuário trocado', () => {
    expect(verifyUnsubscribe('user-2', signUnsubscribe('user-1', secret), secret)).toBe(false)
  })

  it('recusa assinatura de tamanho diferente sem lançar', () => {
    expect(verifyUnsubscribe('user-1', 'abc', secret)).toBe(false)
  })

  it('monta as duas URLs', () => {
    const sig = signUnsubscribe('user-1', secret)
    expect(buildUnsubscribeUrls('https://dealsgamer.com', 'user-1', secret)).toEqual({
      page: `https://dealsgamer.com/alertas/sair?u=user-1&sig=${sig}`,
      oneClick: `https://dealsgamer.com/api/alerts/unsubscribe?u=user-1&sig=${sig}`
    })
  })
})
