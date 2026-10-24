# Redesign "estilo loja" + filtros fluidos + SEO — Design

Data: 2026-10-24 · Projeto: GameDeals BR (Nuxt 3.21, Nuxt UI 2.22, Tailwind 3.4, Swiper 12)
Base: `main` atualizada (o PR #7, que trouxe rotas REST com cache em `server/api/**` e `server/utils/itad.ts`, foi mergeado em 2026-10-24). Trabalho em branch nova `feature/redesign-loja`, um PR para `main`.

## Intenção

O visitante vem principalmente para **descobrir ofertas** e às vezes para checar um jogo específico (a busca continua no topo).
Hoje a home é uma grade com filtros que só agem sobre o que já foi carregado, os cards escondem informação no hover (inútil no celular), imagens às vezes saem cortadas, a tabela de preços do jogo é densa e o site não tem SEO além de `<title>`.

Sucesso, nas palavras do dono: a home vira uma vitrine estilo loja; imagens nunca aparecem quebradas ou cortadas; na página do jogo fica óbvio **onde comprar, quanto custa e onde clicar**; os filtros ficam fluidos e não ocupam espaço à toa.

## Objetivos

1. Home estilo loja: destaque no topo + prateleiras horizontais temáticas.
2. Capa "à prova de corte" usada em cards e no destaque.
3. Página de catálogo `/ofertas` com atalhos de um clique, filtros ativos removíveis e balão compacto de filtros, tudo filtrado pela ITAD no catálogo inteiro e refletido na URL.
4. Página do jogo: mantém o topo inspirado na Steam (trailer sem som ao entrar, imagens embaixo, descrição à direita) e troca a tabela por **caixa de compra na lateral + lista de lojas embaixo**.
5. SEO: meta por página, `og:image`, JSON-LD de produto, sitemap, canonical.
6. Página "Meus favoritos" (`/favoritos`) com os jogos salvos e o melhor preço atual de cada um.

## Não-objetivos

- Migração para Nuxt UI v3 (será feita depois, em trabalho separado).
- Backend próprio, alertas de preço, contas de usuário (passo 3 do roadmap).
- Sincronizar favoritos entre dispositivos (continuam no `localStorage`; contas vêm no passo 3).
- Mudanças na busca/autocomplete além de visual pontual.

## Anti-objetivos (falharia mesmo "funcionando")

- Qualquer imagem cortando nome/logo do jogo ou mostrando ícone de imagem quebrada.
- Filtros que voltem a agir só sobre os jogos já carregados (exceto onde a ITAD não suporta; ver tabela).
- Aumentar o acoplamento ao Nuxt UI v2: componentes novos não podem depender de `UTable`, `UBadge`, `UCheckbox`, `USelect` etc.
- Painel de filtros grande ocupando a tela no desktop.

## Restrições

- Componentes **novos** em Tailwind puro + Vue. Uso de Nuxt UI v2 limitado ao que já existe (`UContainer`, `UNotifications`/`useToast`, `UIcon`), para não encarecer a migração para o v3.
- Sem novas dependências de UI. Prateleiras usam CSS scroll-snap (não Swiper). Swiper continua só na galeria existente e no carrossel do destaque.
- Única dependência nova permitida: `@nuxtjs/sitemap`.
- Tudo que fala com a ITAD passa por `server/utils/itad.ts` (chave, validação, erros). Respeitar cache SWR nas rotas.
- Textos em pt-BR com acentuação; `aria-label` em pt-BR.
- Funciona no celular (≥ 360px) e desktop.

## Abordagens consideradas

1. **Redesign sobre a base atual (escolhida).** Mantém Nuxt UI v2/Tailwind 3; componentes novos em Tailwind puro; SEO com `@nuxtjs/sitemap` + JSON-LD via `useHead`. Risco só visual; não aumenta custo da futura migração.
2. **Migrar para Nuxt UI v3 antes.** Traria Drawer/Popover/Carousel prontos, mas mistura migração e redesign no mesmo trabalho e atrasa o redesign. Descartada por ora.
3. **`@nuxtjs/seo` completo.** Pesado (gera imagem OG em servidor); nossa `og:image` pode ser arte da Steam. Descartada; só o sitemap basta.

Entrega: **um único PR**, com **um commit por parte** (1. capa+cards+home, 2. catálogo/filtros, 3. página do jogo, 4. favoritos, 5. SEO), para revisão única e `git revert` granular.

## Fatos verificados na API da ITAD (2026-10-24, país BR)

| Necessidade | Como funciona | Status |
|---|---|---|
| Menor preço da história | `filter={"flag":"H"}` em `/deals/v2`; cada oferta traz `deal.flag` (`H` = mínima histórica, `N` = nova mínima, `S` = mínima da loja) | ✅ |
| Preço máximo | `filter={"price":{"min":<n>,"max":<n>}}` em reais. **Precisa de `min` e `max`** (só `max` é ignorado) | ✅ |
| Desconto mínimo | `filter={"cut":{"min":<n>,"max":null}}` (já em uso) | ✅ |
| Lojas | `shops=61,35` (já em uso) | ✅ |
| Onde ativa (DRM) | `filter={"drm":[<id>]}` muda os resultados; ids de DRM e semântica exata **não confirmados** | ⚠ verificar |
| Tipo (jogo/DLC) | `type`/`typeNot` no filtro → **HTTP 500** | ❌ filtrar no nosso servidor |
| Acabando | `sort=expiry` funciona mas devolve ofertas **já vencidas** primeiro | ⚠ descartar `expiry < agora` no servidor |
| Total de resultados | não existe na resposta (só `hasMore`/`nextOffset`) | ❌ não mostrar contagem |
| `appid` Steam | não vem em `/deals/v2`; vem em `/games/info/v2` | — |
| Capa vertical ITAD | `assets.boxart` = 300×450 (2:3, o formato do card) | ✅ |
| Artes Steam por `appid` | `library_hero.jpg`, `library_600x900.jpg`, `header.jpg` em `shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/<appid>/` (respondem 301→200, inclusive jogos antigos) | ✅ |

Filtros combinam em um único objeto JSON `filter`.

## Partes do "como" decididas

### 1. `GameCover` — capa à prova de corte (novo componente)

- Props: lista ordenada de URLs candidatas, título, proporção alvo (padrão 2:3), `eager` opcional.
- Moldura com proporção fixa (sem layout shift).
- Ao carregar, compara proporção real × alvo: dentro de ±12% → `object-cover`; fora → imagem inteira (`object-contain`) centralizada sobre a **mesma imagem desfocada** preenchendo o fundo.
- Em erro, tenta a próxima URL; esgotadas, mostra **capa gerada**: gradiente com cor derivada do título (determinística) + título em texto. Nunca ícone de imagem quebrada. Substitui o `placehold.co` atual.
- A lógica de decisão (proporção → modo) é função pura testável.
- Cadeia nos cards: `assets.boxart` → `banner600` → `banner400` → `banner300` → capa gerada.

### 2. Cards (`GameCard`)

Mantém o visual atual (o dono gosta), com melhorias:
- Usa `GameCover`.
- **Favoritar sempre visível** (ícone de coração no canto superior direito), não só no hover.
- Selo "📉 mínima" quando `deal.flag` é `H` ou `N`; contagem "termina em Xh/Xd" quando houver `expiry` futura.
- Hover/foco continua revelando ativação e plataforma.
- `Game` ganha `historyLowFlag?: 'H' | 'N' | 'S'` (normalizado de `deal.flag`).

### 3. Home `/` estilo loja

Uma rota nova `GET /api/home` (cache SWR 5 min) monta tudo no servidor e devolve `{ hero: HeroItem[], shelves: Shelf[] }`, em uma requisição só (SSR-friendly). Cada prateleira pede ~40 ofertas à ITAD, filtra `type === 'game'` e corta em 12.

**Destaque (hero):** carrossel de até 5 jogos (Swiper, autoplay 6 s, pausa no hover, setas + bolinhas).
- Candidatos: `sort=-hot` com `cut ≥ 30`, preferindo `flag` H/N. Busca `/games/info/v2` dos 8 primeiros (em paralelo) para obter `appid`; entram os 5 primeiros com `appid`.
- Fundo: `library_hero` da Steam com `object-cover` + degradê (arte feita para corte, sem logo/texto). Fallback: `header.jpg` desfocado → banner ITAD desfocado.
- Informação em texto real: capa 2:3 (`GameCover`, Steam `library_600x900` → boxart ITAD), título, preço, preço original riscado, desconto, selo de mínima, botão "Ver ofertas" (vai para a página do jogo).
- Celular: fundo vira faixa menor; capa + texto empilham abaixo.
- Se nenhum candidato tiver `appid`, o hero não é renderizado (a home começa nas prateleiras).

**Prateleiras** (nesta ordem; prateleira vazia não aparece):

| Título | Consulta ITAD | "Ver tudo" |
|---|---|---|
| Em alta | `sort=-hot` | `/ofertas` |
| Menor preço da história | `sort=-hot`, `flag:"H"` | `/ofertas/menor-preco-historico` |
| Grátis para resgatar | `price:{min:0,max:0}` | `/ofertas/gratis` |
| Acabando em breve | `sort=expiry`, descarta vencidas e > 7 dias | `/ofertas/acabando` |
| 75% ou mais de desconto | `sort=-hot`, `cut:{min:75}` | `/ofertas/75-off` |
| Até R$ 20 | `sort=-hot`, `price:{min:0.01,max:20}` | `/ofertas/ate-20-reais` |

- Rolagem horizontal com CSS scroll-snap; setas no desktop, arrasto/swipe no celular; skeletons no carregamento.
- O antigo `/?sort=...` redireciona para `/ofertas?ordem=...`.

### 4. Catálogo `/ofertas` e `/ofertas/[colecao]`

- `/ofertas/[colecao]` = mesma página com um **preset** aplicado (coleções da tabela acima) e título/descrição próprios. Colecão desconhecida → 404.
- **Parâmetros na URL** (fonte da verdade do estado; `router.replace` para mudanças de filtro, histórico funciona):
  `ordem` (`populares|desconto|menor-preco|maior-preco|recentes|titulo|acabando`), `lojas` (ids, vírgula), `desconto` (25|50|75|90), `preco` (teto em reais; ausente = sem limite), `minima=1`, `ativa` (ids DRM), `tipo` (`jogos`|`dlcs`, padrão `jogos`).
- **Barra de atalhos fixa** (sticky) com chips de um toque, `aria-pressed`: Menor preço da história, Acabando, Até R$ 20, Até R$ 50, -75% ou mais, Steam, Epic, GOG, "⚙ Filtros (n)". À direita, seletor de ordem.
- **Filtros ativos** como etiquetas com ✕ + "Limpar tudo". Sem contagem total (a ITAD não fornece).
- **Balão de filtros**: ~270 px, ancorado ao botão "Filtros" no desktop, fecha ao clicar fora/Esc, foco preso enquanto aberto. No celular (< 640 px) vira painel que sobe de baixo. Conteúdo: preço máximo (slider com "Sem limite"), desconto mínimo (chips), lojas (chips, lista de `/api/shops`, 6 primeiras + "mais"), ativa em (chips), mostrar jogos/DLCs. Aplica na hora (debounce 400 ms no slider).
- Tudo filtrado pela ITAD no servidor, exceto `tipo` (servidor nosso) e "acabando" (descarte de vencidas no servidor nosso). Some o aviso "filtros aplicados apenas aos jogos carregados" e o filtro de título local.
- **Chips Steam/Epic/GOG filtram por loja** (`lojas`, ids confirmados), rótulo "na Steam" etc.; "onde ativa" fica só no balão. Um chip e o item correspondente no balão refletem o mesmo parâmetro. *(Decisão do designer: ids de loja são confirmados; DRM não.)*
- **Filtros removidos da home atual**, por não fazerem sentido no novo modelo: "Plataforma" (sem filtro na ITAD; praticamente tudo é Windows), "Somente com validade" (substituído pelo atalho "Acabando"), "Somente com desconto" (toda oferta listada já tem desconto), "Pesquisar título carregado" (a busca global cobre). *(Decisão do designer.)*
- **Paginação com filtro no nosso servidor** (`tipo`, `acabando`): `/api/deals` continua buscando páginas da ITAD até completar o lote pedido (20) ou atingir **3 chamadas** à ITAD por requisição; devolve o `nextOffset` da ITAD e `hasMore`. Página curta é aceitável; página vazia com `hasMore=true` dispara o próximo carregamento normalmente. *(Decisão do designer.)*
- **"Acabando" tem uma definição única** (`sort=expiry`, só `expiry` futura e ≤ 7 dias), usada pelo chip, por `ordem=acabando` e pela coleção `/ofertas/acabando`.
- **Coleções × filtros**: o preset de `/ofertas/[colecao]` aparece como chips/etiquetas normais já ativos. Qualquer mudança de filtro navega para `/ofertas?<todos os parâmetros>` (sai da URL da coleção); a canonical da coleção continua sendo a própria coleção. *(Decisão do designer.)*
- Carregamento incremental atual (auto-load 3 lotes + botão) mantido.
- `/api/deals` passa a aceitar os novos parâmetros (validados em `server/utils/itad.ts`) e monta um único `filter` JSON.

### 5. Página do jogo

- Topo inalterado (galeria com trailer sem som, miniaturas, descrição à direita, fundo desfocado).
- **Caixa de compra** na coluna da direita, abaixo da descrição: "Melhor preço agora", preço grande, desconto, loja e onde ativa, selo "menor preço da história" quando aplicável, botão principal "Comprar na <loja> ↗" (nova aba, `rel="noopener noreferrer nofollow"`), link "Comparar N lojas ↓" que rola até a lista. Sem ofertas → estado vazio claro.
- **Lista de lojas** substitui `PriceTable`/`UTable`: linha por loja com ícone (inicial + cor determinística por loja; a ITAD não fornece logos), nome, "Ativa na X", preço, desconto, original riscado, diferença para o melhor preço ("+ R$ 10,00"), cupom se `voucher` existir, botão "Comprar ↗". Mais barata primeiro e destacada. Mostra 5 e "Ver mais N lojas". No celular cada linha vira bloco empilhado.
- Histórico de preços e avaliações permanecem.

### 6. Favoritos (`/favoritos`) — escolhido pelo dono

- O store passa a guardar, por favorito, `{ id, slug, title, image, addedAt }` (o card já tem esses dados), em vez de só o id. Favoritos antigos (só id) são migrados uma vez: busca `/api/games/[id]` de cada um (máx. 50) para preencher título/slug/imagem; se falhar, o item fica com capa gerada e some na próxima migração bem-sucedida.
- Limite de 50 favoritos (o lote de preços aceita 50 ids); ao atingir, o coração avisa com toast.
- A página mostra os cards (`GameCard`) com o **melhor preço atual** obtido em **uma** chamada `/api/games/prices?ids=...`, ordenados por "em promoção primeiro" e depois por data de adição; sem oferta atual → "sem ofertas no momento".
- Estado vazio explicando como favoritar, com link para `/ofertas`.
- Link "♥ Favoritos (n)" no cabeçalho. Página `noindex` (conteúdo é do navegador do usuário).
- Renderização só no cliente (`localStorage`), com skeleton.

### 7. SEO

- `useSeoMeta` em todas as páginas: título e descrição únicos. Jogo: "`<Título>` por R$ X — compare preços em N lojas | GameDeals BR".
- `og:image`/`twitter:image` (`summary_large_image`): jogo → Steam `header.jpg` (fallback boxart ITAD); home/catálogo → imagem padrão do site (estática em `public/`, a criar).
- JSON-LD `Product` + `AggregateOffer` (`lowPrice`, `highPrice`, `priceCurrency: BRL`, `offerCount`, `offers` com `seller` e `url`) na página do jogo, gerado por função pura testável. Sem ofertas → sem `offers`.
- `link rel=canonical`: jogo → `/game/<slug>`; catálogo → URL da coleção sem parâmetros de filtro.
- `@nuxtjs/sitemap` com fonte dinâmica: home, `/ofertas`, coleções e páginas de jogos das primeiras ~500 ofertas `-hot` (cache 6 h).
- `robots.txt` aponta para o sitemap.
- URL base do site via `NUXT_PUBLIC_SITE_URL` (novo em `.env.example`).

## Testes

- Unitários (Vitest, padrão atual): mapeamento URL→parâmetros→`filter` ITAD; validação dos novos parâmetros; composição de prateleiras/hero com `itadFetch` simulado (incluindo descarte de vencidas e filtro de tipo); decisão de proporção do `GameCover`; gerador de JSON-LD.
- `yarn lint`, `yarn build`, e verificação manual com chave real em celular e desktop.

## Deixado para quem implementar

- Paleta exata, tipografia, espaçamentos e animações (seguir o tema escuro atual com o azul `#66c0f4` como destaque).
- Cores determinísticas por loja/título (algoritmo livre).
- Ids de DRM para o filtro "ativa em" (confirmar na API; se não for confiável, filtrar no nosso servidor).
- Imagem OG padrão do site.
- Detalhes de acessibilidade além dos citados (ordem de foco, anúncios).

## Decisões tomadas pelo designer (para o dono revisar)

- Prateleira extra "Grátis para resgatar"; "Acabando hoje" virou "Acabando em breve" (≤ 7 dias).
- Destaque com até 5 jogos em carrossel (autoplay 6 s).
- Chips Steam/Epic/GOG filtram por loja; "onde ativa" só no balão.
- Remoção dos filtros Plataforma, Somente com validade, Somente com desconto e título local.
- Paginação com até 3 chamadas à ITAD por lote quando filtramos no nosso servidor.
- Mudar filtro numa coleção leva para `/ofertas?...`.
- Favoritos: limite de 50, migração dos favoritos antigos.
- Commits por parte: 1. capa+cards+home, 2. catálogo/filtros, 3. página do jogo, 4. favoritos, 5. SEO.
