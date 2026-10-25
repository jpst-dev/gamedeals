# Navbar e busca — design

## Por quê

O cabeçalho atual (nome, Ofertas, Favoritos, Entrar e uma caixa de busca) não acompanha o nível do resto do site. No celular ele quebra em duas linhas (~110px). A busca só mostra nome e capa, e ignora a primeira tecla digitada depois que a página carrega. O dono quer um site "completo, com boa usabilidade e bem profissional", e aceitou gastar mais chamadas da ITAD para mostrar preço nas sugestões.

## Objetivos

- Cabeçalho em **duas faixas, estilo loja** (opção B escolhida no mockup):
  - **Faixa de cima:** logo DealsGamer, busca larga ocupando o meio, à direita favoritos (coração com contador) e conta (avatar com a inicial quando logado; "Entrar" quando não; nada quando as contas estão desligadas).
  - **Faixa de baixo:** atalhos para as seções: Ofertas (`/ofertas`), Menor preço da história, Grátis, Acabando, 75% off, Até R$ 20 (as coleções de `DEAL_COLLECTIONS`, em `/ofertas/<slug>`), e "Por loja ▾", um menu com as lojas de `/api/shops` que abre `/ofertas` filtrado por aquela loja.
- **Sugestões com preço:** cada linha mostra capa, nome, tipo (Jogo/DLC), loja do melhor preço, desconto (`-81%`), preço atual em R$ e o selo "MENOR PREÇO" quando o preço atual é o menor da história. Jogos sem preço aparecem sem preço (não somem). No fim da lista vem "Ver todos os resultados para "<termo>" →", que abre `/search?q=`.
- **Buscas recentes:** ao focar a busca vazia aparecem as últimas 5 buscas (só no navegador), com opção de limpar.
- **Teclado:** setas, Enter e Esc continuam funcionando; **/** e **Ctrl+K** (Cmd+K no Mac) focam a busca de qualquer página, exceto quando a pessoa já está digitando em outro campo.
- **Celular** (abaixo de `sm`): uma linha só (~56px) com ☰, logo, 🔍 e ♥.
  - **☰** abre um painel lateral com os atalhos da faixa de baixo, a conta e Favoritos.
  - **🔍** abre a busca em tela cheia, com as mesmas sugestões e buscas recentes, e ← para voltar.
- **Corrigir o bug da primeira tecla.**
- **Visual coerente com o site:** fundo escuro translúcido com blur, verde `#4ade80` como destaque, azul `#66c0f4` no contador. A seção atual fica marcada na faixa de baixo.

## Fora do escopo

- O redesign maior do site (cards maiores, ocupar espaços vazios) fica para depois.
- A página `/search` em si não muda, só passa a ser alcançada pelo "Ver todos".
- Busca por loja dentro das sugestões.

## Não pode acontecer (anti-objetivos)

- Uma chamada à ITAD por tecla digitada.
- A lista de sugestões "pular" quando chegam os preços.
- Perder o atalho de teclado do navegador quando a pessoa está digitando em outro campo (o filtro de preço, o email).
- O cabeçalho cobrir conteúdo. O `pt-*` do `<main>` precisa acompanhar a nova altura.

## Restrições

- Nuxt 4, Nuxt UI 4, Tailwind 4, componentes no estilo dos existentes.
- **Economia de ITAD:**
  - espera de ~300 ms depois da última tecla;
  - mínimo de 2 letras;
  - o servidor guarda cada termo por 5 min (`defineCachedEventHandler`, `swr`);
  - o navegador guarda os termos da sessão em memória, então repetir um termo não faz requisição;
  - respostas atrasadas de termos antigos são descartadas.
- Não mexer nos links de compra da ITAD.
- Acessibilidade: a busca segue o padrão combobox (`role="combobox"`, `aria-expanded`, `aria-activedescendant`, lista `role="listbox"`), e o painel do celular prende o foco e fecha com Esc.

## Abordagens consideradas

1. **Um endpoint no servidor que devolve sugestões com preço (escolhida).** Um `/api/games/suggest?q=` faz a busca por nome e busca os preços em lote, e devolve tudo pronto. Uma requisição por termo, sem salto na lista, 2 chamadas à ITAD por termo novo, e cache no servidor e no navegador.
2. Nomes primeiro e preços depois, com duas requisições do navegador. Os nomes aparecem um pouco antes, mas a lista pula quando os preços chegam. Descartada.
3. Usar `UInputMenu`/`UCommandPalette` do Nuxt UI. Teclado e acessibilidade viriam prontos, mas as linhas ricas brigariam com o layout do componente e o visual ficaria genérico. Descartada.

## Como (decidido)

- **`GET /api/games/suggest?q=<termo>&limit=8`:**
  - `/games/search/v1` (só itens comparáveis: jogos e DLCs, como hoje), depois `/games/prices/v3` com `country=BR` para esses ids, e `pickBestPrice` de `server/utils/alerts.ts` para o melhor preço.
  - Devolve `[{ id, slug, title, image, type, price: { amount, regular, cut, shop, isHistoryLow } | null }]`.
  - Cache de 5 min por termo normalizado (minúsculas, espaços aparados).
  - Se a busca de preços falhar, devolve as sugestões sem preço em vez de erro.
- **Componentes novos:**
  - `AppHeader` (as duas faixas);
  - `HeaderSearch` (caixa, lista, teclado, recentes; usado também na tela cheia do celular);
  - `HeaderMobileMenu` (painel ☰);
  - `useSearchSuggestions` (espera, cache da sessão, descarte de respostas antigas, recentes).
- `app.vue` fica só com o layout, o cabeçalho, o `<main>` e o rodapé.
- O bug da primeira tecla some porque a nova busca não usa a flag `suppressSuggestionsFetch`. A busca a partir da URL (`?q=`) preenche a caixa sem disparar sugestões.

## Deixado para quem constrói

- Ícones exatos (heroicons), espaçamentos e a animação do painel.
- Como a capa sem imagem aparece na sugestão (usar o `GameCover`/fallback existente).
- O texto do estado "nenhum resultado" e do carregando (skeleton de 3 linhas).

## Decisões minhas (para conferir)

- Espera de 300 ms (hoje 650 ms). A sugestão parece instantânea, e o cache do servidor e do navegador segura o custo de termos intermediários.
- O cabeçalho continua fixo no topo ao rolar, sem esconder.
- O avatar abre um menu pequeno (Minha conta, Sair) em vez de ir direto para `/conta`.
- "Por loja" mostra as lojas em ordem alfabética, num menu com rolagem. No celular é uma seção recolhível no painel ☰.
- O link "Por loja" usa o mesmo parâmetro de lojas que o filtro de `/ofertas` já usa.
