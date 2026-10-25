<template>
  <article class="mx-auto max-w-2xl space-y-6 text-sm leading-6 text-gray-300">
    <h1 class="text-2xl font-bold text-white sm:text-3xl">Privacidade</h1>

    <section class="space-y-2">
      <h2 class="text-lg font-semibold text-white">O que guardamos</h2>
      <ul class="list-disc space-y-1 pl-5">
        <li>Seu email, quando você cria uma conta.</li>
        <li>Os jogos que você favorita enquanto está logado.</li>
        <li>Se os alertas estão ligados e quais promoções já avisamos.</li>
        <li>O preço diário dos jogos favoritados (sem ligação com você).</li>
      </ul>
      <p>Sem conta, seus favoritos ficam só no seu navegador e não chegam até nós.</p>
    </section>

    <section class="space-y-2">
      <h2 class="text-lg font-semibold text-white">Para quê</h2>
      <p>
        Para você entrar sem senha (enviamos um link por email) e para avisar, no máximo uma vez por dia, quando seus favoritos entram em promoção.
        Não vendemos nem compartilhamos seu email.
      </p>
    </section>

    <section class="space-y-2">
      <h2 class="text-lg font-semibold text-white">Por quanto tempo</h2>
      <p>Até você excluir a conta. Links de acesso expiram em 15 minutos.</p>
    </section>

    <section class="space-y-2">
      <h2 class="text-lg font-semibold text-white">Seus controles</h2>
      <p>
        Em <NuxtLink to="/conta" class="text-[#66c0f4] hover:underline">Minha conta</NuxtLink> você desliga os alertas ou exclui a conta,
        o que apaga seu email e seus favoritos. Todo email de alerta também tem um link para parar de receber.
      </p>
    </section>

    <section class="space-y-2">
      <h2 class="text-lg font-semibold text-white">De onde vêm os preços</h2>
      <p>Os preços vêm da IsThereAnyDeal. Ao comprar, você vai para a loja, que tem a própria política de privacidade.</p>
    </section>
  </article>
</template>

<script setup lang="ts">
requireAccountsPage()
useSeoMeta({ title: 'Privacidade | GameDeals BR', description: 'O que o GameDeals BR guarda sobre você e como excluir.' })
</script>
