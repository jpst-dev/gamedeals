# Redesign estilo loja + filtros + favoritos + SEO — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar a home em vitrine estilo loja, criar o catálogo `/ofertas` com filtros fluidos, refazer a área de compra da página do jogo, adicionar `/favoritos` e SEO.

**Architecture:** O servidor Nitro concentra a lógica de consulta à ITAD em funções puras (`server/utils/deals.ts`, `server/utils/home.ts`) testadas com um `fetcher` falso; as rotas só validam e chamam essas funções. O estado do catálogo vive na URL e é convertido por funções puras em `utils/catalog.ts` (compartilhado entre app e servidor). Componentes novos usam Tailwind puro; a lógica testável (encaixe de capa, ranking de ofertas, favoritos, JSON-LD) fica em `utils/*.ts`.

**Tech Stack:** Nuxt 3.21, Vue 3, Nuxt UI 2.22 (só o que já existe), Tailwind 3.4, Swiper 12, Vitest 4, `@nuxtjs/sitemap` (nova).

**Spec:** `docs/superpowers/specs/2026-10-24-redesign-loja-seo-design.md`

## Global Constraints

- Branch `feature/redesign-loja`; um PR para `main` com **um commit por parte**: 1. capa+cards+home, 2. catálogo/filtros, 3. página do jogo, 4. favoritos, 5. SEO. Só a última task de cada parte faz commit.
- Componentes novos em Tailwind puro + Vue. Não usar `UTable`, `UBadge`, `UCheckbox`, `USelect`, `UButton`, `USkeleton`, `UInput` em componentes novos. Permitidos: `UContainer`, `UIcon`, `useToast`/`UNotifications`.
- Sem novas dependências de UI. Prateleiras com CSS scroll-snap; Swiper só na galeria existente e no carrossel do destaque. Única dependência nova: `@nuxtjs/sitemap`.
- Toda chamada à ITAD passa por `server/utils/itad.ts` (`itadFetch`), rotas com `defineCachedEventHandler` + `swr: true`.
- Textos e `aria-label` em pt-BR com acentuação. Moeda via `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`.
- Layout funciona de 360 px a desktop. Breakpoint do painel de filtros móvel: `< 640px` (`sm`).
- Destaque de cor: `#66c0f4`; tema escuro atual (`bg-gray-950`).
- Filtros ITAD verificados: `filter={"price":{"min":n,"max":n}}` exige **min e max**; `{"flag":"H"}`; `{"cut":{"min":n,"max":null}}`; `shops=61,35`. Filtro de tipo na ITAD dá 500 → filtrar no nosso servidor. `sort=expiry` devolve vencidas primeiro → descartar no nosso servidor.
- Comandos: `yarn test`, `yarn lint` (typecheck), `yarn build`. `ITAD_API_KEY` está no `.env` local para testes manuais.
- Toda mensagem de commit termina com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Resposta da ITAD com campos faltando** (sem `assets`, `deal.price`, `type: null`, `expiry` inválida): prateleiras e cards não quebram; item sem tipo é descartado; capa gerada aparece. → testes em Task 2 e Task 3.
2. **Falha parcial da ITAD na home** (uma prateleira rejeita, `/games/info` falha ou nenhum candidato tem `appid`): a home responde com o que deu certo; hero vazio é omitido. → teste em Task 3.
3. **URL de catálogo malformada** (`?preco=abc&lojas=x,,61&desconto=33&ordem=foo&tipo=zzz`): cai em padrões seguros, sem 500. → testes em Task 2 e Task 5.
4. **`localStorage` de favoritos corrompido, legado (só ids) ou com mais de 50 itens**: carrega sem erro, migra, corta em 50. → teste em Task 8.
5. **Jogo sem ofertas, ofertas empatadas ou com preço inválido**: caixa de compra mostra estado vazio; diferenças não viram `NaN`; empate não marca dois "melhor preço". → teste em Task 7.

---

## Parte 1 — Capa, cards e home

### Task 1: Encaixe de capa (`GameCover`) e cards

**Files:**
- Create: `utils/cover.ts`, `components/GameCover.vue`, `tests/unit/cover.spec.ts`
- Modify: `composables/useGamesApi.ts` (tipo `Game`, `normalizeDealGame`, `normalizeGame`), `components/GameCard.vue`

**Interfaces:**
- Produces:
  - `getCoverFit(width: number, height: number, targetRatio = 2 / 3, tolerance = 0.12): 'cover' | 'contain'`
  - `hueFromString(text: string): number` (0–359, determinística)
  - `steamAsset(appid: number, file: 'library_hero.jpg' | 'library_600x900.jpg' | 'header.jpg'): string` → `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appid}/${file}`
  - `Game` ganha `images: string[]` (ordem: `boxart`, `banner600`, `banner400`, `banner300`, sem vazios) e `historyLowFlag?: 'H' | 'N' | 'S'`; `image` continua = `images[0] ?? ''`.
  - `export const normalizeDealGame` (passa a ser exportada).
  - `<GameCover :sources="string[]" :title="string" :ratio?="number" :eager?="boolean" :fit?="'auto' | 'cover'" />`

- [ ] **Step 1: Write the failing tests** em `tests/unit/cover.spec.ts`

```ts
it('uses cover when image matches the 2:3 frame within 12%', () => {
  expect(getCoverFit(300, 450)).toBe('cover')
  expect(getCoverFit(600, 900)).toBe('cover')
  expect(getCoverFit(320, 450)).toBe('cover') // 0.711 vs 0.667 → 6.7%
})
it('uses contain for landscape banners', () => {
  expect(getCoverFit(460, 215)).toBe('contain')
  expect(getCoverFit(600, 350)).toBe('contain')
})
it('falls back to cover on invalid dimensions', () => {
  expect(getCoverFit(0, 0)).toBe('cover')
  expect(getCoverFit(Number.NaN, 450)).toBe('cover')
})
it('derives a stable hue from text', () => {
  expect(hueFromString('Hades')).toBe(hueFromString('Hades'))
  expect(hueFromString('Hades')).toBeGreaterThanOrEqual(0)
  expect(hueFromString('Hades')).toBeLessThan(360)
})
it('builds steam asset urls', () => {
  expect(steamAsset(1086940, 'library_hero.jpg'))
    .toBe('https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/1086940/library_hero.jpg')
})
```

Em `tests/unit/useGamesApi.spec.ts`, adicionar:

```ts
it('normalizes deal images and history-low flag', async () => {
  const { normalizeDealGame } = await loadModule()
  const game = normalizeDealGame({ id: 'g', title: 'G', type: 'game',
    assets: { banner300: 'b300', boxart: 'box', banner600: '' },
    deal: { price: { amount: 10 }, flag: 'H' } }, 0)
  expect(game?.images).toEqual(['box', 'b300'])
  expect(game?.image).toBe('box')
  expect(game?.historyLowFlag).toBe('H')
})
it('drops deals without a game type', async () => {
  const { normalizeDealGame } = await loadModule()
  expect(normalizeDealGame({ id: 'x', title: 'X', type: null, deal: {} }, 0)).toBeNull()
})
```

- [ ] **Step 2: Run** `yarn test` — Expected: FAIL (`getCoverFit` não existe / `images` indefinido).

