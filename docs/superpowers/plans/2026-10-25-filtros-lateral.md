# Filtros na lateral e site até 1600px Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar a fileira de atalhos e a janela "Filtros" das ofertas por uma coluna de filtros fixa à esquerda (painel lateral no celular) e alargar o site todo para até 1600px sem diminuir os cards.

**Architecture:**
- A lógica pura dos filtros sai do `FilterPopover` para `app/utils/catalog-filters.ts`, testada em node.
- Um componente `CatalogFilterPanel` (sempre aberto, aplica na hora) é usado na coluna `sticky` em `lg+` e num `USlideover` abaixo disso.
- A largura vem de `--ui-container` no CSS. A página do jogo limita o próprio conteúdo a 1280px.

**Tech Stack:** Nuxt 4.6, Nuxt UI 4, Tailwind 4, Vitest 4 (node).

**Spec:** `docs/superpowers/specs/2026-10-25-filtros-lateral-design.md`

## Global Constraints

- **Largura:** container `--ui-container: 100rem` (1600px). O conteúdo da página do jogo fica com no máximo `80rem` (1280px), centralizado.
- **Coluna:** a partir de `lg` (1024px), largura `16rem` (256px), `sticky` em `top-[122px]` (cabeçalho de 106px + 16px). Altura máxima `calc(100vh - 138px)`, com `overflow-y-auto`.
- **Grade das ofertas:** `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5`, sem `xl:grid-cols-5`.
- **Grades de largura total:**
  - favoritos: `... xl:grid-cols-5 2xl:grid-cols-6`;
  - busca: `grid-cols-2 md:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6`.
- **Ordem da coluna:**
  1. Preço máximo: atalhos Grátis, R$ 20, R$ 50, R$ 100 e um controle deslizante de 0 a 300, onde 300 é "Sem limite"; espera de 400 ms.
  2. Desconto mínimo: Qualquer, 25%, 50%, 75%, 90%.
  3. Lojas: campo "Buscar loja…", 6 visíveis e "ver todas (N)"/"ver menos".
  4. Ativa em: `DRM_OPTIONS`.
  5. Mostrar: Jogos/DLCs.
  6. "Só menor preço da história".
- "Limpar filtros" aparece no topo da coluna quando há filtro ativo.
- **Abaixo de `lg`:** botão "Filtros (N)" ao lado de "Ordenar" abre `USlideover` da esquerda, com título "Filtros" e o mesmo painel.
- **Ordenação:** as mesmas opções do `QuickFilterBar` atual, num `<select>` com rótulo "Ordenar por", à direita da linha das etiquetas ativas.
- Remover `app/components/catalog/QuickFilterBar.vue` e `app/components/catalog/FilterPopover.vue`.
- Cor de seleção dos filtros: a mesma de hoje (`#66c0f4`).

## Review Focus

1. **Loja marcada some da lista:** uma loja marcada fora das 6 primeiras, ou que não bate com o texto do campo de busca, continua aparecendo marcada, para poder desmarcar (Task 1, "loja marcada sempre aparece").
2. **Acentos e maiúsculas na busca de loja:** "nuuvém" e "EPIC" encontram "Nuuvem" e "Epic Game Store" (Task 1, "busca de loja ignora acentos e maiúsculas").
3. **Coleção do cabeçalho:** em `/ofertas/gratis`, "Grátis" aparece marcado na coluna. Clicar nele de novo tira o filtro e leva a `/ofertas` sem `preco` (Task 1, "atalho de preço liga e desliga"; Task 2, conferência no navegador).
4. **Arrastar o preço:** gera uma única busca depois da pausa, não uma por posição (Task 2, conferência no navegador contando as chamadas a `/api/deals`).
5. **Coluna maior que a tela** (todas as lojas abertas, tela de 720px de altura): rola por dentro e não cobre o rodapé (Task 2, conferência no navegador).

---

### Task 1: Lógica dos filtros

**Files:**
- Create: `app/utils/catalog-filters.ts`
- Test: `tests/unit/catalog-filters.spec.ts`

**Interfaces:**
- Consumes: `CatalogState`, `CatalogOrder` (`app/utils/catalog.ts`).
- Produces:
  - `PRICE_UNLIMITED = 300`
  - `PRICE_SHORTCUTS: { label: string; value: number }[]` = Grátis 0, R$ 20 20, R$ 50 50, R$ 100 100
  - `DISCOUNT_OPTIONS`, `TYPE_OPTIONS`, `ORDER_OPTIONS`: same values and labels as today's `FilterPopover` and `QuickFilterBar`
  - `VISIBLE_SHOPS = 6`
  - `priceDraftOf(preco: number | undefined): number`: undefined → 300; values clamped to 300
  - `priceFromDraft(draft: number): number | undefined`: ≥ 300 → undefined
  - `priceLabel(draft: number): string`: 'Sem limite', 'Grátis', or `Até R$ ${n}`
  - `togglePrice(current: number | undefined, value: number): number | undefined`: the same value turns it off
  - `toggleId(ids: number[], id: number): number[]`
  - `shopsToShow(shops: {id:number;title:string}[], selected: number[], query: string, showAll: boolean): {id:number;title:string}[]`
    - Filter by query, ignoring accents and case.
    - Then the first `VISIBLE_SHOPS` unless `showAll`.
    - Selected shops are always included and come first, in their original order.

