# Migração Nuxt 4 + Nuxt UI v4 + Tailwind 4 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rodar o GameDeals BR em Nuxt 4.1+, Nuxt UI v4 e Tailwind 4 sem mudança perceptível para o usuário.

**Architecture:** Primeiro a estrutura de pastas do Nuxt 4 (ainda no Nuxt 3 com `future.compatibilityVersion: 4`), depois a troca de dependências e de API do Nuxt UI, depois as classes do Tailwind 4, e por fim a comparação visual contra produção. Um teste-guarda estático (lê o código-fonte) fica vermelho no início e verde no fim, provando que não sobrou API do v2.

**Tech Stack:** Nuxt 4.1+, @nuxt/ui 4.x, Tailwind CSS 4, Pinia, @nuxtjs/sitemap, Vitest 4, Yarn 4.13.0 (`yarnPath`), Brave headless via CDP.

**Spec:** `docs/superpowers/specs/2026-10-24-migracao-nuxt4-design.md`

## Global Constraints

- Paleta nova do Tailwind 4; pequenas diferenças de cor aceitas; cores customizadas (`#66c0f4` etc.) iguais.
- Tema escuro fixo: sem tema claro nem alternância.
- Favoritos: chave `gamedeals:favorites` e formato `FavoriteGame { id, slug, title, image, addedAt }` inalterados.
- URLs, canonical, JSON-LD, sitemap e robots inalterados.
- Não trocar Pinia, Swiper, Chart.js, GLightbox nem Yarn; não mexer em `server/` além de caminhos de import.
- Chave da ITAD nunca impressa nem commitada (ler só via `.env`).
- Commits em português, um por task, terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Navegador de teste: Brave (`C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe`); nunca Chrome.
- `yarn build` sobrescreve `.nuxt` e derruba um `yarn dev` rodando: pare o dev server antes de buildar.

## Review Focus

1. Visitante que já abriu o site tem `nuxt-color-mode=system` (ou `light`) salvo no `localStorage`: o site tem que abrir escuro mesmo assim (Task 3 usa `storageKey` novo; Task 5 verifica com esse valor semeado).
2. Anel de foco e bordas sem cor explícita (`border`, `ring-2` sem cor) mudam de aparência no Tailwind 4: navegação por teclado e cards precisam continuar iguais (Task 4 + screenshots com foco na Task 5).
3. Busca global: sugestões abrindo, setas e Enter navegando, clique fora fechando — `UInput` v4 emite eventos/atributos diferentes (Task 5, roteiro de busca).
4. Prateleiras: arrastar com o mouse, setas e hover com borda sem corte continuam funcionando após a troca de classes (Task 5).
5. Toasts (erro e limite de favoritos) aparecem com a cor certa e somem sozinhos — exige `<UApp>` (teste-guarda na Task 1 + disparo manual na Task 5).

---

### Task 1: Baseline visual e teste-guarda

**Files:**
- Create: `tests/unit/migration-guard.spec.ts`
- Create (fora do repo): `$CLAUDE_JOB_DIR/tmp/cdp.mjs`, `$CLAUDE_JOB_DIR/tmp/shots/before/*.png`

**Interfaces:**
- Produces: `cdp.mjs <url> <w> <h> <steps.json>` com os passos `eval`, `wait`, `shot`, `key`, `reload`, `drag [x1,y,x2]`, `click [x,y]`, `hover [x,y]`, `clip [x,y,w,h,file]`, `type "texto"`, sempre com `prefers-color-scheme: dark` emulado. Roteiro de capturas (lista abaixo) reutilizado na Task 5.

- [ ] **Step 1: Montar `cdp.mjs`** a partir do script de CDP já usado no redesign (Brave headless + WebSocket do Node 24), acrescentando `Emulation.setEmulatedMedia({ features: [{ name: 'prefers-color-scheme', value: 'dark' }] })` antes de navegar e um passo `type` (via `Input.insertText`).

- [ ] **Step 2: Capturar o "antes" em produção** (`https://br-gamedeals.vercel.app`), desktop 1280×900 e mobile 390×844, salvando em `shots/before/<pagina>-<largura>.png`:
  - `/` (página inteira + `hover` num card da primeira prateleira, `clip` da prateleira)
  - `/ofertas` (e com o popover de filtros aberto)
  - `/ofertas/menor-preco-historico`
  - `/game/cyberpunk-2077`
  - `/favoritos` com 2 favoritos semeados: `localStorage.setItem('gamedeals:favorites', JSON.stringify([...2 FavoriteGame...]))` + `reload`
  - `/search?q=witcher`
  - header com sugestões abertas: `click` no campo de busca, `type "witch"`, `wait 1500`
  - foco por teclado: `key Tab` até um card e `shot`

Expected: 16+ PNGs, todos em tema escuro, sem página de erro.