- [ ] **Step 3: Implement** `utils/cover.ts` e as mudanças em `useGamesApi.ts`. `historyLowFlag` só aceita `'H' | 'N' | 'S'` (qualquer outro valor → `undefined`). `normalizeGame` (busca) também preenche `images`.

- [ ] **Step 4: Implement `components/GameCover.vue`**
  - Moldura com `aspect-ratio` = `ratio` (padrão `2/3`), `overflow-hidden`, fundo `bg-gray-900`.
  - Estado: índice da fonte atual, `fit` decidido no `@load` via `getCoverFit(naturalWidth, naturalHeight, ratio)`; `fit="cover"` na prop força cover (usado no fundo do hero).
  - `contain`: mesma URL como fundo desfocado (`blur-xl brightness-50 scale-110`) + `<img>` com `object-contain` por cima.
  - `@error`: avança para a próxima fonte; sem fontes → capa gerada: `div` com gradiente `hsl(hue 45% 28%) → #111827 → hsl(hue+60 45% 22%)` usando `hueFromString(title)` e o título em texto (`font-bold`, `line-clamp-4`, centralizado).
  - `<img loading="lazy">` (ou `eager`), `alt="Capa de <título>"`, `decoding="async"`.

- [ ] **Step 5: Update `components/GameCard.vue`**
  - Trocar o `<img>` por `<GameCover :sources="game.images" :title="game.title" />` e remover `placehold.co`.
  - Botão de favoritar **sempre visível**: ícone de coração (`i-heroicons-heart` / `i-heroicons-heart-solid`) no canto superior direito, `aria-pressed`, `aria-label` "Adicionar aos favoritos"/"Remover dos favoritos"; `@click.prevent.stop`. Remover o `UButton` do bloco de hover.
  - Selo "📉 mínima" (`bg-sky-500`) quando `historyLowFlag` é `H` ou `N`; manter selo de desconto; validade "termina em Xh/Xd" visível (não só no hover) quando futura.
  - Trocar `aria-label` "Game card for…" por `"<título>, <preço>"`.
  - Emit continua `toggle-favorite` mas com payload `game: Game` (Task 8 depende disso): `(event: 'toggle-favorite', game: Game): void`.

- [ ] **Step 6: Run** `yarn test` e `yarn lint` — Expected: PASS / exit 0. (Usos de `toggle-favorite` nas páginas são ajustados nas tasks seguintes; `pages/search/index.vue` passa a chamar `gamesStore.toggleFavorite(game.id)` temporariamente via `(game) => gamesStore.toggleFavorite(game.id)` para manter o typecheck verde.)

### Task 2: Consulta de ofertas no servidor (`server/utils/deals.ts`)

**Files:**
- Create: `server/utils/deals.ts`, `tests/unit/deals.spec.ts`
- Modify: `server/utils/itad.ts` (exportar `ItadFetchOptions`; `DEAL_SORTS` ganha `'expiry'`), `server/api/deals.get.ts`

**Interfaces:**
- Consumes: `itadFetch`, `parseIntInRange`, `parseOptionalNumber`, `parseShopIds`, `parseDealSort`, `ITAD_COUNTRY` de `server/utils/itad.ts`.
- Produces:
  - `type DealKind = 'games' | 'dlcs'`
  - `type DealQuery = { sort: DealSort; limit: number; offset: number; shops: number[]; drm: number[]; minCut?: number; minPrice?: number; maxPrice?: number; historyLow: boolean; kind: DealKind }`
  - `type DealsPage = { list: unknown[]; hasMore: boolean; nextOffset: number }`
  - `type ItadFetcher = <T>(path: string, options?: ItadFetchOptions) => Promise<T>`
  - `const EXPIRING_WINDOW_MS = 7 * 86_400_000`, `const MAX_ITAD_CALLS_PER_PAGE = 3`
  - `parseDealQuery(query: Record<string, unknown>): DealQuery` — chaves: `sort`, `limit` (1–50, padrão 20), `offset` (0–5000), `shops`, `drm` (mesmo parser de ids), `minCut` (0–100), `minPrice`/`maxPrice` (0–1000), `historyLow` (`'1'` → true), `kind` (`'dlcs'` → dlcs, resto → games)
  - `buildDealsFilter(q: DealQuery): string | undefined`
  - `filterDealItems(items: unknown[], q: DealQuery, now: number): unknown[]`
  - `fetchDealsPage(q: DealQuery, fetcher: ItadFetcher = itadFetch, now = Date.now()): Promise<DealsPage>`

- [ ] **Step 1: Write the failing tests** em `tests/unit/deals.spec.ts` (mesmo padrão de globais do `itad-utils.spec.ts`)

```ts
it('sanitizes malformed query params', () => {
  const q = parseDealQuery({ sort: 'foo', limit: '999', shops: 'x,,61', minCut: 'abc', maxPrice: '-5', kind: 'zzz' })
  expect(q).toMatchObject({ sort: '-hot', limit: 50, shops: [61], minCut: undefined, maxPrice: 0, kind: 'games', historyLow: false })
})
it('builds a single ITAD filter with price min and max', () => {
  const q = parseDealQuery({ minCut: '75', maxPrice: '20', historyLow: '1', drm: '61' })
  expect(JSON.parse(buildDealsFilter(q)!)).toEqual({
    cut: { min: 75, max: null }, price: { min: 0, max: 20 }, flag: 'H', drm: [61]
  })
})
it('keeps an explicit minimum price', () => {
  const q = parseDealQuery({ minPrice: '0.01', maxPrice: '20' })
  expect(JSON.parse(buildDealsFilter(q)!).price).toEqual({ min: 0.01, max: 20 })
})
it('returns no filter when nothing is set', () => {
  expect(buildDealsFilter(parseDealQuery({}))).toBeUndefined()
})
it('filters by kind and drops expired or far expiries when sorting by expiry', () => {
  const now = Date.parse('2026-10-24T12:00:00Z')
  const items = [
    { id: 'a', type: 'game', deal: { expiry: '2026-10-25T00:00:00Z' } },
    { id: 'b', type: 'game', deal: { expiry: '2026-10-01T00:00:00Z' } }, // vencida
    { id: 'c', type: 'game', deal: { expiry: '2026-12-01T00:00:00Z' } }, // > 7 dias
    { id: 'd', type: 'dlc', deal: { expiry: '2026-10-25T00:00:00Z' } },
    { id: 'e', type: null, deal: {} },
    { id: 'f', type: 'game', deal: { expiry: 'not-a-date' } }
  ]
  expect(filterDealItems(items, parseDealQuery({ sort: 'expiry' }), now).map((i: any) => i.id)).toEqual(['a'])
  expect(filterDealItems(items, parseDealQuery({ kind: 'dlcs' }), now).map((i: any) => i.id)).toEqual(['d'])
})
it('keeps fetching until the page is full, up to 3 ITAD calls', async () => {
  const fetcher = vi.fn()
    .mockResolvedValueOnce({ list: [{ id: '1', type: 'dlc' }], hasMore: true, nextOffset: 20 })
    .mockResolvedValueOnce({ list: [{ id: '2', type: 'game' }], hasMore: true, nextOffset: 40 })
    .mockResolvedValueOnce({ list: [{ id: '3', type: 'game' }], hasMore: true, nextOffset: 60 })
  const page = await fetchDealsPage(parseDealQuery({ limit: '20' }), fetcher as any)
  expect(fetcher).toHaveBeenCalledTimes(3)
  expect(page).toEqual({ list: [{ id: '2', type: 'game' }, { id: '3', type: 'game' }], hasMore: true, nextOffset: 60 })
})
it('stops when ITAD has no more results', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce({ list: [{ id: '1', type: 'game' }], hasMore: false, nextOffset: 1 })
  const page = await fetchDealsPage(parseDealQuery({}), fetcher as any)
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(page.hasMore).toBe(false)
})
it('sends country, sort, shops and filter to /deals/v2', async () => {
  const fetcher = vi.fn().mockResolvedValue({ list: [], hasMore: false, nextOffset: 0 })
  await fetchDealsPage(parseDealQuery({ sort: '-cut', shops: '61,35', minCut: '50', offset: '40' }), fetcher as any)
  expect(fetcher).toHaveBeenCalledWith('/deals/v2', { params: expect.objectContaining({
    country: 'BR', sort: '-cut', shops: ['35', '61'], offset: 40, nondeals: false,
    filter: JSON.stringify({ cut: { min: 50, max: null } })
  }) })
})
```

