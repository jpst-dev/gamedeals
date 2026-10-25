# Alertas de promoção dos favoritos — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Contas por link de email, favoritos no banco e um email diário (no estilo lista de desejos da Steam) quando um favorito entra em promoção, tudo escondido atrás de uma configuração até existir domínio próprio.

**Architecture:** Tudo no projeto Nuxt atual. Postgres via Drizzle (Neon HTTP em produção, PGlite em desenvolvimento e testes), sessões do `nuxt-auth-utils`, Resend chamado por `$fetch` (sem SDK), e um Vercel Cron diário que chama uma rota do Nitro. A lógica (preço, decisão de alerta, merge, emails, tarefa) fica em funções de `server/utils/` com dependências injetadas, testadas com PGlite; as rotas são finas.

**Tech Stack:** Nuxt 4, Nitro, drizzle-orm + drizzle-kit, @neondatabase/serverless, @electric-sql/pglite, nuxt-auth-utils, Resend (HTTP), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-25-alertas-favoritos-design.md`

## Global Constraints

- Configuração `NUXT_PUBLIC_ACCOUNTS_ENABLED` (`runtimeConfig.public.accountsEnabled`, `true` só quando o valor for `'true'`), **desligada por padrão**. Desligada: nada de "Entrar"/"Minha conta"/convite aparece, todas as rotas `/api/auth/**`, `/api/account/**`, `/api/favorites/**`, `/api/alerts/**` respondem 404, e o cron responde `{ skipped: true }` sem tocar banco nem ITAD.
- Deslogado, favoritos funcionam exatamente como hoje (`localStorage` `gamedeals:favorites`, máximo `MAX_FAVORITES = 50`).
- Emails normalizados com `trim().toLowerCase()` antes de qualquer uso. Nunca em URLs, logs ou respostas de API (exceto `GET /api/account` para o próprio dono).
- Link de login: 32 bytes aleatórios (base64url), guardado só como SHA-256, válido **15 minutos**, uso único. Sessão: cookie do `nuxt-auth-utils`, `maxAge` **30 dias**.
- Resposta de `POST /api/auth/request-link` é sempre `{ ok: true }` para email com formato válido (exista conta ou não, com ou sem limite estourado).
- Limites de pedido de link: **3 por email e 10 por IP a cada 15 minutos**.
- Quota Resend: **100 emails/dia (UTC)**; logins podem usar até 100; a tarefa diária para quando `enviados hoje >= 80` (reserva de 20 para logins).
- Promoção = menor `price.amount` entre os `deals` da ITAD para `country: 'BR'` sem filtro de lojas, com `cut > 0`.
- Cron: `0 12 * * *` (09:00 em Brasília), rota `GET /api/cron/daily-alerts`, exige `Authorization: Bearer ${CRON_SECRET}`.
- Sem transações interativas (o driver Neon HTTP não tem); escritas idempotentes com `onConflictDoUpdate`/`onConflictDoNothing`.
- Sem `RESEND_API_KEY`, emails vão para o log do servidor (assunto e destinatário mascarado, `j***@x.com`) em vez de enviados.
- Links de compra da ITAD nunca são alterados. Textos em pt-BR, tom do site.
- Segredos só em `.env`/Vercel; nunca imprimir nem commitar.
- Variáveis novas no `.env.example` (sem valores): `DATABASE_URL`, `NUXT_SESSION_PASSWORD`, `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET`, `NUXT_PUBLIC_ACCOUNTS_ENABLED`.

## Review Focus

1. **Leitores de link do Outlook/Gmail abrem o link do email antes da pessoa.** O link precisa continuar válido até a pessoa clicar em "Entrar": o email aponta para a página `/entrar/confirmar?token=…`, que só consome o token num `POST`. (Teste na Task 4.)
2. **Mesmo email escrito diferente** (`Joao@Mail.com ` vs `joao@mail.com`) é a mesma conta e o mesmo limite. (Teste na Task 4.)
3. **Cron executado duas vezes no mesmo dia** (retentativa da Vercel) não manda o mesmo jogo de novo. (Teste na Task 6.)
4. **ITAD falha no meio da tarefa:** jogos sem preço nesta execução não mudam de estado (não "terminam" a promoção nem são avisados). (Teste na Task 6.)
5. **Link de sair dos emails adulterado** (`u` trocado ou `sig` errada) não altera ninguém. (Teste na Task 3.)

---

## Mapa de arquivos

- `server/db/schema.ts` — tabelas Drizzle.
- `server/db/migrations/` — gerado pelo drizzle-kit (commitado).
- `drizzle.config.ts` — config do drizzle-kit.
- `server/utils/db.ts` — `useDb()` e tipo `Db`.
- `server/utils/accounts-flag.ts` — `requireAccountsEnabled(event)`.
- `server/utils/alerts.ts` — `pickBestPrice`, `decideAlert` (puros).
- `server/utils/email.ts` — renderização dos emails, `sendEmail`, quota.
- `server/utils/unsubscribe.ts` — assinatura do link de sair.
- `server/utils/auth.ts` — tokens de login, limites, `normalizeEmail`, `findOrCreateUser`.
- `server/utils/account.ts` — favoritos e conta no banco, `mergeFavoriteLists`.
- `server/utils/daily-alerts.ts` — `runDailyAlerts`.
- `server/api/auth/*`, `server/api/account/*`, `server/api/favorites/*`, `server/api/alerts/*`, `server/api/cron/daily-alerts.get.ts` — rotas finas.
- `vercel.json` — cron.
- `app/pages/entrar/index.vue`, `app/pages/entrar/confirmar.vue`, `app/pages/conta.vue`, `app/pages/privacidade.vue`, `app/pages/alertas/sair.vue`.
- `app/composables/useAccount.ts` — sessão + sincronização de favoritos.
- `app/stores/games.ts`, `app/app.vue`, `app/pages/favoritos.vue` — integração.
- `tests/unit/helpers/test-db.ts` — `createTestDb()`.

---

### Task 1: Banco, configuração e base

**Files:**
- Create: `server/db/schema.ts`, `drizzle.config.ts`, `server/db/migrations/*` (gerado), `server/utils/db.ts`, `server/utils/accounts-flag.ts`, `tests/unit/helpers/test-db.ts`, `tests/unit/db.spec.ts`
- Modify: `package.json`, `nuxt.config.ts`, `.env.example`, `.gitignore` (`.data/`)

**Interfaces:**
- Produces:
  - `type Db = PgDatabase<PgQueryResultHKT, typeof schema>` e `useDb(): Db` (Neon HTTP se `DATABASE_URL` existir; senão PGlite em `.data/pglite`; em produção sem `DATABASE_URL` lança erro 503). PGlite carregado por `import()` dinâmico, só nesse caso, para não pesar no bundle da Vercel.
  - `createTestDb(): Promise<Db>` (PGlite em memória com as migrações aplicadas via `drizzle-orm/pglite/migrator`).
  - `requireAccountsEnabled(event: H3Event): void` (lança 404 se desligada).
  - Tabelas (nomes do TS / SQL):
    - `users` — `id uuid pk default random`, `email text unique not null`, `alertsEnabled boolean default true`, `createdAt timestamptz default now`.
    - `loginTokens` / `login_tokens` — `tokenHash text pk`, `email text`, `ipHash text`, `expiresAt timestamptz`, `usedAt timestamptz null`, `createdAt`.
    - `favorites` — `userId uuid fk users on delete cascade`, `gameId text`, `slug`, `title`, `image text`, `addedAt timestamptz`, `notifiedPrice numeric(10,2) null`, `baselinePending boolean default true`; pk `(userId, gameId)`.
    - `priceSnapshots` / `price_snapshots` — `gameId text`, `day date`, `price numeric(10,2)`, `regular numeric(10,2)`, `cut integer`, `shop text`, `historyLow numeric(10,2) null`; pk `(gameId, day)`.
    - `emailSends` / `email_sends` — `id serial pk`, `kind text ('login'|'alert')`, `sentAt timestamptz default now`.

- [ ] **Step 1: Instalar dependências**

`yarn add drizzle-orm @neondatabase/serverless @electric-sql/pglite nuxt-auth-utils` e `yarn add -D drizzle-kit`. Adicionar `nuxt-auth-utils` em `modules`.

- [ ] **Step 2: Teste que falha**

```ts
// tests/unit/db.spec.ts
it('migrações criam as tabelas e o email é único', async () => {
  const db = await createTestDb()
  await db.insert(users).values({ email: 'a@b.com' })
  await expect(db.insert(users).values({ email: 'a@b.com' })).rejects.toThrow()
  const [user] = await db.select().from(users)
  expect(user.alertsEnabled).toBe(true)
})
```

Run: `yarn vitest run tests/unit/db.spec.ts` — Expected: FAIL (módulos não existem).

- [ ] **Step 3: Implementar schema, `drizzle.config.ts` (dialect `postgresql`, schema `server/db/schema.ts`, out `server/db/migrations`), gerar migração (`yarn drizzle-kit generate`), `useDb`, `createTestDb`, `requireAccountsEnabled`**

`nuxt.config.ts`: `runtimeConfig` ganha `databaseUrl`, `resendApiKey`, `emailFrom` (padrão `'GameDeals BR <onboarding@resend.dev>'`), `cronSecret`, `session: { maxAge: 60 * 60 * 24 * 30 }`, e `public.accountsEnabled: process.env.NUXT_PUBLIC_ACCOUNTS_ENABLED === 'true'`. Script `"db:generate": "drizzle-kit generate"` e `"db:migrate": "drizzle-kit migrate"`.

- [ ] **Step 4: Rodar** `yarn vitest run tests/unit/db.spec.ts` — Expected: PASS. `yarn test` e `yarn lint` — Expected: tudo verde.

- [ ] **Step 5: Commit** `feat: banco de dados (Drizzle) e configuração das contas`

---

### Task 2: Regras de preço e de alerta (puras)

**Files:**
- Create: `server/utils/alerts.ts`, `tests/unit/alerts.spec.ts`

**Interfaces:**
- Produces:
  - `type BestPrice = { gameId: string; price: number; regular: number; cut: number; shop: string; historyLow: number | null; isHistoryLow: boolean }`
  - `pickBestPrice(entry: unknown): BestPrice | null` — entrada é um item da resposta de `/games/prices/v3` (`{ id, historyLow: { all: { amount } }, deals: [{ shop: { name }, price: { amount }, regular: { amount }, cut }] }`). `null` sem `deals`. `isHistoryLow = historyLow !== null && price <= historyLow`.
  - `type AlertState = { notifiedPrice: number | null; baselinePending: boolean }`
  - `decideAlert(state: AlertState, best: BestPrice | null): { notify: boolean; next: AlertState }`

- [ ] **Step 1: Testes que falham** (`tests/unit/alerts.spec.ts`)

`pickBestPrice`: escolhe o deal mais barato (dois deals, R$ 50 com cut 50 e R$ 40 com cut 60 → price 40, shop da segunda, cut 60); `historyLow.all.amount = 40` → `isHistoryLow: true`; sem deals → `null`; lixo (`null`, `{}`) → `null`.

`decideAlert` — tabela, cada linha um `it`:

| state | best | notify | next |
|---|---|---|---|
| `{null, false}` | `null` | false | igual ao state |
| `{89.9, false}` | cut 0 | false | `{null, false}` |
| `{null, true}` | cut 50, 40 | false | `{40, false}` |
| `{null, true}` | cut 0 | false | `{null, false}` |
| `{null, false}` | cut 50, 40 | **true** | `{40, false}` |
| `{40, false}` | cut 50, 40 | false | `{40, false}` |
| `{40, false}` | cut 70, 30 | **true** | `{30, false}` |
| `{40, false}` | cut 40, 45 | false | `{40, false}` |

Run: `yarn vitest run tests/unit/alerts.spec.ts` — Expected: FAIL.

- [ ] **Step 2: Implementar** — `baselinePending` cobre os três casos de "promoção já em andamento conta como avisada" (favorito novo, merge no login, primeira execução): todo favorito nasce com `baselinePending = true` e a primeira leitura de preço só registra.

- [ ] **Step 3: Rodar** — Expected: PASS.

- [ ] **Step 4: Commit** `feat: regras de promoção e de alerta`

---

### Task 3: Emails, quota e link de sair

**Files:**
- Create: `server/utils/email.ts`, `server/utils/unsubscribe.ts`, `tests/unit/email.spec.ts`, `tests/unit/unsubscribe.spec.ts`

**Interfaces:**
- Consumes: `BestPrice` (Task 2), `Db`, `emailSends` (Task 1).
- Produces:
  - `type EmailMessage = { to: string; subject: string; html: string; text: string; headers?: Record<string, string> }`
  - `renderLoginEmail(input: { link: string; siteUrl: string }): Omit<EmailMessage, 'to'>`
  - `renderAlertEmail(input: { games: Array<BestPrice & { title: string; slug: string; image: string }>; siteUrl: string; unsubscribeUrl: string }): Omit<EmailMessage, 'to'>`
  - `type SendEmail = (message: EmailMessage) => Promise<void>`
  - `createSendEmail(config: { apiKey: string; from: string }): SendEmail` — `$fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer …' }, body: { from, to, subject, html, text, headers } })`; sem `apiKey`, só `console.info` com destinatário mascarado.
  - `countEmailsToday(db: Db, now: Date): Promise<number>` e `recordEmail(db: Db, kind: 'login' | 'alert'): Promise<void>`
  - `EMAIL_DAILY_LIMIT = 100`, `ALERT_SEND_CEILING = 80`
  - `signUnsubscribe(userId: string, secret: string): string` (HMAC-SHA256 hex) e `verifyUnsubscribe(userId: string, sig: string, secret: string): boolean` (comparação em tempo constante). `secret` = `NUXT_SESSION_PASSWORD`.
  - `buildUnsubscribeUrls(siteUrl: string, userId: string, secret: string): { page: string; oneClick: string }` → `${siteUrl}/alertas/sair?u=…&sig=…` e `${siteUrl}/api/alerts/unsubscribe?u=…&sig=…`

- [ ] **Step 1: Testes que falham**

- `renderAlertEmail` com 1 jogo: `subject === 'Elden Ring entrou em promoção'`; com 3: `subject === '3 jogos da sua lista entraram em promoção'`; html e text contêm `R$ 40,00` (formato `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`, com espaço normalizado), `-60%`, o nome da loja, `${siteUrl}/game/elden-ring` e `unsubscribeUrl`; jogo com `isHistoryLow` mostra `Menor preço da história`.
- `renderLoginEmail`: `subject === 'Seu link para entrar no GameDeals BR'`; contém o link, `15 minutos` e o aviso `os alertas de promoção dos seus favoritos vêm ligados`.
- `countEmailsToday` com PGlite: 2 envios hoje e 1 ontem (UTC) → 2.
- `verifyUnsubscribe`: assinatura certa → true; `u` trocado → false; `sig` com tamanho diferente → false (sem lançar).

Run: `yarn vitest run tests/unit/email.spec.ts tests/unit/unsubscribe.spec.ts` — Expected: FAIL.

- [ ] **Step 2: Implementar.** HTML com tabelas e estilos inline (Gmail/Outlook), fundo escuro do site, um botão por jogo para a página do jogo no site (nunca link da ITAD). Rodapé com "Parar de receber estes emails" e menção à ITAD como fonte dos preços.

- [ ] **Step 3: Rodar** — Expected: PASS.

- [ ] **Step 4: Commit** `feat: emails de login e de promoção`

---

### Task 4: Login por link

**Files:**
- Create: `server/utils/auth.ts`, `server/api/auth/request-link.post.ts`, `server/api/auth/verify.post.ts`, `server/api/auth/logout.post.ts`, `tests/unit/auth.spec.ts`

**Interfaces:**
- Consumes: `Db`, tabelas (Task 1); `renderLoginEmail`, `createSendEmail`, `countEmailsToday`, `recordEmail`, `EMAIL_DAILY_LIMIT` (Task 3); `requireAccountsEnabled`.
- Produces:
  - `normalizeEmail(raw: unknown): string | null` (formato `^[^\s@]+@[^\s@]+\.[^\s@]+$`, até 254 caracteres)
  - `hashValue(value: string): string` (SHA-256 hex)
  - `LOGIN_TOKEN_TTL_MS = 15 * 60_000`, `LOGIN_LIMIT_PER_EMAIL = 3`, `LOGIN_LIMIT_PER_IP = 10`, `LOGIN_LIMIT_WINDOW_MS = 15 * 60_000`
  - `requestLoginLink(db: Db, input: { email: string; ip: string; now: Date }): Promise<{ token: string } | { limited: true }>`
  - `consumeLoginToken(db: Db, token: string, now: Date): Promise<string | null>` (devolve o email; marca `usedAt`; expirado/usado/inexistente → `null`)
  - `findOrCreateUser(db: Db, email: string): Promise<{ id: string; email: string; created: boolean }>`
  - Sessão: `setUserSession(event, { user: { id, email } })`
- Rotas:
  - `POST /api/auth/request-link` `{ email }` → 400 se formato inválido; senão sempre `{ ok: true }`. Envia o email só se não limitado e `countEmailsToday < EMAIL_DAILY_LIMIT`. Link: `${siteUrl}/entrar/confirmar?token=…`.
  - `POST /api/auth/verify` `{ token }` → `{ ok: true, created }` com sessão criada, ou 400 `Link inválido ou expirado`.
  - `POST /api/auth/logout` → `clearUserSession`.

- [ ] **Step 1: Testes que falham** (PGlite)

- `normalizeEmail(' Joao@Mail.com ')` → `'joao@mail.com'`; `'sem-arroba'` → `null`.
- token válido é consumido uma vez: segundo `consumeLoginToken` → `null`.
- token após 15 min e 1 s → `null`.
- **Review Focus 1:** `requestLoginLink` não consome nada e o token continua válido até `consumeLoginToken` (nenhuma função de leitura/GET consome).
- **Review Focus 2:** 3 pedidos com `'Joao@Mail.com'`/`'joao@mail.com '` → o 4º com `'JOAO@mail.com'` → `{ limited: true }`; 11º pedido do mesmo IP com emails diferentes → `{ limited: true }`; pedidos com mais de 15 min não contam.
- `findOrCreateUser` duas vezes com o mesmo email → mesmo `id`, `created` true depois false.
- token guardado não é o token em texto (`tokenHash !== token`).

Run: `yarn vitest run tests/unit/auth.spec.ts` — Expected: FAIL.

- [ ] **Step 2: Implementar** utils e rotas (cada rota começa com `requireAccountsEnabled(event)`; IP via `getRequestIP(event, { xForwardedFor: true })`, guardado como hash).

- [ ] **Step 3: Rodar** — Expected: PASS; `yarn lint` limpo.

- [ ] **Step 4: Commit** `feat: login por link no email`

---

### Task 5: Conta e favoritos no servidor

**Files:**
- Create: `server/utils/account.ts`, `server/api/account/index.get.ts`, `server/api/account/index.patch.ts`, `server/api/account/index.delete.ts`, `server/api/favorites/index.get.ts`, `server/api/favorites/merge.post.ts`, `server/api/favorites/[id].put.ts`, `server/api/favorites/[id].delete.ts`, `server/api/alerts/unsubscribe.post.ts`, `tests/unit/account.spec.ts`

**Interfaces:**
- Consumes: `Db`, tabelas; `FavoriteGame`, `MAX_FAVORITES` (de `app/utils/favorites.ts`, importados por caminho relativo como o servidor já faz com `catalog.ts`); `verifyUnsubscribe` (Task 3); `isGameId` (`server/utils/itad.ts`).
- Produces:
  - `mergeFavoriteLists(account: FavoriteGame[], browser: FavoriteGame[], max: number): FavoriteGame[]` — conta primeiro (ordem dela), depois do navegador os ausentes, mais recentes primeiro (`addedAt` desc), corta em `max`.
  - `listFavorites(db, userId): Promise<FavoriteGame[]>`
  - `addFavorite(db, userId, game: FavoriteInput): Promise<'added' | 'exists' | 'limit'>`
  - `removeFavorite(db, userId, gameId): Promise<void>`
  - `mergeBrowserFavorites(db, userId, browser: FavoriteGame[]): Promise<FavoriteGame[]>` (insere só os novos, `onConflictDoNothing`, novos com `baselinePending = true`; devolve a lista final)
  - `setAlertsEnabled(db, userId, enabled: boolean): Promise<void>`, `deleteUser(db, userId): Promise<void>` (cascade apaga favoritos)
- Rotas (todas com `requireAccountsEnabled` e, exceto unsubscribe, `requireUserSession`):
  - `GET /api/account` → `{ email, alertsEnabled }`; `PATCH` `{ alertsEnabled: boolean }`; `DELETE` → apaga e `clearUserSession`.
  - `GET /api/favorites` → `FavoriteGame[]`; `POST /api/favorites/merge` `{ items }` (valida cada item: `isGameId`, strings, máx. 50) → lista final; `PUT /api/favorites/:id` `{ slug, title, image }` → `{ result }`; `DELETE /api/favorites/:id`.
  - `POST /api/alerts/unsubscribe?u=&sig=` → 400 se assinatura inválida; senão `setAlertsEnabled(false)` e `{ ok: true }` (aceita o corpo `List-Unsubscribe=One-Click`).

- [ ] **Step 1: Testes que falham** (PGlite)

- `mergeFavoriteLists`: conta com 49 + navegador com 3 novos (datas diferentes) → 50, entra o mais recente; duplicado entre as listas aparece uma vez com os dados da conta.
- `addFavorite` no 51º → `'limit'`; repetido → `'exists'`.
- `mergeBrowserFavorites` duas vezes com a mesma lista → sem duplicar; novos têm `baselinePending: true`.
- `deleteUser` → favoritos do usuário somem; de outro usuário ficam.
- **Review Focus 5:** handler de unsubscribe chamado com `sig` de outro usuário → 400 e `alertsEnabled` continua `true` (testar a função `unsubscribeWithSignature(db, u, sig, secret): Promise<boolean>` exportada de `account.ts`, usada pela rota).

Run: `yarn vitest run tests/unit/account.spec.ts` — Expected: FAIL.

- [ ] **Step 2: Implementar.**

- [ ] **Step 3: Rodar** — Expected: PASS; `yarn lint` limpo.

- [ ] **Step 4: Commit** `feat: conta e favoritos no servidor`

---

### Task 6: Tarefa diária

**Files:**
- Create: `server/utils/daily-alerts.ts`, `server/api/cron/daily-alerts.get.ts`, `vercel.json`, `tests/unit/daily-alerts.spec.ts`

**Interfaces:**
- Consumes: `pickBestPrice`, `decideAlert` (Task 2); `renderAlertEmail`, `SendEmail`, `countEmailsToday`, `recordEmail`, `ALERT_SEND_CEILING`, `buildUnsubscribeUrls` (Task 3); tabelas (Task 1).
- Produces:
  - `type FetchPrices = (gameIds: string[]) => Promise<unknown[]>` (itens crus de `/games/prices/v3`)
  - `PRICE_BATCH_SIZE = 200`
  - `runDailyAlerts(deps: { db: Db; fetchPrices: FetchPrices; sendEmail: SendEmail; now: Date; siteUrl: string; secret: string }): Promise<{ games: number; emails: number; deferred: number }>`
- Algoritmo (a ordem importa):
  1. Ids únicos de todos os favoritos; buscar preços em lotes de 200. Lote que falhar: seus jogos ficam sem preço nesta execução (não lança).
  2. Upsert de `price_snapshots` para `day = now (UTC)` de cada jogo com preço.
  3. Para cada favorito com preço: `decideAlert`. Se `notify` é false, grava `next` já. Se `notify` é true, guarda como pendente do usuário (não grava ainda).
  4. Para cada usuário com `alertsEnabled` e pendentes, em ordem de `createdAt`: se `countEmailsToday >= ALERT_SEND_CEILING`, conta como `deferred` e não grava nada (amanhã a decisão se repete). Senão envia um email com todos os pendentes, `recordEmail('alert')`, e só então grava os `next`. Falha no envio: não grava, segue para o próximo.
  5. Usuário com alertas desligados: pendentes são gravados sem email (a promoção conta como vista, para não chegar tudo junto quando religar).
- Rota: `requireAccountsEnabled` desligada → `{ skipped: true }`; `Authorization` diferente de `Bearer ${cronSecret}` (ou `cronSecret` vazio) → 401; senão `runDailyAlerts` com `fetchPrices` = `itadFetch('/games/prices/v3', { method: 'POST', params: { country: ITAD_COUNTRY, deals: false, vouchers: true }, body: ids })` — como `server/api/games/prices.get.ts`, mas **sem `capacity`**, para virem todas as lojas de cada jogo.
- `vercel.json`: `{ "crons": [{ "path": "/api/cron/daily-alerts", "schedule": "0 12 * * *" }] }`.

- [ ] **Step 1: Testes que falham** (PGlite, `fetchPrices` e `sendEmail` falsos)

- primeira execução com jogo em promoção → 0 emails, estado `{40, false}`.
- segunda execução (preço igual) → 0 emails; terceira com preço 30 → 1 email com o jogo.
- promoção acaba (cut 0) e volta → email de novo.
- dois jogos de um usuário entram em promoção no mesmo dia → **1 email** com os dois.
- **Review Focus 3:** rodar duas vezes no mesmo dia depois de uma promoção nova → 1 email no total.
- **Review Focus 4:** `fetchPrices` lança para o lote → nenhum estado muda, nenhum email, sem exceção.
- quota: `email_sends` com 80 registros hoje → `deferred: 1`, nenhum email, estado não gravado; no dia seguinte (quota zerada) → email enviado.
- `sendEmail` lança → estado não gravado (o jogo é avisado na próxima execução).
- usuário com alertas desligados → sem email, estado gravado.
- snapshot gravado uma vez por jogo por dia (duas execuções → 1 linha).
- email enviado contém o link de sair do próprio usuário (`buildUnsubscribeUrls`) e o cabeçalho `List-Unsubscribe` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click`.

Run: `yarn vitest run tests/unit/daily-alerts.spec.ts` — Expected: FAIL.

- [ ] **Step 2: Implementar** `runDailyAlerts`, a rota e `vercel.json`.

- [ ] **Step 3: Rodar** — Expected: PASS. `yarn test`, `yarn lint` limpos.

- [ ] **Step 4: Commit** `feat: tarefa diária de alertas`

---

### Task 7: Telas e sincronização dos favoritos

**Files:**
- Create: `app/composables/useAccount.ts`, `app/pages/entrar/index.vue`, `app/pages/entrar/confirmar.vue`, `app/pages/conta.vue`, `app/pages/privacidade.vue`, `app/pages/alertas/sair.vue`, `tests/unit/account-sync.spec.ts`
- Modify: `app/stores/games.ts`, `app/app.vue`, `app/pages/favoritos.vue`, `nuxt.config.ts` (`sitemap.exclude` + `/entrar/**`, `/conta`, `/alertas/**`), `server/routes/robots.txt.ts` (Disallow `/conta`, `/entrar`)

**Interfaces:**
- Consumes: rotas das Tasks 4 e 5; `useUserSession()` do `nuxt-auth-utils`.
- Produces:
  - Store: `replaceFavorites(items: FavoriteGame[]): void` e `clearFavorites(): void`; `toggleFavorite` continua síncrono e devolve o mesmo `ToggleResult`.
  - `useAccount()` → `{ enabled: boolean; loggedIn: Ref<boolean>; email: ComputedRef<string | null>; logout(): Promise<void>; syncAfterLogin(): Promise<void> }`
  - `planFavoriteSync(action: 'added' | 'removed', gameId: string): { method: 'PUT' | 'DELETE'; url: string }` (puro, exportado para teste).
- Comportamento:
  - Ao montar o app logado (e logo após `verify`): `POST /api/favorites/merge` com os favoritos do navegador → `replaceFavorites(resposta)`.
  - Logado, cada `toggleFavorite` dispara `PUT`/`DELETE` em segundo plano; erro → toast `color: 'error'` "Não foi possível salvar na sua conta" e desfaz a mudança local.
  - `logout()`: `POST /api/auth/logout`, `clearFavorites()` (apaga a cópia do navegador), sessão limpa, vai para `/`.
  - Cabeçalho (`app.vue`): com `enabled`, link "Entrar" (deslogado) ou "Minha conta" (logado) ao lado de Favoritos, mesmo estilo dos links atuais; sem `enabled`, nada muda.
  - `/entrar`: campo de email (`UInput class="w-full"`), botão "Receber link"; depois mostra "Se o email for válido, enviamos um link. Ele vale por 15 minutos." Link para `/privacidade`.
  - `/entrar/confirmar?token=`: botão "Entrar" que faz o `POST /api/auth/verify`; erro → "Este link expirou ou já foi usado" + link para `/entrar`. Nunca consome o token sozinho.
  - `/conta`: email, interruptor "Avisar por email quando meus favoritos entrarem em promoção" (`PATCH`), "Sair", "Excluir minha conta" (confirmação, `DELETE`, depois `clearFavorites` e `/`).
  - `/alertas/sair?u=&sig=`: ao montar (só no cliente) faz o `POST /api/alerts/unsubscribe`; mostra "Pronto, você não vai mais receber alertas." ou "Link inválido".
  - `/favoritos`: com `enabled` e deslogado, um aviso discreto "Receba um email quando seus favoritos entrarem em promoção" com botão "Entrar".
  - `/privacidade`: o que guardamos (email, favoritos, estado dos alertas, preços diários), para quê (login e alertas), por quanto tempo (até excluir a conta), como excluir (`/conta`), e que preços vêm da IsThereAnyDeal. Link no rodapé só com `enabled`.
  - Páginas `/entrar`, `/conta`, `/alertas/sair` com `robots: noindex`; todas as páginas novas respondem 404 quando `enabled` é false.

- [ ] **Step 1: Teste que falha** (`tests/unit/account-sync.spec.ts`): `planFavoriteSync('added', id)` → `{ method: 'PUT', url: '/api/favorites/<id>' }`; `'removed'` → `DELETE`; mais um guarda estático: com `accountsEnabled` falso no `nuxt.config.ts` por padrão (`process.env.NUXT_PUBLIC_ACCOUNTS_ENABLED === 'true'` presente no arquivo).

Run: `yarn vitest run tests/unit/account-sync.spec.ts` — Expected: FAIL.

- [ ] **Step 2: Implementar** composable, store, páginas e integração.

- [ ] **Step 3: Rodar** `yarn test`, `yarn lint`, `yarn build` — Expected: verdes.

- [ ] **Step 4: Verificação no navegador** (build local, Brave headless, PGlite local, sem `RESEND_API_KEY`):
  - Com a configuração desligada: home, favoritos e cabeçalho idênticos aos screenshots de `main` (1280 e 390); `/entrar` → 404; `GET /api/cron/daily-alerts` → `{ skipped: true }`.
  - Ligada: pedir link → link aparece no log → abrir `/entrar/confirmar` → "Entrar" → logado; favoritos do navegador aparecem na conta; adicionar/remover reflete em `GET /api/favorites`; sair → favoritos do navegador vazios; entrar de novo → voltam da conta; `/conta` desliga alertas; excluir conta funciona.
  - Rodar a tarefa com `CRON_SECRET` local duas vezes: segunda não gera email.

- [ ] **Step 5: Commit** `feat: telas de conta e alertas`

---

### Task 8: Preview e PR

- [ ] **Step 1:** `NUXT_SESSION_PASSWORD` (32+ caracteres aleatórios) e `CRON_SECRET` criados na Vercel (Production e Preview) pelo MCP, sem imprimir valores. `NUXT_PUBLIC_ACCOUNTS_ENABLED` **não** é criada (fica desligada).
- [ ] **Step 2:** Push; preview da Vercel `READY`; conferir no preview que `/`, `/favoritos` e `/api/home` respondem 200 e `/entrar` 404 (desligado).
- [ ] **Step 3:** PR para `main` com: o que faz, como ligar (criar banco Neon pela Vercel → `DATABASE_URL`; `yarn db:migrate`; conta Resend → `RESEND_API_KEY`; domínio verificado → `EMAIL_FROM`, `NUXT_PUBLIC_SITE_URL`; `NUXT_PUBLIC_ACCOUNTS_ENABLED=true`), e o lembrete de comprar o domínio. Merge fica com o autor.
