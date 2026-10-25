import { and, count, eq, gte, lt } from 'drizzle-orm'
import { emailSends } from '../db/schema'
import type { BestPrice } from './alerts'
import type { Db } from './db'

export type EmailMessage = {
  to: string
  subject: string
  html: string
  text: string
  headers?: Record<string, string>
}

export type SendEmail = (message: EmailMessage) => Promise<void>

export type AlertEmailGame = BestPrice & { title: string; slug: string; image: string }

// Resend's free plan allows 100 emails a day. The daily job stops at 80 so
// sign-in links always have room.
export const EMAIL_DAILY_LIMIT = 100
export const ALERT_SEND_CEILING = 80

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

// Intl puts a no-break space after "R$"; plain text keeps it readable everywhere.
const formatBRL = (value: number): string => BRL.format(value).replace(/\s/g, ' ')

const escapeHtml = (value: string): string => {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Table layout with inline styles: what Gmail, Outlook and phones all render.
const layout = (content: string, footer: string): string => `<!doctype html>
<html lang="pt-BR"><body style="margin:0;padding:0;background:#030712;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#030712;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;font-family:Arial,Helvetica,sans-serif;color:#e5e7eb;">
<tr><td style="padding:0 0 20px;font-size:20px;font-weight:bold;color:#ffffff;">GameDeals <span style="color:#4ade80;">BR</span></td></tr>
${content}
<tr><td style="padding:24px 0 0;font-size:12px;line-height:18px;color:#6b7280;">${footer}</td></tr>
</table>
</td></tr>
</table>
</body></html>`

const button = (href: string, label: string): string => {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;background:#66c0f4;color:#030712;font-weight:bold;font-size:14px;text-decoration:none;padding:10px 18px;border-radius:8px;">${escapeHtml(label)}</a>`
}

export const renderLoginEmail = (input: { link: string; siteUrl: string }): Omit<EmailMessage, 'to'> => {
  const subject = 'Seu link para entrar no GameDeals BR'
  const alertsNote = 'Ao entrar, os alertas de promoção dos seus favoritos vêm ligados. Você pode desligar quando quiser em Minha conta.'
  const html = layout(`
<tr><td style="font-size:16px;line-height:24px;padding:0 0 16px;">Clique no botão para entrar. O link vale por 15 minutos e só pode ser usado uma vez.</td></tr>
<tr><td style="padding:0 0 16px;">${button(input.link, 'Entrar no GameDeals BR')}</td></tr>
<tr><td style="font-size:13px;line-height:20px;color:#9ca3af;padding:0 0 8px;">Se o botão não funcionar, copie este endereço: <span style="word-break:break-all;color:#66c0f4;">${escapeHtml(input.link)}</span></td></tr>
<tr><td style="font-size:13px;line-height:20px;color:#9ca3af;">${escapeHtml(alertsNote)}</td></tr>`,
  `Se você não pediu este link, ignore este email. ${escapeHtml(input.siteUrl)}`)

  const text = [
    'Clique no link para entrar. Ele vale por 15 minutos e só pode ser usado uma vez.',
    '',
    input.link,
    '',
    alertsNote,
    '',
    'Se você não pediu este link, ignore este email.'
  ].join('\n')

  return { subject, html, text }
}

export const renderAlertEmail = (input: {
  games: AlertEmailGame[]
  siteUrl: string
  unsubscribeUrl: string
}): Omit<EmailMessage, 'to'> => {
  const [first] = input.games
  const subject = input.games.length === 1 && first
    ? `${first.title} entrou em promoção`
    : `${input.games.length} jogos da sua lista entraram em promoção`

  const gameUrl = (game: AlertEmailGame): string => `${input.siteUrl}/game/${encodeURIComponent(game.slug)}`

  const rows = input.games.map((game) => `
<tr><td style="padding:0 0 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#111827;border:1px solid #1f2937;border-radius:10px;">
<tr>
<td width="120" style="padding:12px;"><img src="${escapeHtml(game.image)}" width="120" alt="" style="display:block;width:120px;border-radius:6px;"></td>
<td style="padding:12px 12px 12px 0;vertical-align:top;">
<div style="font-size:16px;font-weight:bold;color:#ffffff;padding:0 0 6px;">${escapeHtml(game.title)}</div>
${game.isHistoryLow ? '<div style="font-size:12px;font-weight:bold;color:#facc15;padding:0 0 6px;">Menor preço da história</div>' : ''}
<div style="font-size:14px;padding:0 0 4px;"><span style="background:#4ade80;color:#030712;font-weight:bold;padding:2px 6px;border-radius:4px;">-${game.cut}%</span>
<span style="font-size:18px;font-weight:bold;color:#ffffff;padding-left:6px;">${formatBRL(game.price)}</span>
<span style="color:#6b7280;text-decoration:line-through;padding-left:4px;">${formatBRL(game.regular)}</span></div>
<div style="font-size:13px;color:#9ca3af;padding:0 0 10px;">na ${escapeHtml(game.shop)}</div>
${button(gameUrl(game), 'Ver ofertas')}
</td>
</tr>
</table>
</td></tr>`).join('')

  const html = layout(`
<tr><td style="font-size:16px;line-height:24px;padding:0 0 16px;">${input.games.length === 1 ? 'Um jogo dos seus favoritos entrou em promoção:' : 'Jogos dos seus favoritos entraram em promoção:'}</td></tr>
${rows}`,
  `Você recebe este email porque ativou os alertas de promoção no GameDeals BR. Preços da IsThereAnyDeal, sujeitos a mudança.<br>
<a href="${escapeHtml(input.unsubscribeUrl)}" style="color:#9ca3af;">Parar de receber estes emails</a>`)

  const text = [
    input.games.length === 1 ? 'Um jogo dos seus favoritos entrou em promoção:' : 'Jogos dos seus favoritos entraram em promoção:',
    '',
    ...input.games.map((game) => [
      game.title,
      ...(game.isHistoryLow ? ['Menor preço da história'] : []),
      `-${game.cut}% ${formatBRL(game.price)} (de ${formatBRL(game.regular)}) na ${game.shop}`,
      gameUrl(game),
      ''
    ].join('\n')),
    'Preços da IsThereAnyDeal, sujeitos a mudança.',
    `Parar de receber estes emails: ${input.unsubscribeUrl}`
  ].join('\n')

  return { subject, html, text }
}

// j***@mail.com: enough to follow a log line, never the full address.
const maskEmail = (email: string): string => email.replace(/^(.)[^@]*/, '$1***')

export const createSendEmail = (config: { apiKey: string; from: string }): SendEmail => {
  return async (message) => {
    if (!config.apiKey) {
      console.info(`[email] (not sent, no RESEND_API_KEY) to=${maskEmail(message.to)} subject="${message.subject}"`)
      return
    }
    await $fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.apiKey}` },
      body: {
        from: config.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        headers: message.headers
      },
      timeout: 10_000
    })
  }
}

const startOfUtcDay = (now: Date): Date => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

export const countEmailsToday = async (db: Db, now: Date): Promise<number> => {
  const start = startOfUtcDay(now)
  const end = new Date(start.getTime() + 86_400_000)
  const [row] = await db.select({ total: count() }).from(emailSends)
    .where(and(gte(emailSends.sentAt, start), lt(emailSends.sentAt, end)))
  return row?.total ?? 0
}

export const recordEmail = async (db: Db, kind: 'login' | 'alert', now: Date = new Date()): Promise<void> => {
  await db.insert(emailSends).values({ kind, sentAt: now })
}

// Sign-in emails stop at 60 a day so a flood of requests can't use up the
// alerts' share; they never pass the provider's total either.
export const LOGIN_DAILY_CAP = 60

export const canSendLoginEmail = async (db: Db, now: Date): Promise<boolean> => {
  const start = startOfUtcDay(now)
  const end = new Date(start.getTime() + 86_400_000)
  const today = and(gte(emailSends.sentAt, start), lt(emailSends.sentAt, end))
  const [logins] = await db.select({ total: count() }).from(emailSends).where(and(today, eq(emailSends.kind, 'login')))
  return (logins?.total ?? 0) < LOGIN_DAILY_CAP && await countEmailsToday(db, now) < EMAIL_DAILY_LIMIT
}