- [ ] **Step 2: Run** `yarn test tests/unit/deals.spec.ts` — Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implement `server/utils/deals.ts`**
  - `buildDealsFilter`: chaves só quando definidas, nesta ordem: `cut`, `price` (`{ min: minPrice ?? 0, max: maxPrice ?? null }` quando `minPrice` ou `maxPrice` definido), `flag: 'H'`, `drm`.
  - `filterDealItems`: `games` → `type === 'game'`; `dlcs` → `type === 'dlc'`; se `sort === 'expiry'`, mantém só `expiry` parseável com `now < expiry <= now + EXPIRING_WINDOW_MS`.
  - `fetchDealsPage`: loop até `list.length >= q.limit`, `hasMore` falso, ou `MAX_ITAD_CALLS_PER_PAGE` chamadas; cada chamada pede `limit: q.limit` a partir do `nextOffset` anterior; resultado cortado em `q.limit`; devolve o último `nextOffset`/`hasMore` da ITAD.
  - Importar de `./itad` explicitamente (para o teste).

- [ ] **Step 4: Rewrite `server/api/deals.get.ts`** como `defineCachedEventHandler(event => fetchDealsPage(parseDealQuery(getQuery(event))), { maxAge: 60, swr: true, name: 'itad-deals' })`. Remover os testes antigos de `parseDealSort` que dependiam da lista anterior somente se quebrarem (a lista só ganha `'expiry'`).

- [ ] **Step 5: Run** `yarn test` — Expected: PASS.

### Task 3: Coleções e montagem da home no servidor

**Files:**
- Create: `utils/catalog.ts` (só a parte de coleções/conversão nesta task), `server/utils/home.ts`, `server/api/home.get.ts`, `tests/unit/home.spec.ts`

**Interfaces:**
- Consumes: `parseDealQuery`, `fetchDealsPage`, `ItadFetcher` (Task 2).
- Produces (em `utils/catalog.ts`, importável pelo servidor via caminho relativo `../../utils/catalog`):
  - `type CatalogOrder = 'populares' | 'desconto' | 'menor-preco' | 'maior-preco' | 'recentes' | 'titulo' | 'acabando'`
  - `type CatalogState = { ordem: CatalogOrder; lojas: number[]; ativa: number[]; desconto?: 25 | 50 | 75 | 90; preco?: number; minima: boolean; tipo: 'jogos' | 'dlcs' }`
  - `const DEFAULT_CATALOG_STATE: CatalogState` = `{ ordem: 'populares', lojas: [], ativa: [], minima: false, tipo: 'jogos' }`
  - `const ORDER_TO_ITAD_SORT: Record<CatalogOrder, string>` = populares `-hot`, desconto `-cut`, menor-preco `price`, maior-preco `-price`, recentes `-added`, titulo `title`, acabando `expiry`
  - `type DealCollection = { slug: string; title: string; description: string; state: Partial<CatalogState> }`
  - `const DEAL_COLLECTIONS: DealCollection[]` (ordem e textos exatos):
    - `menor-preco-historico` · "Menor preço da história" · "Jogos custando agora o menor preço já registrado." · `{ minima: true }`
    - `gratis` · "Grátis para resgatar" · "Jogos que estão de graça por tempo limitado." · `{ preco: 0 }`
    - `acabando` · "Acabando em breve" · "Promoções que terminam nos próximos 7 dias." · `{ ordem: 'acabando' }`
    - `75-off` · "75% ou mais de desconto" · "Os maiores descontos entre os jogos populares." · `{ desconto: 75 }`
    - `ate-20-reais` · "Até R$ 20" · "Jogos populares por até R$ 20." · `{ preco: 20 }`
  - `catalogStateToDealParams(state: CatalogState): Record<string, string | number | undefined>` → `sort`, `shops` (csv), `drm` (csv), `minCut`, `historyLow` (`'1'`), `kind` (`'dlcs'` ou omitido), e preço: `preco === 0` → `minPrice: 0, maxPrice: 0`; `preco > 0` → `minPrice: 0.01, maxPrice: preco`.
- Produces (em `server/utils/home.ts`):
  - `type HomePayload = { hero: Array<{ deal: unknown; appid: number }>; shelves: Array<{ key: string; title: string; href: string; items: unknown[] }> }`
  - `buildHome(fetcher: ItadFetcher = itadFetch, now = Date.now()): Promise<HomePayload>`
  - Prateleiras: `em-alta` ("Em alta", `/ofertas`, estado padrão) seguida das 5 coleções (`/ofertas/<slug>`), cada uma com `limit: 40`, cortada em 12.

- [ ] **Step 1: Write the failing tests** em `tests/unit/home.spec.ts`

```ts
it('maps catalog state to deal params', () => {
  expect(catalogStateToDealParams({ ...DEFAULT_CATALOG_STATE, ordem: 'acabando', lojas: [61, 35], desconto: 75, preco: 20, minima: true, tipo: 'dlcs' }))
    .toEqual({ sort: 'expiry', shops: '61,35', drm: undefined, minCut: 75, minPrice: 0.01, maxPrice: 20, historyLow: '1', kind: 'dlcs' })
  expect(catalogStateToDealParams({ ...DEFAULT_CATALOG_STATE, preco: 0 })).toMatchObject({ minPrice: 0, maxPrice: 0 })
})
it('builds shelves in order, capped at 12, skipping empty and failed ones', async () => {
  const game = (id: string) => ({ id, type: 'game', deal: { price: { amount: 1 } } })
  const fetcher = vi.fn(async (path: string, opts: any) => {
    if (path === '/games/info/v2') throw new Error('down')
    const f = opts.params.filter ? JSON.parse(opts.params.filter) : {}
    if (f.flag === 'H') throw new Error('boom')
    if (f.price?.max === 0) return { list: [], hasMore: false, nextOffset: 0 }
    return { list: Array.from({ length: 40 }, (_, i) => game(`g${i}`)), hasMore: false, nextOffset: 40 }
  })
  const home = await buildHome(fetcher as any, Date.parse('2026-10-24T12:00:00Z'))
  expect(home.shelves.map((s) => s.key)).toEqual(['em-alta', '75-off', 'ate-20-reais'])
  expect(home.shelves[0]).toMatchObject({ title: 'Em alta', href: '/ofertas' })
  expect(home.shelves[0]!.items).toHaveLength(12)
  expect(home.hero).toEqual([])
})
```
(`acabando` some porque os itens de teste não têm `expiry`.)