- [ ] **Step 3: Escrever o teste-guarda** `tests/unit/migration-guard.spec.ts`. Ele lê os arquivos com `node:fs` (recursivo em `app/`, extensões `.vue`/`.ts`) e `nuxt.config.ts`:

```ts
describe('migração Nuxt UI v4', () => {
  it('o código do app vive em app/', () => { expect(existsSync('app/app.vue')).toBe(true) })
  it('não usa tons numéricos de primary', () => { expect(grepApp(/\bprimary-\d{2,3}\b/)).toEqual([]) })
  it('não usa UNotifications', () => { expect(grepApp(/<UNotifications/)).toEqual([]) })
  it('toasts usam cores semânticas do v4', () => { expect(grepApp(/color:\s*'(red|orange|green|gray)'/)).toEqual([]) })
  it('badges não usam color="gray"', () => { expect(grepApp(/color="gray"/)).toEqual([]) })
  it('o app é envolvido por UApp', () => { expect(read('app/app.vue')).toMatch(/<UApp[\s>]/) })
  it('tema escuro fixo com chave própria', () => {
    const config = read('nuxt.config.ts')
    expect(config).toMatch(/preference:\s*'dark'/)
    expect(config).toMatch(/storageKey:\s*'gamedeals-color-mode'/)
  })
})
```

`grepApp(re)` devolve `arquivo:linha` de cada ocorrência (lista vazia quando `app/` ainda não existe).

- [ ] **Step 4: Rodar e ver falhar**

Run: `yarn test tests/unit/migration-guard.spec.ts`
Expected: FAIL em "o código do app vive em app/", "o app é envolvido por UApp" e "tema escuro fixo"; os outros passam vazios (não há `app/` ainda). Os 72 testes antigos continuam passando com `yarn test`.

- [ ] **Step 5: Commit** (só o teste; screenshots ficam fora do repo)

```bash
git add tests/unit/migration-guard.spec.ts
git commit -m "test: guarda da migração para Nuxt UI v4"
```

### Task 2: Estrutura de pastas do Nuxt 4 (ainda no Nuxt 3)

**Files:**
- Move: `app.vue`, `pages/`, `components/`, `composables/`, `stores/`, `utils/` → `app/` (com `git mv`)
- Move: `app/utils/catalog.ts` → `shared/utils/catalog.ts`
- Modify: `nuxt.config.ts` (`future: { compatibilityVersion: 4 }`), `server/utils/home.ts:1`, `server/utils/sitemap.ts:1`, `app/composables/useGamesApi.ts:1`, os 5 componentes/páginas que importam `~/utils/catalog`, imports de `tests/unit/*.spec.ts`

**Interfaces:**
- Produces: `shared/utils/catalog.ts` (mesmo conteúdo e exports). Importações: no app, `#shared/utils/catalog`; em `server/`, `tests/` e em qualquer arquivo importado pelos testes (`app/composables/useGamesApi.ts`), caminho relativo — o Vitest não conhece os aliases do Nuxt.

- [ ] **Step 1: Mover com `git mv`** e mover `catalog.ts` para `shared/utils/` (ele é usado pelo app e pelo servidor; `shared/` é o lugar do Nuxt 4 para isso).
- [ ] **Step 2: Ajustar imports**: `server/utils/home.ts` e `sitemap.ts` → `'../../shared/utils/catalog'`; `useGamesApi.ts` → `'../../shared/utils/catalog'`; componentes/páginas `~/utils/catalog` → `#shared/utils/catalog`; testes `../../utils/X` → `../../app/utils/X` (catálogo: `../../shared/utils/catalog`), `../../composables/X` → `../../app/composables/X`.
- [ ] **Step 3: Ligar `future: { compatibilityVersion: 4 }`** no `nuxt.config.ts`.
- [ ] **Step 4: Verificar**

Run: `yarn nuxt prepare && yarn test && yarn lint && yarn build`
Expected: 72 testes antigos verdes; guarda: só "UApp" e "tema escuro fixo" falhando; typecheck e build sem erro.

- [ ] **Step 5: Smoke no dev server**: `yarn dev --port 3100`, abrir `/`, `/ofertas` e `/game/cyberpunk-2077` via `cdp.mjs` e conferir que renderizam (sem screenshot comparativo ainda).
- [ ] **Step 6: Commit** `refactor: estrutura de pastas do Nuxt 4 (app/ e shared/)`

### Task 3: Nuxt 4 + Nuxt UI v4 + Tailwind 4

**Files:**
- Modify: `package.json`, `yarn.lock`, `nuxt.config.ts`, `app/app.vue`, `app/pages/game/[id].vue`, `app/pages/search/index.vue`, `app/components/catalog/CatalogPage.vue`, `app/composables/useFavoriteToggle.ts`
- Create: `app/assets/css/main.css`, `app/app.config.ts`

