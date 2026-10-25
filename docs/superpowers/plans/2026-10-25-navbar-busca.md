# Navbar e busca Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cabeçalho em duas faixas (estilo loja) com busca rica (capa, preço, desconto, menor preço), buscas recentes, atalhos de teclado e versão de celular, sem gastar ITAD por tecla.

**Architecture:** Um endpoint cacheado `/api/games/suggest` junta busca e preços da ITAD no servidor. A lógica do navegador (cache da sessão, descarte de respostas antigas, recentes, atalho) fica em funções puras em `app/utils/search.ts`, testadas em node. Os componentes `AppHeader`, `HeaderSearch` e `HeaderMobileMenu` só montam a interface, e `app.vue` fica enxuto.

**Tech Stack:** Nuxt 4.6, Nuxt UI 4, Tailwind 4, Pinia, Vitest 4 (environment node).

**Spec:** `docs/superpowers/specs/2026-10-25-navbar-busca-design.md`

## Global Constraints

- **Espera de busca:**
  - 300 ms depois da última tecla;
  - mínimo de 2 letras;
  - limite de 8 sugestões;
  - até 5 buscas recentes, guardadas em `localStorage` na chave `dealsgamer:recent-searches`.
- **Cache do servidor do `/api/games/suggest`:** `maxAge: 300, swr: true`, chaveado pelo termo normalizado (minúsculas, espaços aparados e colapsados).
- **Preços:** ITAD `/games/prices/v3` com `country: ITAD_COUNTRY` ('BR'), melhor preço via `pickBestPrice` de `server/utils/alerts.ts`.
- **Tipos aceitos nas sugestões:** só `game` e `dlc`.
- **Textos:**
  - "MENOR PREÇO" (selo);
  - `Ver todos os resultados para "<termo>"` (rodapé da lista, abre `/search?q=<termo>`);
  - "Buscas recentes" e "Limpar" (recentes);
  - "Nenhum jogo encontrado." (vazio);
  - tipo exibido como "Jogo" ou "DLC";
  - linha de loja: `Jogo · melhor na <loja>`.
- **Atalhos:** `/`, `Ctrl+K` e `Cmd+K` focam a busca, exceto quando o foco está em `input`, `textarea`, `select` ou `contenteditable`.
- **Faixa de baixo, nesta ordem:**
  - Ofertas → `/ofertas`;
  - as 5 coleções de `DEAL_COLLECTIONS`, na ordem do array, → `/ofertas/<slug>`, com rótulos curtos: Menor preço da história, Grátis, Acabando, 75% off, Até R$ 20;
  - "Por loja ▾": lojas de `/api/shops` em ordem alfabética, cada uma → `/ofertas?lojas=<id>`.
- **Celular** (abaixo de `sm`): uma linha com ☰, logo, 🔍 e ♥. A busca abre em tela cheia.
- **Cores:**
  - destaque verde `#4ade80` (`green-400`);
  - contador azul `#66c0f4`;
  - fundo do cabeçalho `bg-gray-950/55` com `backdrop-blur-md`, como hoje.
- **Acessibilidade:**
  - a caixa tem `role="combobox"`, `aria-expanded`, `aria-controls` e `aria-activedescendant`;
  - a lista tem `role="listbox"` e as linhas `role="option"`;
  - o painel do celular fecha com Esc e prende o foco (`USlideover` do Nuxt UI).
- Não alterar links de compra da ITAD.
- As chaves `gamedeals:favorites` e `gamedeals-color-mode` não mudam.

## Review Focus

1. **Digitação rápida:** a resposta de "cy" chegando depois da de "cyber" não pode substituir a lista de "cyber" (Task 2, teste "descarta resposta de termo antigo").
2. **Preços indisponíveis:** se a chamada de preços da ITAD falhar, as sugestões aparecem sem preço em vez de erro (Task 1, teste "sem preços quando a ITAD de preços falha").
3. **Mesmo termo escrito diferente:** "  Cyberpunk  2077 " e "cyberpunk 2077" usam a mesma entrada de cache, no servidor e no navegador (Task 1, "normaliza o termo"; Task 2, "reaproveita termo já buscado").
4. **Atalho roubando a digitação:** apertar "/" dentro do campo de email ou do filtro de preço não pode pular para a busca (Task 2, "ignora atalho dentro de campo de texto").
5. **`localStorage` bloqueado ou com JSON inválido:** os recentes viram lista vazia e nada quebra (Task 2, "recentes sobrevivem a storage quebrado").

---

### Task 1: Endpoint de sugestões com preço

**Files:**
- Create: `server/utils/suggest.ts`
- Create: `app/utils/search.ts` (só `normalizeSearchTerm` nesta task; o servidor importa de `app/utils` como `home.ts` já faz com `catalog`)
- Create: `server/api/games/suggest.get.ts`
- Test: `tests/unit/suggest.spec.ts`