```ts
it('picks up to 5 hero games with a Steam appid, history lows first', async () => {
  const candidates = Array.from({ length: 10 }, (_, i) => ({ id: `c${i}`, type: 'game', deal: { price: { amount: 1 }, cut: 50, flag: i === 7 ? 'H' : undefined } }))
  const fetcher = vi.fn(async (path: string, opts: any) => {
    if (path === '/games/info/v2') return { appid: opts.params.id === 'c2' ? undefined : 100 + Number(opts.params.id.slice(1)) }
    return { list: candidates, hasMore: false, nextOffset: 10 }
  })
  const home = await buildHome(fetcher as any)
  expect(home.hero.map((h) => h.appid)).toEqual([107, 100, 101, 103, 104])
})
```

- [ ] **Step 2: Run** `yarn test tests/unit/home.spec.ts` — Expected: FAIL.

- [ ] **Step 3: Implement** `utils/catalog.ts` (parte de coleções) e `server/utils/home.ts`:
  - Prateleiras: `Promise.allSettled` de `fetchDealsPage(parseDealQuery({ ...catalogStateToDealParams(state), limit: 40 }), fetcher, now)`; rejeitada ou vazia → omitida.
  - Hero: `fetchDealsPage(parseDealQuery({ sort: '-hot', minCut: 30, limit: 20 }))`; ordenação estável com `flag` `H`/`N` primeiro; 8 primeiros; `/games/info/v2` com `params: { id }` em `Promise.allSettled`; entram os que têm `appid` inteiro > 0, na ordem dos candidatos, máx. 5. Erro no bloco do hero inteiro → `hero: []`.

- [ ] **Step 4: Create `server/api/home.get.ts`**: `defineCachedEventHandler(() => buildHome(), { maxAge: 300, swr: true, name: 'home' })`.

- [ ] **Step 5: Run** `yarn test` — Expected: PASS.

### Task 4: UI da home

**Files:**
- Create: `components/home/HeroCarousel.vue`, `components/home/DealShelf.vue`
- Modify: `composables/useGamesApi.ts` (novo `getHome`), `pages/index.vue` (reescrita), `pages/search/index.vue` (só se o typecheck exigir)

**Interfaces:**
- Consumes: `/api/home` (`HomePayload`), `normalizeDealGame`, `GameCover`, `GameCard`, `steamAsset`.
- Produces:
  - `type HeroGame = Game & { appid: number }`
  - `type HomeShelf = { key: string; title: string; href: string; games: Game[] }`
  - `getHome(): Promise<{ hero: HeroGame[]; shelves: HomeShelf[] }>` (normaliza com `normalizeDealGame`, descarta `null`)

- [ ] **Step 1: Write the failing test** em `tests/unit/useGamesApi.spec.ts`

```ts
it('normalizes the home payload', async () => {
  const fetchMock = vi.fn(async () => ({
    hero: [{ appid: 1086940, deal: { id: 'h', title: 'BG3', type: 'game', deal: { price: { amount: 139.99 } } } }],
    shelves: [{ key: 'em-alta', title: 'Em alta', href: '/ofertas', items: [{ id: 'a', title: 'A', type: 'game', deal: {} }, { id: 'p', type: 'package' }] }]
  }))
  setupComposableGlobals(fetchMock)
  const home = await (await loadApi()).getHome()
  expect(fetchMock).toHaveBeenCalledWith('/api/home')
  expect(home.hero[0]).toMatchObject({ id: 'h', appid: 1086940, price: [{ amount: 139.99 }] })
  expect(home.shelves[0]!.games.map((g) => g.id)).toEqual(['a'])
})
```

- [ ] **Step 2: Run** `yarn test` — Expected: FAIL (`getHome` inexistente). **Step 3:** implementar `getHome`. **Step 4:** `yarn test` — PASS.

- [ ] **Step 5: Implement `components/home/HeroCarousel.vue`** (prop `games: HeroGame[]`)
  - Swiper com `Autoplay` (6000 ms, `pauseOnMouseEnter: true`), `Navigation`, `Pagination` (clicável); `loop` só com ≥ 2 itens.
  - Slide: altura `h-64 sm:h-80 lg:h-[26rem]`; fundo `GameCover fit="cover"` com fontes `[steamAsset(appid,'library_hero.jpg'), steamAsset(appid,'header.jpg'), ...game.images]`; degradês `bg-gradient-to-r from-gray-950 via-gray-950/80 to-transparent` + `bg-gradient-to-t from-gray-950`.
  - Bloco de informação (texto real): capa `GameCover` (`w-24 sm:w-32`, fontes `[steamAsset(appid,'library_600x900.jpg'), ...game.images]`, primeira imagem `eager`), selo "📉 menor preço da história" quando `historyLowFlag` H/N, título `h2`, preço em verde, original riscado, `-X%`, botão "Ver ofertas" (`NuxtLink` para `/game/<slug>`).
  - `< 640px`: informação empilhada abaixo do fundo (fundo vira `h-40`).

- [ ] **Step 6: Implement `components/home/DealShelf.vue`** (prop `shelf: HomeShelf`, emits `toggle-favorite(game: Game)`, prop `isFavorite: (id: string) => boolean`)
  - Cabeçalho: `h2` com título + `NuxtLink` "Ver tudo →" para `shelf.href`.
  - Trilho: `flex overflow-x-auto snap-x snap-mandatory scroll-smooth`, itens `snap-start shrink-0 w-[42%] sm:w-[28%] md:w-[22%] lg:w-[16%]`, sem barra visível (`[scrollbar-width:none]`).
  - Setas ← → (`hidden md:flex`) rolando `trilho.clientWidth * 0.9`; desabilitar no início/fim.
  - Cada item é um `GameCard`.

- [ ] **Step 7: Rewrite `pages/index.vue`**
  - Se `route.query.sort` existir: `navigateTo({ path: '/ofertas', query: { ordem: LEGACY[sort] } }, { redirectCode: 301 })`, com `LEGACY = { 'hottest-games': 'populares', 'highest-cut': 'desconto', 'lowest-price': 'menor-preco', 'highest-price': 'maior-preco', 'newest-deal': 'recentes', 'title-asc': 'titulo' }` (desconhecido → sem `ordem`).
  - `useAsyncData('home', getHome)`; `HeroCarousel` (se houver hero) + `DealShelf` por prateleira; skeleton: bloco do hero + 3 trilhos de 6 retângulos `aspect-[2/3] animate-pulse`; erro → mensagem + link "Ver todas as ofertas" (`/ofertas`).
  - Remover todo o código antigo de filtros/grade/auto-load desta página (vai para Task 6).
  - Favoritos: por enquanto `gamesStore.toggleFavorite(game.id)` / `gamesStore.favorites.includes(id)` (Task 8 troca).