- [ ] **Step 1: Dependências**: `nuxt@^4.1`, `@nuxt/ui@^4`, `tailwindcss@^4`, `@iconify-json/heroicons` (se o v4 não embutir), e as versões de `@pinia/nuxt`, `@nuxtjs/sitemap`, `vue-tsc` compatíveis com Nuxt 4. Remover `future.compatibilityVersion` (é o padrão no 4) e revisar `compatibilityDate`.
- [ ] **Step 2: CSS de entrada** `app/assets/css/main.css` com `@import "tailwindcss";` e `@import "@nuxt/ui";`, registrado em `css` no `nuxt.config.ts`.
- [ ] **Step 3: Cores e tema**: `app/app.config.ts` com `ui.colors = { primary: 'green', neutral: 'zinc' }` (verde era a primária do v2; `zinc` é o neutro mais próximo do `gray` frio do Tailwind 3 — conferir na Task 5). No `nuxt.config.ts`: `colorMode: { preference: 'dark', fallback: 'dark', storageKey: 'gamedeals-color-mode' }` (chave nova para ignorar o `system`/`light` salvo pelo v2).
- [ ] **Step 4: API do Nuxt UI**:
  - `app.vue`: conteúdo dentro de `<UApp>`; remover `<UNotifications />`.
  - Toasts: `color: 'red'` → `'error'`, `color: 'orange'` → `'warning'`.
  - `UBadge color="gray" variant="soft"` → `color="neutral" variant="soft"`.
  - `UInput`: conferir props/eventos usados (`icon`, `@focus`, `@blur`, `@keydown.*`, `autocomplete`, `aria-label`); trocar pelos nomes do v4 onde mudaram (ex.: `icon` → `icon` ou `leading-icon`).
  - Classes `primary-N` → `green-N` (mesmo tom).
- [ ] **Step 5: Verificar**

Run: `yarn install && yarn nuxt prepare && yarn test && yarn lint && yarn build`
Expected: todos os testes verdes, incluindo o guarda inteiro; typecheck e build sem erro.

- [ ] **Step 6: Commit** `feat: Nuxt 4, Nuxt UI v4 e Tailwind 4`

### Task 4: Classes do Tailwind 4

**Files:**
- Modify: `app/**/*.vue` conforme a ferramenta; `app/assets/css/main.css`

- [ ] **Step 1: Rodar** `npx @tailwindcss/upgrade` (com o working tree limpo) e revisar o diff: renomeações (`shadow-sm`→`shadow-xs`, `rounded`→`rounded-sm`, `blur`→`blur-sm`, `outline-none`→`outline-hidden`, opacidade `bg-opacity-*` etc.). Desfazer o que a ferramenta fizer fora de `app/`.
- [ ] **Step 2: Neutralizar padrões que mudaram**, em `main.css` com `@layer base`:
  - `border` sem cor: manter a cor antiga (`border-color: var(--color-gray-200, currentColor)` como no guia oficial de upgrade).
  - Botões: `button:not(:disabled), [role="button"]:not(:disabled) { cursor: pointer; }`.
  - `ring` sem largura: trocar no markup por `ring-3` onde a intenção era o anel de 3px.
- [ ] **Step 3: Verificar**

Run: `yarn test && yarn lint && yarn build`
Expected: tudo verde.

- [ ] **Step 4: Commit** `style: classes e padrões do Tailwind 4`

### Task 5: Comparação visual, preview e PR

- [ ] **Step 1: Capturar o "depois"** com o mesmo roteiro da Task 1 contra `yarn dev --port 3100` (ou `yarn preview` após build), em `shots/after/`.
- [ ] **Step 2: Roteiros de comportamento** (via `cdp.mjs`, conferindo por `eval`/screenshot):
  - Tema: semear `localStorage['nuxt-color-mode']='light'` e `['gamedeals-color-mode']` ausente, recarregar → `document.documentElement.classList.contains('dark')` é `true`.
  - Prateleira: `drag` move o scroll (`scrollLeft` > 0) e o clique depois do arrasto não navega.
  - Busca: digitar, `key ArrowDown`, `key Enter` → URL vira `/game/...`.
  - Favoritos: clicar no coração marca e o contador do header sobe; acima de 50 aparece toast `warning`.
- [ ] **Step 3: Comparar** antes/depois lado a lado (página HTML local em `$CLAUDE_JOB_DIR/tmp/shots/compare.html`, aberta no Brave). Corrigir toda diferença que não seja tom de cor da paleta nova; cada correção volta a rodar `yarn test && yarn lint`.
- [ ] **Step 4: Commit das correções** `fix: ajustes visuais pós-migração` (se houver).
- [ ] **Step 5: Push e preview**: `git push -u origin feature/nuxt4`; aguardar o deploy da Vercel pelo MCP (`list_deployments` com `branch: feature/nuxt4`) até `READY`; ler o log se `ERROR`. Conferir no preview `/`, `/api/home` (200), `/sitemap.xml` e `/robots.txt`.
- [ ] **Step 6: Abrir o PR** para `main` com resumo das etapas, decisões e o link do preview; o merge fica com o autor.
