# Migração para Nuxt 4 + Nuxt UI v4 + Tailwind 4 — Design

## Intenção

Tirar o GameDeals BR de versões saindo de suporte (Nuxt 3, Nuxt UI v2, Tailwind 3) e deixar a base pronta para o próximo trabalho: o redesign da navbar e da barra de pesquisa, que vai usar componentes novos do Nuxt UI v4 (header, command palette etc.). A migração em si não é um redesign: o usuário final não deve perceber diferença.

## Objetivos

- Rodar em **Nuxt 4.1+**, **Nuxt UI v4** e **Tailwind CSS 4**, versões estáveis mais recentes de cada um.
- Site visual e funcionalmente igual ao atual em produção: home (hero + prateleiras arrastáveis), `/ofertas` e coleções (filtros, popover, tags, "carregar mais"), página do jogo (galeria, buy box, lista de lojas, histórico), `/favoritos`, `/search`, toasts, SEO (meta, canonical, JSON-LD, sitemap, robots).
- `yarn test` (72 testes), `nuxt typecheck` e `yarn build` passando; deploy de preview na Vercel **READY**.

## Não-objetivos

- Não redesenhar navbar, busca ou qualquer tela (vem depois, em outro PR).
- Não corrigir os "deferred minors" do redesign.
- Não mexer no backend (`server/`) além do que a migração exigir.
- Não trocar Pinia, Swiper, Chart.js, GLightbox nem o gerenciador de pacotes (Yarn 4.13.0 com `yarnPath`).

## Anti-objetivos (falharia mesmo "funcionando")

- Imagens de capa/hero voltarem a ficar cortadas ou quebradas.
- Perder favoritos salvos no `localStorage` dos usuários (formato e chave não mudam).
- Quebrar o deploy na Vercel ou o SEO já indexado (URLs, canonical, sitemap).
- Estilos "quase certos" escondidos: bordas, anéis de foco ou cursores que mudaram de padrão no Tailwind 4 sem ninguém notar.

## Restrições

- Paleta: **usar a paleta nova do Tailwind 4** (oklch). Pequenas diferenças de cor são aceitas; a aparência geral (tema escuro estilo Steam) não muda. Cores customizadas (`#66c0f4` etc.) seguem iguais.
- Windows + Git Bash no desenvolvimento; Vercel no deploy (Node 24, Yarn via `yarnPath`).
- A chave da ITAD fica só no `.env`/Vercel; nunca impressa nem commitada.
- Mensagens de commit em português, uma por etapa, com a linha `Co-Authored-By` usual.

## Abordagens consideradas

1. **Um branch, um PR, em etapas (escolhida)** — Nuxt 4 → Nuxt UI v4 + Tailwind 4 → verificação visual. Um commit por etapa, testes e build passando em cada uma; produção muda uma vez só. Troca: diff maior se algo escapar, mitigado pelos commits separados.
2. **Dois PRs com deploy entre eles** — Nuxt 4 primeiro (mantendo Nuxt UI v2), depois o resto. Descartada: não há garantia de que Nuxt UI v2 funcione no Nuxt 4, e a etapa intermediária seria esforço jogado fora.
3. **Projeto novo e portar o código** — Descartada: mais trabalho e mais risco de esquecer configuração (SEO, sitemap, Vercel) sem ganho, já que a config atual é enxuta.

O usuário escolheu a 1.

## Decisões tomadas

- **Estrutura de pastas do Nuxt 4:** mover `app.vue`, `pages/`, `components/`, `composables/`, `stores/` e `utils/` para `app/`; `server/`, `public/`, `tests/` e `docs/` ficam na raiz. Os imports dos testes (`../../utils/...`, `../../composables/...`) passam a apontar para `app/`.
- **Nuxt UI v4:** envolver o app em `<UApp>` (substitui `<UNotifications />`); CSS de entrada `app/assets/css/main.css` com `@import "tailwindcss"` e `@import "@nuxt/ui"`.
- **Equivalências de componentes** (o comportamento e a aparência atuais são a referência):
  - `UContainer`, `UIcon`, `USkeleton`: mesmos nomes; conferir espaçamento do container e ícones `i-heroicons-*` (instalar `@iconify-json/heroicons` se o v4 não trouxer a coleção).
  - `UInput` (busca global no header e campos de `/search`): mantém aparência escura atual.
  - `UBadge color="gray" variant="soft"` → equivalente v4 (`color="neutral"`).
  - Toasts: `color: 'red'` → `'error'`, `color: 'orange'` → `'warning'`.
- **Cor primária:** o Nuxt UI v2 usava verde como `primary` e as classes `text-primary-300/400`, `ring-primary-400`, `border-primary-400`. No v4, primária continua verde; as classes com tom numérico precisam continuar funcionando ou ser trocadas por `green-*`/token equivalente, com o mesmo resultado visual.
- **Tema escuro fixo:** o site é sempre escuro; o color-mode do Nuxt UI não pode trazer tema claro nem alternância.
- **Mudanças de padrão do Tailwind 4** a neutralizar onde afetam o visual: cor padrão de `border` (era gray-200, vira `currentColor`), largura padrão de `ring` (3px → 1px), `cursor: pointer` em botões (v4 usa `default`; manter `pointer` como hoje), renomeações (`shadow-sm`→`shadow-xs`, `rounded`→`rounded-sm`, `blur`→`blur-sm`, `outline-none`→`outline-hidden` etc.). Usar a ferramenta oficial `@tailwindcss/upgrade` como ponto de partida e revisar o resultado.
- **Verificação visual:** screenshots antes/depois (Brave headless, desktop 1280px e mobile 390px) de home, `/ofertas`, uma coleção, página de jogo, `/favoritos` com itens e `/search`, incluindo estados de hover/foco relevantes (card na prateleira, popover de filtros, sugestões da busca).

- **Fim do trabalho (decisão do Claude):** termina com o PR aberto e o preview da Vercel READY, com os screenshots antes/depois para o autor revisar. O merge é do autor, como nos PRs anteriores.
- **Screenshots em modo escuro (decisão do Claude):** o "antes" é capturado com `prefers-color-scheme: dark` forçado. Hoje, sem color-mode configurado, `UInput`, `USkeleton`, `UBadge` e toasts seguem o tema do sistema e ficam claros em sistemas claros; isso passa a ser escuro sempre, de propósito (tema escuro fixo).

## Deixado para quem implementar

- Versões exatas e compatibilidade de `@pinia/nuxt`, `@nuxtjs/sitemap`, `vue-tsc` e `vitest` com Nuxt 4 (subir o que for preciso).
- Ajustes de tipos que o Nuxt 4 trouxer (`typeCheck` estrito continua ligado).
- Se `compatibilityDate` precisa mudar.
- Ordem fina dos commits dentro de cada etapa.