- [ ] **Step 8: Verify** `yarn test`, `yarn lint` (exit 0); `yarn dev` e abrir `/`: destaque troca sozinho, prateleiras rolam, nenhuma capa cortada ou quebrada, `/?sort=highest-cut` redireciona para `/ofertas?ordem=desconto` (a página `/ofertas` só existe na Task 6; aceitar 404 aqui).

- [ ] **Step 9: Commit (parte 1)**

```bash
git add -A
git commit -m "feat: home estilo loja com destaque, prateleiras e capas à prova de corte"
```

---

## Parte 2 — Catálogo e filtros

### Task 5: Estado do catálogo na URL

**Files:**
- Modify: `utils/catalog.ts`
- Test: `tests/unit/catalog.spec.ts`

**Interfaces:**
- Produces:
  - `parseCatalogQuery(query: Record<string, unknown>, preset?: Partial<CatalogState>): CatalogState` — preset aplicado primeiro, query sobrescreve. `desconto` só aceita 25/50/75/90; `preco` inteiro 0–1000; `ordem`/`tipo` inválidos → padrão; ids como em `parseShopIds`.
  - `catalogStateToQuery(state: CatalogState): Record<string, string>` — omite valores padrão; `lojas`/`ativa` em csv ordenado; `minima: '1'`.
  - `findCollection(slug: string): DealCollection | undefined`
  - `activeFilterTags(state: CatalogState, shopNames: Map<number, string>): Array<{ key: string; label: string; remove: Partial<CatalogState> }>` — labels: `Menor preço da história`, `Grátis` (preco 0), `Até R$ <n>`, `-<n>% ou mais`, `na <loja>` (uma por loja), `Ativa: <id ou nome>`, `Acabando` (ordem acabando), `DLCs`.

- [ ] **Step 1: Write the failing tests**

```ts
it('parses a malformed query into safe defaults', () => {
  expect(parseCatalogQuery({ preco: 'abc', lojas: 'x,,61', desconto: '33', ordem: 'foo', tipo: 'zzz', minima: 'yes' }))
    .toEqual({ ...DEFAULT_CATALOG_STATE, lojas: [61] })
})
it('applies the collection preset and lets the query override it', () => {
  expect(parseCatalogQuery({ ordem: 'titulo' }, findCollection('ate-20-reais')!.state))
    .toEqual({ ...DEFAULT_CATALOG_STATE, preco: 20, ordem: 'titulo' })
})
it('round-trips state through the URL query, omitting defaults', () => {
  const state = { ...DEFAULT_CATALOG_STATE, lojas: [61, 35], desconto: 75 as const, minima: true }
  expect(catalogStateToQuery(state)).toEqual({ lojas: '35,61', desconto: '75', minima: '1' })
  expect(parseCatalogQuery(catalogStateToQuery(state))).toEqual({ ...state, lojas: [35, 61] })
  expect(catalogStateToQuery(DEFAULT_CATALOG_STATE)).toEqual({})
})
it('lists removable filter tags', () => {
  const tags = activeFilterTags({ ...DEFAULT_CATALOG_STATE, preco: 20, lojas: [61], minima: true }, new Map([[61, 'Steam']]))
  expect(tags.map((t) => t.label)).toEqual(['Menor preço da história', 'Até R$ 20', 'na Steam'])
  expect(tags[2]!.remove).toEqual({ lojas: [] })
})
```

- [ ] **Step 2: Run** `yarn test tests/unit/catalog.spec.ts` — FAIL. **Step 3:** implementar. **Step 4:** `yarn test` — PASS.

### Task 6: Páginas e componentes do catálogo

**Files:**
- Create: `pages/ofertas/index.vue`, `pages/ofertas/[colecao].vue`, `components/catalog/CatalogPage.vue`, `components/catalog/QuickFilterBar.vue`, `components/catalog/FilterPopover.vue`, `components/catalog/ActiveFilterTags.vue`
- Modify: `composables/useGamesApi.ts` (`getDealsPage` substitui `getTopGames`; remover `TopGamesFilters`), `tests/unit/useGamesApi.spec.ts` (atualizar o teste de cache)

**Interfaces:**
- Consumes: Task 5 (`parseCatalogQuery`, `catalogStateToQuery`, `catalogStateToDealParams`, `activeFilterTags`, `findCollection`), `getShops`, `GameCard`.
- Produces:
  - `getDealsPage(state: CatalogState, offset: number, limit = 20): Promise<TopGamesPageResult>` — chama `/api/deals` com `catalogStateToDealParams(state)` + `limit` + `offset`, omitindo chaves `undefined`; cache em `useState` por chave serializada dos parâmetros. O lote seguinte usa o `nextOffset` devolvido (o servidor pode consumir mais de uma página da ITAD por lote).
  - `<CatalogPage :preset?="Partial<CatalogState>" :collection-slug?="string" />`

- [ ] **Step 1: Update the cache test** em `tests/unit/useGamesApi.spec.ts`: `getDealsPage(DEFAULT_CATALOG_STATE, 0)` duas vezes → 1 chamada a `/api/deals` com `{ query: { sort: '-hot', limit: 20, offset: 0 } }` (chaves `undefined` omitidas); `getDealsPage({ ...DEFAULT_CATALOG_STATE, lojas: [61] }, 0)` → segunda chamada com `shops: '61'`. Run `yarn test` — FAIL. Implementar `getDealsPage`. Run — PASS.

- [ ] **Step 2: `components/catalog/QuickFilterBar.vue`** (props `state: CatalogState`, `activeCount: number`; emits `update(patch: Partial<CatalogState>)`, `open-filters()`)
  - `sticky top-[<altura do header>] z-30` com fundo `bg-gray-950/90 backdrop-blur`.
  - Chips (`button`, `aria-pressed`), alternando o patch: "📉 Menor preço da história" (`minima`), "⏳ Acabando" (`ordem: 'acabando'` ↔ `'populares'`), "Até R$ 20" / "Até R$ 50" (`preco`), "-75% ou mais" (`desconto: 75`), "na Steam" (61), "na Epic" (16), "na GOG" (35) — alternam o id em `lojas`; "⚙ Filtros (n)".
  - Linha rola horizontalmente no celular (`overflow-x-auto`, sem quebra).
  - À direita, `<select>` nativo "Ordenar por" com as 7 ordens: Populares, Maior desconto, Menor preço, Maior preço, Mais recentes, Título A-Z, Acabando.
- [ ] **Step 3: `components/catalog/FilterPopover.vue`** (props `state`, `shops: Shop[]`, `open: boolean`, `anchor: HTMLElement | null`; emits `update(patch)`, `close()`, `clear()`)
  - Desktop (`≥ 640px`): balão `w-[270px]` posicionado abaixo do `anchor` (alinhado à direita), `rounded-xl border border-gray-700 bg-gray-900 shadow-xl`.
  - `< 640px`: painel fixo inferior (`inset-x-0 bottom-0 max-h-[80vh] rounded-t-2xl`) com fundo escuro atrás.
  - Fecha com clique fora, `Esc` e botão ✕; foco vai para o primeiro controle ao abrir e volta ao botão "Filtros" ao fechar; Tab fica preso dentro.
  - Seções: Preço máximo (`input type=range` 0–300 passo 10; valor 300 = "Sem limite" → `preco: undefined`; 0 = "Grátis"; emite após 400 ms parado), Desconto mínimo (chips Qualquer/25/50/75/90), Lojas (6 primeiras de `shops` + "+ N" expande), Ativa em (chips com os ids `61` Steam, `16` Epic, `35` GOG; texto de ajuda "em teste" não é exibido), Mostrar (Jogos/DLCs). Rodapé: "Limpar" e "Ver ofertas" (fecha).
