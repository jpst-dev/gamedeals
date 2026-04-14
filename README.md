# GameDeals BR

Comparador de ofertas de jogos para PC, com dados da [IsThereAnyDeal](https://docs.isthereanydeal.com/), focado em boa UX e baixo consumo de API.

## Features do MVP

- Home com ofertas em destaque, sort e filtros avançados.
- Carregamento incremental com auto-load + botão manual `Carregar mais`.
- Busca global com autocomplete (dropdown) e navegação direta para detalhe.
- Página de detalhe com metadados, tabela de preços e histórico visual.
- URL amigável por slug (`/game/cyberpunk-2077`).
- Favoritos e filtros locais via Pinia.

## Stack

- Nuxt 3 (SSR) + Vue 3 + TypeScript strict
- Tailwind CSS + Nuxt UI
- Pinia
- Nitro API route (`server/api/itad-proxy.ts`)
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

- `app.vue`: shell global (header, busca/autocomplete, footer)
- `pages/index.vue`: catálogo principal e filtros
- `pages/search/index.vue`: resultados de busca
- `pages/game/[id].vue`: detalhe do jogo
- `composables/useGamesApi.ts`: normalização e consumo da API
- `server/api/itad-proxy.ts`: proxy seguro para ITAD
- `stores/games.ts`: estado global (favoritos/filtros)

## Deploy (GitHub + Vercel)

1. Suba o projeto no GitHub.
2. Importe o repo na Vercel.
3. Configure `ITAD_API_KEY` em Environment Variables (Production/Preview/Development).
4. Faça o deploy.

## Segurança e boas práticas

- Não use chave hardcoded no código.
- Rotacione a chave se ela já tiver sido exposta.
- Proteja a branch `main` (PR obrigatório, sem force push, sem delete).

## Próximos passos sugeridos

- CI no GitHub Actions (`yarn lint` + `yarn build`).
- Refinar filtro mobile com animação lateral.
- Adicionar analytics básico de busca/cliques.
