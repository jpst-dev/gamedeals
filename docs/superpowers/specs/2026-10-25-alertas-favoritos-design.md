# Alertas de promoção dos favoritos — design

Primeira rodada do passo 3 (backend próprio) do GameDeals BR.

## Intenção

Fazer o visitante **voltar** ao site: quando um jogo dos favoritos dele entra em promoção, ele recebe um email, como a "Lista de desejos" da Steam. É a base para monetizar no futuro (domínio próprio, links de afiliado, canais de ofertas), que só faz sentido com audiência.

Ao mesmo tempo, o site ganha o que hoje não tem: **banco de dados, contas e uma tarefa diária no servidor**, e começa a guardar preços próprios, um primeiro passo para depender menos da ITAD.

## Hoje

- Favoritos vivem só no `localStorage` do navegador (`gamedeals:favorites`, máximo 50, tipo `FavoriteGame` em `app/utils/favorites.ts`, store em `app/stores/games.ts`).
- O servidor (`server/api/`) é um proxy com cache para a ITAD e a Steam; nada é gravado.
- Preços em lote: `itadFetch('/games/prices/v3', { method: 'POST', params: { country: 'BR', … }, body: ids })` (ver `server/api/games/prices.get.ts`).
- Deploy na Vercel (plano Hobby), Nuxt 4, Nitro.

## Objetivos

1. **Entrar com email, sem senha.** O visitante informa o email, recebe um link, clica e está logado.
2. **Favoritos na conta.** Logado, os favoritos ficam no banco e acompanham a pessoa em qualquer navegador. Ao entrar, os favoritos do navegador são juntados aos da conta (regras em "Decisões").
3. **Email diário de promoções.** Uma vez por dia, quem tem alertas ligados recebe **no máximo um email**, listando os favoritos que entraram em promoção, cada um com preço atual, preço normal, desconto, loja e botão para a página do jogo no site. Se algum estiver no menor preço da história, o email destaca.
4. **Cada promoção é avisada uma vez.** Um jogo entra no email quando passa de "sem desconto" para "em promoção". Durante a mesma promoção, só volta a aparecer se o melhor preço **cair abaixo** do último preço avisado. Quando a promoção acaba, o estado zera e a próxima promoção é avisada de novo.
5. **Sair dos emails fácil.** Todo email tem link "parar de receber" (funciona sem login, em um clique) e o cabeçalho `List-Unsubscribe`. Na página da conta há o liga/desliga dos alertas, sair, e excluir a conta (apaga email, favoritos e estado de alertas).
6. **Histórico próprio.** A tarefa diária grava um registro por jogo favoritado por dia: melhor preço, preço normal, desconto, loja.
7. **Página de privacidade** (`/privacidade`) dizendo o que é guardado (email, favoritos), para quê, e como excluir. Link no rodapé e na tela de entrar.

## Não-objetivos (agora)

- Preço-alvo por jogo ("me avise abaixo de R$100") — próxima etapa.
- Login com Google ou senha.
- Canais de ofertas (Telegram, WhatsApp, Discord), anúncios, afiliados próprios.
- Servir páginas do site a partir do banco; as páginas continuam usando a ITAD como hoje.
- Redesign da navbar e da busca (PR separado); aqui só entra o mínimo para "Entrar" e "Minha conta".
- Checagem mais de uma vez por dia.

## Anti-objetivos (seria fracasso mesmo funcionando)

- Mais de um email por dia para a mesma pessoa, ou o mesmo jogo/promoção avisado repetidamente.
- Mandar email para um endereço que não confirmou (só o link de login confirma).
- Expor emails: em URLs, logs, respostas de API públicas ou mensagens de erro ("este email não existe" também não).
- Quebrar os favoritos de quem não loga: deslogado, tudo funciona exatamente como hoje.
- Alterar os links de compra da ITAD (os termos da API proíbem).
- Custo mensal para começar.

## Restrições

- **Hospedagem:** Vercel Hobby. Cron roda **uma vez por dia** e o horário pode variar dentro da hora. Funções têm tempo máximo limitado; a tarefa precisa caber nele.
- **Envio de email exige domínio próprio** verificado no Resend. Até o domínio existir, o envio só funciona para o email do dono da conta Resend (suficiente para testar). O dono do projeto quer ser avisado quando chegar a hora de comprar o domínio.
- **Termos da ITAD:** não alterar dados nem links; dar crédito. Guardar dados em banco próprio não é proibido.
- **Chaves e segredos** só em `.env` (fora do git) e nas variáveis da Vercel. Nunca no código, logs ou commits.
- Favoritos continuam com máximo de 50 por pessoa.
- Textos do site e dos emails em português do Brasil, no mesmo tom do site.

## Abordagens consideradas