- [ ] **Step 4: `components/catalog/ActiveFilterTags.vue`** (props `tags` de `activeFilterTags`; emits `remove(patch)`, `clear()`): etiquetas com ✕ (`aria-label="Remover filtro <label>"`) + "Limpar tudo"; não renderiza nada sem tags.
- [ ] **Step 5: `components/catalog/CatalogPage.vue`**
  - Estado: `computed(() => parseCatalogQuery(route.query, props.preset))`.
  - Alterar filtro: novo estado = `{ ...state, ...patch }`; se a página é uma coleção ou o patch muda algo, `navigateTo({ path: '/ofertas', query: catalogStateToQuery(novo) })` (em `/ofertas`, usar `router.replace`; numa coleção, `router.push` para `/ofertas`).
  - Título `h1`: título da coleção ou "Todas as ofertas"; descrição da coleção abaixo.
  - Dados: `useAsyncData` com chave reativa = `JSON.stringify(state)`, chamando `getDealsPage(state, 0)`; grade `GameCard` (mesmas classes de colunas da home antiga, sem a variação de filtros lateral); carregamento incremental idêntico ao antigo `pages/index.vue` (3 auto-loads com `IntersectionObserver`, botão "Carregar mais", dedupe por id, botão "Topo"), usando `nextOffset`.
  - Estados: skeleton (8 retângulos), erro, vazio ("Nenhuma oferta com esses filtros." + botão "Limpar filtros").
  - `useAsyncData('itad-shops', getShops)` para nomes de lojas.
- [ ] **Step 6: Pages**
  - `pages/ofertas/index.vue`: `<CatalogPage />`.
  - `pages/ofertas/[colecao].vue`: `findCollection(param)`; desconhecida → `throw createError({ statusCode: 404, statusMessage: 'Coleção não encontrada', fatal: true })`; senão `<CatalogPage :preset="c.state" :collection-slug="c.slug" />`.
- [ ] **Step 7: Verify** `yarn test`, `yarn lint`; com `yarn dev`: cada chip filtra o catálogo inteiro (ex.: "na Steam" → só Steam; "Até R$ 20" → preços ≤ 20), URL muda e o "voltar" do navegador restaura; `/ofertas/acabando` lista só ofertas com validade ≤ 7 dias; balão abre colado ao botão, fecha com Esc/clique fora; no DevTools em 375 px vira painel inferior; `/ofertas/xyz` → 404; `/?sort=highest-cut` → `/ofertas?ordem=desconto`.
- [ ] **Step 8: Commit (parte 2)** — `git add -A && git commit -m "feat: catálogo /ofertas com atalhos, filtros compactos e coleções"`

---

## Parte 3 — Página do jogo

### Task 7: Caixa de compra e lista de lojas

**Files:**
- Create: `utils/offers.ts`, `utils/money.ts`, `components/game/BuyBox.vue`, `components/game/ShopOfferList.vue`, `tests/unit/offers.spec.ts`
- Modify: `composables/useGamesApi.ts` (`PriceRow` ganha `shopId?: number`, `voucher?: string`), `pages/game/[id].vue`
- Delete: `components/PriceTable.vue`

**Interfaces:**
- Produces:
  - `type RankedOffer = PriceRow & { isBest: boolean; deltaFromBest: number; isHistoryLow: boolean }`
  - `rankOffers(rows: PriceRow[]): RankedOffer[]` — descarta preço não finito ou negativo; ordena por preço ascendente (estável); só o primeiro tem `isBest`; `deltaFromBest = round2(price - best)`; `isHistoryLow = historyLow > 0 && price <= historyLow`.
  - `formatBrl(value: number): string` em `utils/money.ts` (`Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`; não finito → `formatBrl(0)`), usado pelos componentes novos.
  - `<BuyBox :offers="RankedOffer[]" />`, `<ShopOfferList :offers="RankedOffer[]" />` (id da seção: `ofertas`).

- [ ] **Step 1: Write the failing tests**

```ts
const row = (store: string, price: number, extra: Partial<PriceRow> = {}): PriceRow =>
  ({ store, price, discount: 0, activation: 'Steam', platforms: 'Windows', link: '#', ...extra })
it('ranks offers by price with one best and deltas', () => {
  const ranked = rankOffers([row('Epic', 149.99), row('GOG', 139.99, { historyLow: 139.99 }), row('Steam', 140.01)])
  expect(ranked.map((o) => [o.store, o.isBest, o.deltaFromBest, o.isHistoryLow])).toEqual([
    ['GOG', true, 0, true], ['Steam', false, 0.02, false], ['Epic', false, 10, false]
  ])
})
it('marks only one best on ties and drops invalid prices', () => {
  const ranked = rankOffers([row('A', 10), row('B', 10), row('C', Number.NaN), row('D', -1)])
  expect(ranked.map((o) => [o.store, o.isBest, o.deltaFromBest])).toEqual([['A', true, 0], ['B', false, 0]])
})
it('returns an empty list without offers', () => {
  expect(rankOffers([])).toEqual([])
})
```

- [ ] **Step 2: Run** — FAIL. **Step 3:** implementar `utils/offers.ts`; em `getPrices`, preencher `shopId` (`shop.id`) e `voucher` (`deal.voucher` string). **Step 4:** `yarn test` — PASS.
- [ ] **Step 5: `components/game/BuyBox.vue`**: cartão `rounded-xl border border-white/10 bg-gray-900/60` com "Melhor preço agora", `-X%`, preço `text-3xl font-extrabold`, original riscado, "na <loja> · ativa na <DRM>", selo "📉 menor preço da história" se `isHistoryLow`, botão principal `Comprar na <loja> ↗` (`<a target="_blank" rel="noopener noreferrer nofollow">`, `bg-[#66c0f4] text-gray-950`), link "Comparar N lojas ↓" (`href="#ofertas"`, só se N ≥ 2). Sem ofertas: "Nenhuma loja vende este jogo no Brasil agora." e link para o histórico.
- [ ] **Step 6: `components/game/ShopOfferList.vue`**: `section#ofertas`; linhas em grid `sm:grid-cols-[1.6fr_1fr_auto_auto]`, empilhadas no celular; ícone 28 px com inicial da loja e fundo `hsl(hueFromString(store) 55% 35%)`; nome, "Ativa na <DRM>"; coluna do meio: selo de mínima ou "+ R$ x" (`deltaFromBest > 0`); preço, `-X%`, original riscado; cupom "Cupom: <voucher>" quando houver; botão "Comprar ↗" (contorno; sólido na melhor); linha da melhor com borda verde e etiqueta "MELHOR PREÇO". Mostra 5, depois botão "Ver mais N lojas".
- [ ] **Step 7: Update `pages/game/[id].vue`**: `const offers = computed(() => rankOffers(priceRows.value))`; `topOffer` passa a ser `offers.value[0]`; `BuyBox` no `aside`, logo após a descrição (os campos "Melhor preço" e "Mínima histórica" saem do `aside`, ficam na caixa); a seção "Tabela de preços" vira "Onde comprar" com `ShopOfferList`, logo abaixo da galeria; histórico e avaliações mantidos.
- [ ] **Step 8: Verify** `yarn test`, `yarn lint`; `yarn dev` em `/game/baldurs-gate-3` e `/game/cyberpunk-2077`: caixa visível sem rolar no desktop, botões abrem a loja em nova aba, "Comparar" rola até a lista, 375 px empilha corretamente.
- [ ] **Step 9: Commit (parte 3)** — `git add -A && git commit -m "feat: caixa de compra e lista de lojas na página do jogo"`

