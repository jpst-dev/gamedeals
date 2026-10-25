import { describe, expect, it } from 'vitest'
import { emailSends } from '../../server/db/schema'
import { countEmailsToday, recordEmail, renderAlertEmail, renderLoginEmail } from '../../server/utils/email'
import { createTestDb } from './helpers/test-db'

const siteUrl = 'https://dealsgamer.com'
const unsubscribeUrl = `${siteUrl}/alertas/sair?u=1&sig=abc`

const game = (title: string, slug: string, overrides = {}) => ({
  gameId: slug, price: 40, regular: 100, cut: 60, shop: 'Nuuvem', historyLow: 30, isHistoryLow: false,
  title, slug, image: 'https://img/x.jpg', ...overrides
})

describe('renderAlertEmail', () => {
  it('um jogo: assunto com o nome e dados da oferta', () => {
    const email = renderAlertEmail({ games: [game('Elden Ring', 'elden-ring')], siteUrl, unsubscribeUrl })
    expect(email.subject).toBe('Elden Ring entrou em promoção')
    for (const body of [email.html, email.text]) {
      expect(body).toContain('R$ 40,00')
      expect(body).toContain('-60%')
      expect(body).toContain('Nuuvem')
      expect(body).toContain(`${siteUrl}/game/elden-ring`)
    }
    expect(email.text).toContain(unsubscribeUrl)
    // In HTML the & of the query string is escaped.
    expect(email.html).toContain(unsubscribeUrl.replace('&', '&amp;'))
    expect(email.html).not.toContain('Menor preço da história')
  })

  it('vários jogos: assunto com a contagem', () => {
    const games = [game('A', 'a'), game('B', 'b'), game('C', 'c')]
    expect(renderAlertEmail({ games, siteUrl, unsubscribeUrl }).subject).toBe('3 jogos da sua lista entraram em promoção')
  })

  it('destaca o menor preço da história', () => {
    const email = renderAlertEmail({ games: [game('A', 'a', { isHistoryLow: true })], siteUrl, unsubscribeUrl })
    expect(email.html).toContain('Menor preço da história')
    expect(email.text).toContain('Menor preço da história')
  })

  it('escapa HTML do título', () => {
    const email = renderAlertEmail({ games: [game('<b>X</b>', 'x')], siteUrl, unsubscribeUrl })
    expect(email.html).not.toContain('<b>X</b>')
  })
})

describe('renderLoginEmail', () => {
  it('traz o link, a validade e o aviso dos alertas', () => {
    const link = `${siteUrl}/entrar/confirmar?token=abc`
    const email = renderLoginEmail({ link, siteUrl })
    expect(email.subject).toBe('Seu link para entrar no GameDeals BR')
    for (const body of [email.html, email.text]) {
      expect(body).toContain(link)
      expect(body).toContain('15 minutos')
      expect(body).toContain('os alertas de promoção dos seus favoritos vêm ligados')
    }
  })
})

describe('quota diária', () => {
  it('conta só os envios do dia (UTC)', async () => {
    const db = await createTestDb()
    const now = new Date('2026-10-25T15:00:00Z')
    await recordEmail(db, 'login', now)
    await db.insert(emailSends).values([
      { kind: 'alert', sentAt: new Date('2026-10-25T00:10:00Z') },
      { kind: 'alert', sentAt: new Date('2026-10-24T23:50:00Z') }
    ])
    expect(await countEmailsToday(db, now)).toBe(2)
  })
})