- **A. Tudo dentro do projeto Nuxt, na Vercel** — **escolhida.** Postgres no Neon (criado pela Vercel, plano grátis), login por link escrito no projeto com sessões do `nuxt-auth-utils`, emails pelo Resend (grátis até 3.000/mês e 100/dia), Vercel Cron diário chamando uma rota do servidor. Um código, um deploy, custo zero. Custo: escrevemos o login e a tarefa vive nos limites de uma função da Vercel.
- **B. Supabase** (banco + login prontos). Menos código de login, mas o sistema todo depende do Supabase e projetos grátis pausam após uma semana sem uso.
- **C. Servidor separado** (Railway/Fly) com workers. Liberdade para checar de hora em hora e base para os canais, mas custo mensal e dois deploys; é mais do que esta rodada pede.

Escolhida A por usar o que o projeto já tem, custar zero e caber na regra de "uma vez por dia". Se no futuro precisar de checagem por hora ou dos canais, a tarefa pode migrar para um servidor separado sem reescrever o resto.

## Decisões de como fazer

Do dono do projeto:
- Alertas por email, login simples (sem senha). Gatilho: favorito entra em promoção, estilo lista de desejos da Steam.
- Abordagem A.

Minhas (podem ser revistas na leitura):
- **Promoção** = o melhor preço atual em BRL entre **todas as lojas que a ITAD retorna para o Brasil** (sem parâmetro `shops`, como `server/api/games/prices.get.ts` faz hoje) tem desconto (`cut > 0`).
- **Promoção já em andamento conta como avisada** em três casos: jogo adicionado aos favoritos durante a promoção (a pessoa já viu o preço no site), favoritos trazidos do navegador no login, e a primeira execução da tarefa depois do lançamento. O primeiro email só traz promoções que começarem depois disso. A próxima promoção é avisada normalmente.
- **Link de login:** token aleatório, guardado no banco só como hash, válido por 15 minutos, uso único. Sessão em cookie selado (`nuxt-auth-utils`) por 30 dias.
- **Limite de pedidos de link:** por email e por IP, para ninguém usar o formulário para lotar a caixa de alguém. A resposta do formulário é sempre a mesma ("se o email for válido, enviamos um link"), exista conta ou não.
- **Conta é criada no primeiro login confirmado.** Alertas vêm **ligados** por padrão, e o email de login diz isso.
- **Favoritos logado:** o banco é a fonte; o `localStorage` continua sendo escrito como cópia, para o site abrir rápido. **A cada login** os favoritos do navegador são juntados aos da conta (união, sem duplicar); se passar de 50, ficam primeiro os da conta, depois os mais recentes do navegador. **Ao sair, a cópia do navegador é apagada**, para que um jogo removido em um aparelho não volte a partir de outro.
- **Rota do cron** protegida pelo `CRON_SECRET` (a Vercel envia `Authorization: Bearer <CRON_SECRET>`). Horário: 12:00 UTC (09:00 em Brasília).
- **Sem `RESEND_API_KEY`** (desenvolvimento), os emails são escritos no log do servidor em vez de enviados.
- **ORM:** Drizzle, com migrações versionadas no repositório.
- **Variáveis novas:** `DATABASE_URL`, `NUXT_SESSION_PASSWORD`, `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET`. `NUXT_PUBLIC_SITE_URL` passa a ser obrigatória em produção (links do email; também conserta sitemap/robots que hoje apontam para `localhost`).

## Fica com quem construir

- Esquema exato das tabelas e nomes.
- Visual da tela de entrar, da página da conta e do email (seguindo o estilo escuro atual do site; o email precisa funcionar nos clientes comuns: Gmail, Outlook, celular).
- Onde exatamente ficam "Entrar"/"Minha conta" no cabeçalho e o convite para ativar alertas na página de favoritos.
- Tamanho dos lotes de preço na ITAD, paralelismo e como a tarefa se divide se passar do tempo da função.
- Como testar com banco (ex.: Postgres em memória nos testes).
- Ordem das etapas e quantos PRs.

## Lançamento

Do dono do projeto: **vai para produção escondido até existir o domínio.**

- Uma configuração (ex.: `NUXT_PUBLIC_ACCOUNTS_ENABLED`, desligada por padrão) esconde "Entrar", "Minha conta" e o convite nos favoritos, e faz as rotas de login e a tarefa diária não fazerem nada enquanto desligada. Deslogado, o site fica exatamente como hoje.
- O dono testa em produção com o próprio email (único destino que o Resend aceita sem domínio verificado), ligando a configuração no preview.
- Quando o PR estiver pronto, o dono é avisado de que é hora de comprar o domínio. Comprar, verificar no Resend, ajustar `EMAIL_FROM`/`NUXT_PUBLIC_SITE_URL` e ligar a configuração ativa tudo, sem código novo.
- **Limite de 100 emails/dia do plano grátis** (minha decisão): emails de login têm prioridade; a tarefa diária para de enviar ao chegar perto do limite (reserva de 20 para logins) e quem ficou de fora recebe no dia seguinte, com as promoções acumuladas. O estado "avisado" só é gravado depois que o email sai.