---

## Parte 4 — Favoritos

### Task 8: Favoritos com dados e página `/favoritos`

**Files:**
- Create: `utils/favorites.ts`, `pages/favoritos.vue`, `tests/unit/favorites.spec.ts`
- Modify: `stores/games.ts`, `composables/useGamesApi.ts` (exportar `getBestPrices`), `app.vue` (links no cabeçalho + migração), `pages/index.vue`, `components/catalog/CatalogPage.vue`, `pages/search/index.vue` (novas APIs do store)

**Interfaces:**
- Produces:
  - `type FavoriteGame = { id: string; slug: string; title: string; image: string; addedAt: string }`
  - `const MAX_FAVORITES = 50`
  - `parseStoredFavorites(raw: string | null): { items: FavoriteGame[]; legacyIds: string[] }` — aceita array de strings (legado → `legacyIds`) e/ou objetos; descarta itens sem `id`; dedupe por id (primeira ocorrência); total (`items` + `legacyIds`) cortado em 50; JSON inválido/não-array → vazio.
  - Store: `favorites: Ref<FavoriteGame[]>`, `isFavorite(id: string): boolean`, `toggleFavorite(game: Pick<Game, 'id' | 'slug' | 'title' | 'image'>): 'added' | 'removed' | 'limit'`, `migrateLegacyFavorites(getInfo: (id: string) => Promise<GameInfo>): Promise<void>` (busca em paralelo; sucesso vira `FavoriteGame` com `slug` do título via o mesmo slugify; falha mantém o id pendente para a próxima vez).
  - Chave do `localStorage` continua `gamedeals:favorites`.
  - `getBestPrices(gameIds: string[]): Promise<Map<string, number>>` (o atual `getBestPricesByGameId`, exportado).

- [ ] **Step 1: Write the failing tests**

```ts
it('reads legacy id arrays and new objects, deduped and capped at 50', () => {
  const legacy = JSON.stringify(['a', 'b', 'a'])
  expect(parseStoredFavorites(legacy)).toEqual({ items: [], legacyIds: ['a', 'b'] })
  const mixed = JSON.stringify([{ id: 'x', slug: 'x', title: 'X', image: '', addedAt: '2026-10-24T00:00:00.000Z' }, 'y', { title: 'sem id' }])
  expect(parseStoredFavorites(mixed)).toEqual({ items: [expect.objectContaining({ id: 'x' })], legacyIds: ['y'] })
  const many = JSON.stringify(Array.from({ length: 80 }, (_, i) => `id-${i}`))
  expect(parseStoredFavorites(many).legacyIds).toHaveLength(50)
})
it('survives corrupted storage', () => {
  expect(parseStoredFavorites('{not json')).toEqual({ items: [], legacyIds: [] })
  expect(parseStoredFavorites('{"a":1}')).toEqual({ items: [], legacyIds: [] })
  expect(parseStoredFavorites(null)).toEqual({ items: [], legacyIds: [] })
})
```

- [ ] **Step 2: Run** — FAIL. **Step 3:** implementar `utils/favorites.ts` e o store (o store persiste `[...items, ...legacyIds]` para não perder pendentes). **Step 4:** `yarn test` — PASS.
- [ ] **Step 5: Wire the store**: `GameCard` `toggle-favorite(game)` → `const r = gamesStore.toggleFavorite(game)`; `r === 'limit'` → toast "Limite de 50 favoritos atingido". Trocar `favorites.includes(id)` por `isFavorite(id)` em todas as páginas. `app.vue` `onMounted` → `gamesStore.migrateLegacyFavorites(getGameInfo)`.
- [ ] **Step 6: Header (`app.vue`)**: links "Ofertas" (`/ofertas`) e "♥ Favoritos" com contador (`favorites.length`, renderizado só no cliente com `<ClientOnly>`), com `aria-label="Favoritos, <n> jogos"`.
- [ ] **Step 7: `pages/favoritos.vue`**: `useSeoMeta({ title: 'Meus favoritos | GameDeals BR', robots: 'noindex' })`; conteúdo em `<ClientOnly>`; uma chamada `getBestPrices(ids)`; monta `Game` a partir de `FavoriteGame` (`images: [image]`, `price: [{ amount }]`); ordena "com preço primeiro" e depois `addedAt` desc; cards sem preço exibem "Sem ofertas no momento" (prop opcional `noOffer` no `GameCard`, que esconde preço); estado vazio: "Você ainda não favoritou nenhum jogo. Toque no ♥ de um jogo para salvá-lo aqui." + link "Explorar ofertas" (`/ofertas`); skeleton enquanto carrega.
- [ ] **Step 8: Verify** `yarn test`, `yarn lint`; manual: favoritar na home, ver contador, abrir `/favoritos` com preço; no console definir `localStorage['gamedeals:favorites']='["018d937f-2997-7131-b8b9-7c8af4825fa8"]'` e recarregar → vira Cyberpunk 2077 com capa.
- [ ] **Step 9: Commit (parte 4)** — `git add -A && git commit -m "feat: página de favoritos com melhor preço atual"`

---

## Parte 5 — SEO

### Task 9: Meta, JSON-LD, canonical, sitemap e robots

**Files:**
- Create: `utils/seo.ts`, `tests/unit/seo.spec.ts`, `server/api/__sitemap__/urls.get.ts`, `server/routes/robots.txt.ts`, `public/og-default.png` (1200×630)
- Modify: `nuxt.config.ts`, `.env.example`, `README.md`, `pages/game/[id].vue`, `components/catalog/CatalogPage.vue`, `pages/index.vue`, `pages/search/index.vue`, `package.json` (via yarn)
- Delete: `public/robots.txt`

**Interfaces:**
- Consumes: `RankedOffer` (Task 7), `DEAL_COLLECTIONS` (Task 3), `fetchDealsPage`/`parseDealQuery` (Task 2).
- Produces:
  - Consumes também `formatBrl` (Task 7).
  - `buildGameSeoTitle(title: string, offers: RankedOffer[]): string`
  - `buildGameSeoDescription(title: string, offers: RankedOffer[]): string`
  - `buildProductJsonLd(input: { name: string; url: string; image?: string; description?: string; offers: RankedOffer[] }): Record<string, unknown>`
  - `runtimeConfig.public.siteUrl` ← `NUXT_PUBLIC_SITE_URL` (sem barra final)

- [ ] **Step 1: Write the failing tests** (`formatBrl` usa espaço não separável do `Intl`; comparar com `formatBrl(...)`, não com literal)

