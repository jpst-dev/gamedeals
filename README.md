# DealsGamer

Comparador de ofertas de jogos para PC, com dados da [IsThereAnyDeal](https://docs.isthereanydeal.com/), focado em boa UX e baixo consumo de API.

## Features do MVP

- Home estilo loja: destaque com arte da Steam e prateleiras temáticas.
- Catálogo `/ofertas` com atalhos, filtros compactos (estado na URL) e coleções (`/ofertas/gratis`, `/ofertas/acabando`...).
- Carregamento incremental com auto-load + botão manual `Carregar mais`.
- Busca global com sugestões que já mostram capa, preço, desconto e menor preço da história; buscas recentes e atalhos `/` e `Ctrl+K`.
- Página do jogo com caixa de compra, lista de lojas ordenada por preço e histórico visual.
- URL amigável por slug (`/game/cyberpunk-2077`).
- Favoritos em `/favoritos` com o melhor preço atual (até 50, salvos no navegador).
- SEO: meta por página, JSON-LD de produto, canonical, `/sitemap.xml` e `/robots.txt`.

## Stack

- Nuxt 3 (SSR) + Vue 3 + TypeScript strict
- Tailwind CSS + Nuxt UI
- Pinia
- Nitro API routes REST (GET) com cache SWR (`server/api/**`)
- Chart.js + vue-chartjs
- Yarn 4 (`node_modules` linker)

## Como rodar localmente

### 1) Requisitos

- Node.js 20+
- Yarn 4+

### 2) Instalação

```bash
yarn install
```

### 3) Variáveis de ambiente

Crie o `.env` com base no `.env.example`:

```bash
ITAD_API_KEY=your_itad_key_here
# URL pública, sem barra no final: usada no canonical, sitemap, robots e Open Graph
NUXT_PUBLIC_SITE_URL=https://seu-dominio.com.br
```

> Nunca commite sua chave real.

### 4) Subir em desenvolvimento

```bash
yarn dev
```

### 5) Validar tipos/lint

```bash
yarn lint
```

### 6) Build de produção

```bash
yarn build
yarn preview
```

## Scripts

- `yarn dev`: inicia ambiente de desenvolvimento
- `yarn build`: build de produção
- `yarn preview`: preview da build
- `yarn lint`: typecheck do Nuxt/TypeScript

## Arquitetura rápida

- `app.vue`: shell global (cabeçalho, conteúdo, rodapé)
- `components/header/`: cabeçalho em duas faixas (`HeaderBar`), busca (`HeaderSearch`) e menu do celular (`HeaderMobileMenu`)
- `pages/index.vue`: home (destaque + prateleiras de `/api/home`); links antigos `/?sort=` redirecionam para `/ofertas`
- `pages/ofertas/index.vue`, `pages/ofertas/[colecao].vue`: catálogo e coleções (`components/catalog/**`, estado em `utils/catalog.ts`)
- `pages/favoritos.vue`: favoritos com preço atual (`utils/favorites.ts`)
- `pages/search/index.vue`: resultados de busca
- `pages/game/[id].vue`: detalhe do jogo (`components/game/**`, ranking de ofertas em `utils/offers.ts`, SEO em `utils/seo.ts`)
- `composables/useGamesApi.ts`: normalização e consumo da API
- `server/utils/itad.ts`: cliente da ITAD (chave, validação de parâmetros, tratamento de erros)
- `server/utils/deals.ts` + `server/api/deals.get.ts`: ofertas com filtros da ITAD (loja, ativação, preço, desconto, mínima histórica) e filtros locais (tipo, validade)
- `server/utils/home.ts` + `server/api/home.get.ts`: destaque e prateleiras da home (cache de 5 min)
- `server/api/shops.get.ts`: lojas
- `server/api/__sitemap__/urls.get.ts`, `server/routes/robots.txt.ts`: URLs dinâmicas do sitemap (`@nuxtjs/sitemap`) e robots
- `server/api/games/**`: busca, sugestões com preço (`suggest`, cache de 5 min por termo), lookup por slug, info, preços e histórico de um jogo
- `server/api/steam/[appid].get.ts`: screenshots/trailers da Steam
- `stores/games.ts`: estado global (favoritos/filtros)

## Deploy (GitHub + Vercel)

1. Suba o projeto no GitHub.
2. Importe o repo na Vercel.
3. Configure `ITAD_API_KEY` e `NUXT_PUBLIC_SITE_URL` em Environment Variables (Production/Preview/Development).
4. Faça o deploy.

## Segurança e boas práticas

- Não use chave hardcoded no código.
- Rotacione a chave se ela já tiver sido exposta.
- Proteja a branch `main` (PR obrigatório, sem force push, sem delete).

## Próximos passos sugeridos

- CI no GitHub Actions (`yarn lint` + `yarn build`).
- Refinar filtro mobile com animação lateral.
- Adicionar analytics básico de busca/cliques.