**Interfaces:**
- Consumes:
  - `ItadFetcher` (`server/utils/deals.ts`);
  - `itadFetch`, `ITAD_COUNTRY`, `parseIntInRange` (`server/utils/itad.ts`);
  - `pickBestPrice` (`server/utils/alerts.ts`).
- Produces:
  - `type SuggestionPrice = { amount: number; regular: number; cut: number; shop: string; isHistoryLow: boolean }`
  - `type Suggestion = { id: string; slug: string; title: string; image: string; type: 'game' | 'dlc'; price: SuggestionPrice | null }` (put it in `shared/types/suggest.d.ts` so the app sees it; type-only)
  - `normalizeSearchTerm(raw: unknown): string` in `app/utils/search.ts` (trim, lowercase, collapse spaces, max 100 chars)
  - `buildSuggestions(term: string, limit: number, fetcher?: ItadFetcher): Promise<Suggestion[]>`
  - `GET /api/games/suggest?q=&limit=` → `Suggestion[]`

- [ ] **Step 1: Write the failing tests** in `tests/unit/suggest.spec.ts`. Use a fake fetcher keyed by path, like `home.spec.ts`. The cases:
  - **"normaliza o termo":** `normalizeSearchTerm('  Cyberpunk   2077 ')` is `'cyberpunk 2077'`, and `normalizeSearchTerm(42)` is `''`.
  - **"junta busca e preços":**
    - the search returns `[game A (type game, assets.banner300 'a.jpg', slug 'a'), dlc B, item C of type 'package']`;
    - prices return A with deals `[{shop:{name:'GOG'}, price:{amount:59.95}, regular:{amount:199.9}, cut:70}]` and a history low of 59.95;
    - expect 2 items, C dropped;
    - A has `price: { amount: 59.95, regular: 199.9, cut: 70, shop: 'GOG', isHistoryLow: true }` and `image: 'a.jpg'`;
    - B has `price: null`;
    - the prices call is one POST to `/games/prices/v3` with body `[A.id, B.id]` and `params.country === 'BR'`.
  - **"sem preços quando a ITAD de preços falha":** the prices fetcher throws; the result is still 2 items, all with `price: null`.
  - **"termo vazio não chama a ITAD":** `buildSuggestions('', 8, fetcher)` resolves `[]` and the fetcher is never called.
  - **"respeita o limite":** with a limit of 3, the search params contain `results: 3`.

- [ ] **Step 2: Run** `yarn vitest run tests/unit/suggest.spec.ts`. Expected: FAIL (module not found).

- [ ] **Step 3: Implement** `server/utils/suggest.ts`.
  - Image preference for the wide row thumbnail: `banner300 ?? banner400 ?? banner600 ?? boxart ?? ''`.
  - Skip the prices call when there are no ids.
  - Wrap the prices call in try/catch so a failure gives `price: null`.

- [ ] **Step 4: Implement the route** `server/api/games/suggest.get.ts`.
  - Use `defineCachedEventHandler` with `{ maxAge: 300, swr: true, name: 'itad-suggest', getKey: (event) => \`${normalizeSearchTerm(getQuery(event).q)}:${limit}\` }`.
  - `limit = parseIntInRange(q.limit, 8, 1, 10)`.

- [ ] **Step 5: Run** `yarn vitest run tests/unit/suggest.spec.ts`. Expected: PASS (5 tests).

- [ ] **Step 6: Commit** `feat: sugestões de busca com preço`.

### Task 2: Lógica da busca no navegador

**Files:**
- Modify: `app/utils/search.ts` (created in Task 1)
- Create: `app/composables/useSearchSuggestions.ts`
- Test: `tests/unit/search.spec.ts`

**Interfaces:**
- Consumes: the `Suggestion` type; `GET /api/games/suggest`.
- Produces, in `app/utils/search.ts`:
  - `SEARCH_DEBOUNCE_MS = 300`, `MIN_SEARCH_LENGTH = 2`, `RECENT_SEARCHES_KEY = 'dealsgamer:recent-searches'`, `MAX_RECENT_SEARCHES = 5`
  - `createSuggestionLoader(fetch: (term: string) => Promise<Suggestion[]>): { load(term: string): Promise<Suggestion[] | null> }`
    - Session cache by normalized term.
    - Returns `null` when a newer `load` started before this one resolved (latest wins).
    - Terms under `MIN_SEARCH_LENGTH` resolve `[]` without fetching.
    - A failed fetch is not cached.
  - `readRecentSearches(storage: Pick<Storage,'getItem'> | null): string[]`
  - `addRecentSearch(list: string[], term: string): string[]`: newest first, deduped case-insensitively, max 5, blank ignored.
  - `writeRecentSearches(storage: Pick<Storage,'setItem'> | null, list: string[]): void`: never throws.
  - `isSearchShortcut(event: { key: string; ctrlKey: boolean; metaKey: boolean; target: unknown }): boolean`