- [ ] **Step 1: Write the failing tests:**
  - **"preço: rascunho e volta":** `priceDraftOf(undefined)` → 300; `priceDraftOf(500)` → 300; `priceFromDraft(300)` → undefined; `priceFromDraft(20)` → 20; `priceLabel(300)` → 'Sem limite'; `priceLabel(0)` → 'Grátis'; `priceLabel(50)` → 'Até R$ 50'.
  - **"atalho de preço liga e desliga":** `togglePrice(undefined, 0)` → 0; `togglePrice(0, 0)` → undefined; `togglePrice(20, 50)` → 50.
  - **"busca de loja ignora acentos e maiúsculas":** with shops Steam(61), Epic Game Store(16), Nuuvem(70), `shopsToShow(shops, [], 'nuuvém', false)` gives `[Nuuvem]`, and with 'EPIC' gives `[Epic Game Store]`.
  - **"mostra 6 lojas e todas com ver todas":** 10 shops; `showAll` false → 6; true → 10.
  - **"loja marcada sempre aparece":**
    - 10 shops, the 9th selected, `showAll` false → 7 entries, the 9th first.
    - Query 'steam' with Nuuvem selected → `[Nuuvem, Steam]`.

- [ ] **Step 2: Run** `yarn vitest run tests/unit/catalog-filters.spec.ts`. Expected: FAIL (module not found).

- [ ] **Step 3: Implement** `app/utils/catalog-filters.ts`. Accent folding: `normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()`.

- [ ] **Step 4: Run** the same command. Expected: PASS (5 tests).

- [ ] **Step 5: Commit** `feat: lógica dos filtros da lateral`.

### Task 2: Coluna de filtros nas ofertas

**Files:**
- Create: `app/components/catalog/CatalogFilterPanel.vue`
- Modify: `app/components/catalog/CatalogPage.vue`
- Delete: `app/components/catalog/QuickFilterBar.vue`, `app/components/catalog/FilterPopover.vue`

**Interfaces:**
- Consumes: everything from Task 1; `activeFilterTags`, `DRM_OPTIONS`, `CatalogState`; `CatalogActiveFilterTags` (unchanged).
- Produces: `<CatalogFilterPanel :state :shops @update="(patch: Partial<CatalogState>) => …" @clear />`, plus a header "Filtros" and the "Limpar filtros" link when `activeCount > 0` (prop `activeCount: number`).

- [ ] **Step 1: Build `CatalogFilterPanel`.**
  - Sections in the Global Constraints order, as `<fieldset>`s with legends styled like today's `h3`s.
  - The price slider uses a draft and the 400 ms delay, and syncs back when `state.preco` changes.
  - The shop search input filters through `shopsToShow`.
  - Chips use today's `chipClass` look; checkboxes are for Lojas and Ativa em.
  - No apply button.

- [ ] **Step 2: Rewire `CatalogPage`.**
  - **Layout:** `lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-6`.
  - **Left:** `<aside class="hidden lg:block">` with a sticky, scrollable wrapper (values in Global Constraints) holding the panel.
  - **Right:** the title and description, then a row with `CatalogActiveFilterTags`, the "Filtros (N)" button (`lg:hidden`) and the sort `<select>`, then the grid.
  - **Below `lg`:** the `USlideover` with the same panel. It stays open while filtering and closes with its own button or Esc.
  - **Grid:** `GRID_CLASS` per Global Constraints.
  - Drop `filtersOpen`/`filtersAnchor`/`openFilters` and the two old components.

- [ ] **Step 3: Run** `yarn test` and `yarn lint`. Expected: all pass, no type errors. Old tests importing the deleted components get updated: rule and ledger if any.

- [ ] **Step 4: Check in the browser** (dev server; Brave headless with the CDP script; never Chrome):
  - **1440×900 on `/ofertas`:** a screenshot showing the column and 4 columns of cards. Measure the card width: it should be ≥ today's (~230px).
  - **1920×1000:** 5 columns, cards ≥ 230px.
  - **`/ofertas/gratis`:** "Grátis" is marked in the column. Click it → the URL becomes `/ofertas` with no `preco`.
  - **Dragging the price** through 5 values in under 400 ms → exactly 1 new `/api/deals` call after the pause.
  - **1280×720:** open "ver todas" in Lojas; the column scrolls inside and the page footer stays reachable.
  - **390×844:** no column, and "Filtros" opens the panel. Ticking a store updates the list behind it, with the panel still open.

- [ ] **Step 5: Commit** `feat: filtros fixos na lateral das ofertas`.

### Task 3: Site até 1600px

**Files:**
- Modify: `app/assets/css/main.css` (add `--ui-container: 100rem` under the existing theme or `:root`)
- Modify: `app/pages/game/[id].vue` (wrap the content in `mx-auto max-w-7xl`; the blurred backdrop stays full width)
- Modify: `app/pages/favoritos.vue`, `app/pages/search/index.vue` (grid classes per Global Constraints)

- [ ] **Step 1: Make the changes above.** Check that the header (`UContainer`) and the footer follow the variable.

- [ ] **Step 2: Run** `yarn test` and `yarn lint`. Expected: pass.

- [ ] **Step 3: Check in the browser at 1920×1000:**
  - The header logo lines up with the left edge of the page content on `/`, `/ofertas`, `/favoritos` and a game page.
  - The game page content is ≤ 1280px wide.
  - On the home page, shelf cards are ≥ 230px wide.
  - At 1280×800, nothing changes compared with `main` (screenshot of the home page).

- [ ] **Step 4: Commit** `feat: site até 1600px`.

### Task 4: Fechamento

- [ ] **Step 1:** Run `yarn test`, `yarn lint` and `NITRO_PRESET=vercel yarn build`. Expected: green.
- [ ] **Step 2:** Update the README lines that describe the quick filters or the filter window.
- [ ] **Step 3:** Push `feature/filtros-lateral` and wait for the preview to be READY.