```ts
const offer = (store: string, price: number, url = `https://x/${store}`) =>
  ({ store, price, regularPrice: 199.99, discount: 30, activation: 'Steam', platforms: 'Windows', link: url, isBest: false, deltaFromBest: 0, isHistoryLow: false }) as RankedOffer
it('builds the game title with best price and shop count', () => {
  expect(buildGameSeoTitle("Baldur's Gate 3", [offer('GOG', 139.99), offer('Steam', 140.01)]))
    .toBe(`Baldur's Gate 3 por ${formatBrl(139.99)} — compare preços em 2 lojas`)
  expect(buildGameSeoTitle('Hades', [offer('GOG', 10)])).toBe(`Hades por ${formatBrl(10)} — compare preços em 1 loja`)
  expect(buildGameSeoTitle('Hades', [])).toBe('Hades — preços e histórico')
})
it('builds Product JSON-LD with an aggregate offer', () => {
  const ld = buildProductJsonLd({ name: 'BG3', url: 'https://site/game/bg3', image: 'img', offers: [offer('GOG', 139.99), offer('Epic', 149.99)] })
  expect(ld).toEqual({
    '@context': 'https://schema.org', '@type': 'Product', name: 'BG3', url: 'https://site/game/bg3', image: 'img',
    offers: { '@type': 'AggregateOffer', priceCurrency: 'BRL', lowPrice: 139.99, highPrice: 149.99, offerCount: 2,
      offers: [
        { '@type': 'Offer', price: 139.99, priceCurrency: 'BRL', url: 'https://x/GOG', availability: 'https://schema.org/InStock', seller: { '@type': 'Organization', name: 'GOG' } },
        { '@type': 'Offer', price: 149.99, priceCurrency: 'BRL', url: 'https://x/Epic', availability: 'https://schema.org/InStock', seller: { '@type': 'Organization', name: 'Epic' } }
      ] }
  })
})
it('omits offers when there are none', () => {
  expect(buildProductJsonLd({ name: 'X', url: 'u', offers: [] })).not.toHaveProperty('offers')
})
```

```ts
it('builds the game description', () => {
  expect(buildGameSeoDescription('Hades', [offer('GOG', 10), offer('Steam', 12)]))
    .toBe(`Compare o preço de Hades em 2 lojas no Brasil. Menor preço agora: ${formatBrl(10)} na GOG. Veja o histórico de preços.`)
  expect(buildGameSeoDescription('Hades', [offer('GOG', 10)]))
    .toBe(`Compare o preço de Hades em 1 loja no Brasil. Menor preço agora: ${formatBrl(10)} na GOG. Veja o histórico de preços.`)
  expect(buildGameSeoDescription('Hades', [])).toBe('Veja o histórico de preços de Hades nas lojas digitais.')
})
```

- [ ] **Step 2: Run** — FAIL. **Step 3:** implementar `utils/seo.ts`. **Step 4:** `yarn test` — PASS.
- [ ] **Step 5: Install and configure sitemap**: `yarn add @nuxtjs/sitemap@^7`; em `nuxt.config.ts`: módulo `'@nuxtjs/sitemap'`, `site: { url: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000', name: 'GameDeals BR' }`, `sitemap: { sources: ['/api/__sitemap__/urls'], exclude: ['/favoritos', '/search/**'] }`, `runtimeConfig.public.siteUrl`. `.env.example`: `NUXT_PUBLIC_SITE_URL=https://seu-dominio.com.br`.
- [ ] **Step 6: `server/api/__sitemap__/urls.get.ts`** (`defineCachedEventHandler`, `maxAge: 21_600`, `swr: true`): `/ofertas/<slug>` para cada coleção + `/game/<slug>` das ofertas de 10 páginas `fetchDealsPage(parseDealQuery({ sort: '-hot', limit: 50 }))` seguindo `nextOffset` (para quando `hasMore` falso), dedupe por slug; falha da ITAD → só as coleções. Formato: `[{ loc: string, changefreq: 'daily' }]`.
- [ ] **Step 7: `server/routes/robots.txt.ts`**: `text/plain` com `User-agent: *`, `Disallow: /favoritos`, `Disallow: /api/`, `Sitemap: <siteUrl>/sitemap.xml`. Apagar `public/robots.txt`.
- [ ] **Step 8: `public/og-default.png`**: 1200×630, fundo `#0b0f17`, "GameDeals BR" em `#66c0f4` e "As melhores ofertas de jogos para PC no Brasil" em branco. Gerar com Edge headless a partir de um HTML temporário no scratchpad (`msedge --headless --screenshot=<saída> --window-size=1200,630 <arquivo.html>`); não commitar o HTML.
- [ ] **Step 9: Pages**
  - Game: `useSeoMeta` com `title: buildGameSeoTitle(...) + ' | GameDeals BR'`, `description`, `ogTitle`, `ogDescription`, `ogImage` (Steam `header.jpg` se `appid`, senão `gameInfo.image`), `ogType: 'website'`, `twitterCard: 'summary_large_image'`; `useHead` com `link rel=canonical = <siteUrl>/game/<slug do jogo>` e `script type=application/ld+json` = `JSON.stringify(buildProductJsonLd(...))`.
  - Catálogo: título "`<título da coleção>` | GameDeals BR" ou "Todas as ofertas | GameDeals BR", descrição da coleção (ou "Todas as promoções de jogos para PC nas lojas que vendem no Brasil."), canonical para a URL da coleção (ou `/ofertas`) **sem query**, `ogImage: '<siteUrl>/og-default.png'`.
  - Home: título "GameDeals BR — promoções de jogos para PC no Brasil", descrição "Os menores preços de jogos para PC em Steam, Epic, GOG e outras lojas, com histórico de preços.", canonical `/`, `ogImage` padrão.
  - Busca: `robots: 'noindex, follow'`.
- [ ] **Step 10: Verify** `yarn test`, `yarn lint`, `yarn build`; `node .output/server/index.mjs` e checar: `/sitemap.xml` lista coleções e jogos; `/robots.txt` com a linha `Sitemap:`; HTML de `/game/baldurs-gate-3` contém `application/ld+json`, `og:image` e `rel="canonical"`; validar o JSON-LD colando no https://validator.schema.org (manual).
- [ ] **Step 11: README**: seção de arquitetura com as novas rotas/páginas e a variável `NUXT_PUBLIC_SITE_URL`.
- [ ] **Step 12: Commit (parte 5)** — `git add -A && git commit -m "feat: SEO com meta por página, JSON-LD, canonical, sitemap e robots"`

### Task 10: Verificação final e PR

- [ ] **Step 1:** `yarn test` (todos passam), `yarn lint` (exit 0), `yarn build` (sucesso).
- [ ] **Step 2:** Passada manual em 375 px e 1440 px: `/`, `/ofertas`, `/ofertas/menor-preco-historico`, `/ofertas/gratis`, `/game/baldurs-gate-3`, `/favoritos`, busca. Nenhuma imagem cortada/quebrada; navegação só por teclado funciona no balão de filtros e no carrossel.
- [ ] **Step 3:** `git push -u origin feature/redesign-loja` e `gh pr create --base main` com resumo por parte, checklist de testes e a linha `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
