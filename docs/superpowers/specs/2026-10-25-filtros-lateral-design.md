# Filtros na lateral e site até 1600px — design

## Por quê
Com o novo cabeçalho, a fileira de atalhos de filtro das ofertas (Menor preço da história, Acabando, Até R$ 20, Até R$ 50, -75%, na Steam/Epic/GOG) repete o que a faixa de baixo do cabeçalho e o "Por loja" já oferecem. O dono também sente que sobra espaço vazio em telas grandes. Os filtros ficam sempre visíveis numa coluna à esquerda, e o site cresce até 1600px para usar esse espaço sem diminuir os cards.

## Objetivos
- **Coluna de filtros fixa à esquerda** nas páginas de ofertas (`/ofertas` e `/ofertas/<coleção>`), a partir de `lg` (1024px):
  - largura ~256px, `sticky` logo abaixo do cabeçalho;
  - rola por dentro se for maior que a tela.
- **Conteúdo da coluna:** o mesmo da janela "Filtros" de hoje, sempre aberto e aplicando na hora:
  - Preço máximo: atalhos Grátis, R$ 20, R$ 50, R$ 100 e um controle deslizante, com espera de 400 ms como hoje;
  - Desconto mínimo;
  - Lojas: caixas de marcar com campo "Buscar loja…" e "ver todas (N)";
  - Ativa em;
  - Mostrar Jogos/DLCs;
  - "Só menor preço da história".
  - "Limpar filtros" aparece no topo quando houver algum filtro ativo.
- **Acima dos cards:** título e descrição da coleção, as etiquetas dos filtros ativos (removíveis) e "Ordenar por" à direita.
- **Abaixo de `lg`:** sem coluna. Um botão "Filtros (N)" ao lado de "Ordenar" abre a mesma coluna num painel lateral (`USlideover`, da esquerda).
- **Removidos:** a fileira de atalhos (`QuickFilterBar`) e a janela flutuante (`FilterPopover`).
- **Coleções do cabeçalho** (Grátis, 75% off…) abrem com o filtro correspondente já marcado na coluna, e a pessoa pode refinar.
- **Site todo até 1600px** (container de 80rem para 100rem): cabeçalho, conteúdo e rodapé alinhados.
- **Cards nunca menores que hoje:**
  - ofertas com coluna: 4 colunas de `lg` a `2xl` e 5 colunas a partir de `2xl` (1536px);
  - grades de largura total (favoritos, busca): até 6 colunas a partir de `2xl`;
  - prateleiras da home: mais cards por linha em `2xl`, mantendo o tamanho atual de card de ofertas ou maior.
- **Página do jogo:** o conteúdo continua com no máximo 1280px, centralizado. O fundo desfocado pode ocupar a largura toda.

## Fora do escopo
- O resto do redesign da home (novos blocos de conteúdo).
- Mudar os cards em si.

## Não pode acontecer
- Uma chamada à ITAD a cada movimento do controle de preço (a espera fica).
- O cabeçalho mudar de largura entre páginas.
- Linhas longas de texto na página do jogo.

## Abordagens
Só uma faz sentido: a janela "Filtros" já aplica tudo na hora. O conteúdo dela vira um componente (`CatalogFilterPanel`) usado na coluna e no painel do celular. Alternativas como reescrever os filtros do zero ou manter a janela e só esconder os atalhos não ganham nada.

## Decisões minhas (para conferir)
- A largura vem da variável `--ui-container` do Nuxt UI, que muda num lugar só.
- A coluna fica na mesma ordem da janela de hoje, que já foi validada.
- "Ver todas as lojas" abre a lista inteira dentro da coluna. Não há janela separada.
