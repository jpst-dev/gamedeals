<template>
  <section class="mx-auto max-w-md space-y-4">
    <h1 class="text-2xl font-bold text-white sm:text-3xl">Alertas de promoção</h1>
    <div class="space-y-3 rounded-xl border border-gray-800 p-6 text-sm text-gray-300" role="status">
      <p v-if="state === 'loading'">Desligando os alertas...</p>
      <p v-else-if="state === 'done'">Pronto, você não vai mais receber alertas.</p>
      <p v-else>Link inválido.</p>
      <p v-if="state !== 'loading'" class="text-gray-400">
        Para ligar de novo, entre e use a página
        <NuxtLink to="/conta" class="text-[#66c0f4] hover:underline">Minha conta</NuxtLink>.
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
requireAccountsPage()
useSeoMeta({ title: 'Alertas de promoção | GameDeals BR', robots: 'noindex' })

const route = useRoute()
const state = ref<'loading' | 'done' | 'invalid'>('loading')

// Runs in the browser only: link scanners that fetch the page don't run it.
onMounted(async () => {
  const { u, sig } = route.query
  if (typeof u !== 'string' || typeof sig !== 'string') {
    state.value = 'invalid'
    return
  }
  try {
    await $fetch('/api/alerts/unsubscribe', { method: 'POST', query: { u, sig } })
    state.value = 'done'
  } catch {
    state.value = 'invalid'
  }
})
</script>