- Produces, in `app/composables/useSearchSuggestions.ts`:
  - `useSearchSuggestions()` → `{ term: Ref<string>, suggestions: Ref<Suggestion[]>, loading: Ref<boolean>, recent: Ref<string[]>, onInput(value: string): void, setTerm(value: string): void, remember(term: string): void, clearRecent(): void }`
  - `onInput` debounces by `SEARCH_DEBOUNCE_MS` and loads.
  - `setTerm` fills the box (from the URL) **without** loading. This is the fix for the first-keystroke bug: suggestions come from input events, not from a watcher on the value.

- [ ] **Step 1: Write the failing tests** in `tests/unit/search.spec.ts`:
  - **"reaproveita termo já buscado":** `load('Cyber')` then `load(' cyber ')` → the fetch is called once.
  - **"descarta resposta de termo antigo":**
    - the fetch for 'cy' resolves after the fetch for 'cyber', using manually controlled promises;
    - `load('cy')` resolves `null`, `load('cyber')` resolves its list.
  - **"menos de 2 letras não busca":** `load('c')` → `[]`, and the fetch is not called.
  - **"erro não fica no cache":** the first fetch rejects and the second resolves; two loads of 'halo' → the fetch is called twice, and the second returns the list.
  - **"recentes: mais novo primeiro, sem repetir, no máximo 5":** `addRecentSearch(['a','b','c','d','e'], 'B')` → `['B','a','c','d','e']`; `addRecentSearch(['a'], '  ')` → `['a']`.
  - **"recentes sobrevivem a storage quebrado":**
    - `readRecentSearches({ getItem: () => '{oops' })` → `[]`;
    - `readRecentSearches({ getItem: () => { throw new Error() } })` → `[]`;
    - `readRecentSearches(null)` → `[]`;
    - `readRecentSearches({ getItem: () => '[1,"x"]' })` → `['x']`;
    - `writeRecentSearches({ setItem: () => { throw new Error() } }, ['x'])` does not throw.
  - **"atalhos / e Ctrl/Cmd+K":** `/` with target `{}` is true; `k` + ctrlKey is true; `K` + metaKey is true; `k` alone is false.
  - **"ignora atalho dentro de campo de texto":** `/` with target `{ tagName: 'INPUT' }`, `{ tagName: 'TEXTAREA' }`, `{ tagName: 'SELECT' }` or `{ isContentEditable: true }` → false. Ctrl+K inside an INPUT is also false.

- [ ] **Step 2: Run** `yarn vitest run tests/unit/search.spec.ts`. Expected: FAIL (module not found).

- [ ] **Step 3: Implement** `app/utils/search.ts`, then the composable. It uses `$fetch('/api/games/suggest', { query: { q, limit: 8 } })`, and `localStorage` guarded by `import.meta.client`.

- [ ] **Step 4: Run** `yarn vitest run tests/unit/search.spec.ts`. Expected: PASS (8 tests).

- [ ] **Step 5: Commit** `feat: lógica da busca (cache, recentes, atalhos)`.

### Task 3: Links do cabeçalho

**Files:**
- Create: `app/utils/header-nav.ts`
- Test: `tests/unit/header-nav.spec.ts`

**Interfaces:**
- Consumes: `DEAL_COLLECTIONS` (`app/utils/catalog.ts`).
- Produces:
  - `type HeaderLink = { label: string; to: string }`
  - `HEADER_LINKS: HeaderLink[]`
  - `shopLink(shopId: number): string`
  - `sortShops(shops: { id: number; title: string }[]): { id: number; title: string }[]`: pt-BR `localeCompare`, without mutating the input.
  - `isActiveLink(path: string, fullPath: string, link: HeaderLink): boolean`
    - `/ofertas` is active only for exactly `/ofertas` with no `lojas` query;
    - a collection is active when the path is equal.

- [ ] **Step 1: Write the failing tests:**
  - **"atalhos na ordem do spec":** the labels equal `['Ofertas','Menor preço da história','Grátis','Acabando','75% off','Até R$ 20']`, and each `to` equals `/ofertas` or `/ofertas/<DEAL_COLLECTIONS[i].slug>`.
  - **"link de loja":** `shopLink(16)` is `'/ofertas?lojas=16'`.
  - **"lojas em ordem alfabética":** `sortShops([{id:1,title:'Steam'},{id:2,title:'Epic Game Store'},{id:3,title:'éXtra'}])` gives titles `['Epic Game Store','éXtra','Steam']`, and the input is unchanged.
  - **"link ativo":**
    - `isActiveLink('/ofertas/gratis', '/ofertas/gratis', grátis)` is true;
    - `isActiveLink('/ofertas', '/ofertas?lojas=16', ofertas)` is false;
    - `isActiveLink('/ofertas', '/ofertas', ofertas)` is true;
    - `isActiveLink('/', '/', ofertas)` is false.

- [ ] **Step 2: Run** `yarn vitest run tests/unit/header-nav.spec.ts`. Expected: FAIL.

- [ ] **Step 3: Implement.** The short labels come from a `Record<slug, string>` beside the list.

- [ ] **Step 4: Run** the same command. Expected: PASS (4 tests).

- [ ] **Step 5: Commit** `feat: links do novo cabeçalho`.

### Task 4: Componentes e troca do cabeçalho

**Files:**
- Create: `app/components/header/AppHeader.vue`, `app/components/header/HeaderSearch.vue`, `app/components/header/HeaderMobileMenu.vue`
- Modify: `app/app.vue`. The header and all search code leave it (lines 5–103 of the template, and lines 125–328 except the favorites/account `onMounted`). `<main>`'s `pt-28 sm:pt-24` becomes a value matching the new height.

**Interfaces:**
- Consumes: Tasks 2 and 3; `useAccount()` (`enabled`, `loggedIn`, `email`, `logout`); `useGamesStore().favorites`; `/api/shops`.
- Produces:
  - `<AppHeader />`, with no props;
  - `<HeaderSearch :fullscreen="boolean" @close />`. On a desktop it's inline; on a phone it's in a full-screen overlay.

- [ ] **Step 1: Build `HeaderSearch`.**
  - It's a combobox that uses the composable.
  - **Rows:** wide thumbnail (92×43), title, `Jogo · melhor na <loja>`, cut badge, BRL price, and the "MENOR PREÇO" selo.
  - **Footer:** the "Ver todos" link.
  - **Empty focus:** the recents with "Limpar".
  - **Loading:** a 3-row skeleton. Keep the list's height while loading, so nothing jumps.
  - **Keyboard:** ↑/↓ moves through the rows, then the footer. Enter opens the highlighted game, or submits to `/search?q=` when nothing is highlighted. Esc closes and blurs.
  - **Recents:** choosing a game or submitting remembers the term.
  - **Shortcut:** a global `keydown` listener focuses the box when `isSearchShortcut`. On a phone it opens the full-screen search.
  - On a `/search?q=` page, the box shows the term via `setTerm`.

- [ ] **Step 2: Build `AppHeader`.**
  - **Top row:** logo `Deals<span class="text-green-400">Gamer</span>`, `HeaderSearch` (`flex-1`, `max-w-2xl`), ♥ with the counter linking to `/favoritos`, and the account.
    - The account is a `UDropdownMenu` with the initial avatar → "Minha conta" (`/conta`) and "Sair" (`logout`) when signed in; "Entrar" when not; nothing when `enabled` is false.
  - **Bottom row** (hidden below `sm`): `HEADER_LINKS`, active one white with a green underline, then the "Por loja ▾" `UDropdownMenu` with the sorted shops (scrollable, max-h ~20rem).
  - **Phone row:** ☰ (opens `HeaderMobileMenu`), the logo, 🔍 (opens the full-screen `HeaderSearch`), and ♥.

- [ ] **Step 3: Build `HeaderMobileMenu`.** A `USlideover` from the left with the links, a collapsible "Por loja" section, Favoritos, and the account entries. It closes on navigation.

- [ ] **Step 4: Swap it into `app.vue`** and adjust the `<main>` padding.

- [ ] **Step 5: Run** `yarn test`, `yarn lint`. Expected: all pass, no type errors.

- [ ] **Step 6: Check in the browser** (dev server; Brave headless via the CDP script; never Chrome):
  - **1280px and 1920px:** screenshots with the suggestions open for "resident evil". Prices, the badge and the footer show. The second row is visible and the active link is marked on `/ofertas/gratis`.
  - **390px:** one header row. ☰ opens the panel; 🔍 opens the full-screen search with recents after one search.
  - **First keystroke:** load `/`, focus the box, type "ha" → a request to `/api/games/suggest?q=ha` happens.
  - **Shortcuts:** "/" on `/` focuses the search; "/" inside the price filter on `/search?q=x` types "/".
  - **No overlap:** the content isn't covered by the header on `/`, `/ofertas` or a game page.

- [ ] **Step 7: Commit** `feat: novo cabeçalho com busca rica`.

### Task 5: Fechamento

- [ ] **Step 1:** Run `yarn test`, `yarn lint` and `NITRO_PRESET=vercel yarn build`. Expected: all green.
- [ ] **Step 2:** Update the README section that describes the search, if it mentions the old one.
- [ ] **Step 3:** Push `feature/navbar-busca`, wait for the preview to be READY, and check `/api/games/suggest?q=cyberpunk` on the preview: 200, with prices.
