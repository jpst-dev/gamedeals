<template>
  <section class="mx-auto max-w-md space-y-4">
    <h1 class="text-2xl font-bold text-white sm:text-3xl">Entrar</h1>

    <div v-if="sent" class="space-y-3 rounded-xl border border-gray-800 p-6 text-sm text-gray-300" role="status">
      <p class="text-base font-semibold text-white">Confira seu email</p>
      <p>Se o email for válido, enviamos um link. Ele vale por 15 minutos.</p>
      <button type="button" class="font-medium text-[#66c0f4] hover:underline" @click="sent = false">Usar outro email</button>
    </div>

    <form v-else class="space-y-4 rounded-xl border border-gray-800 p-6" @submit.prevent="submit">
      <p class="text-sm text-gray-300">
        Sem senha: enviamos um link de acesso para o seu email. Com uma conta, seus favoritos ficam salvos e você recebe um email quando eles entram em promoção.
      </p>
      <div class="space-y-1">
        <label for="login-email" class="text-sm font-medium text-gray-200">Email</label>
        <UInput
          id="login-email"
          v-model="email"
          class="w-full"
          type="email"
          autocomplete="email"
          placeholder="voce@email.com"
          required
        />
      </div>
      <p v-if="error" class="text-sm text-red-400" role="alert">{{ error }}</p>
      <button
        type="submit"
        :disabled="sending"
        class="w-full rounded-lg bg-[#66c0f4] px-4 py-2 font-bold text-gray-950 hover:bg-sky-300 disabled:opacity-60"
      >
        {{ sending ? 'Enviando...' : 'Receber link' }}
      </button>
      <p class="text-xs text-gray-500">
        Veja como usamos seus dados na
        <NuxtLink to="/privacidade" class="underline hover:text-gray-300">página de privacidade</NuxtLink>.
      </p>
    </form>
  </section>
</template>

<script setup lang="ts">
requireAccountsPage()
useSeoMeta({ title: 'Entrar | GameDeals BR', robots: 'noindex' })

const { loggedIn } = useAccount()
if (loggedIn.value) {
  await navigateTo('/conta')
}

const email = ref('')
const sent = ref(false)
const sending = ref(false)
const error = ref('')

const submit = async (): Promise<void> => {
  error.value = ''
  sending.value = true
  try {
    await $fetch('/api/auth/request-link', { method: 'POST', body: { email: email.value } })
    sent.value = true
  } catch (cause) {
    const status = (cause as { statusCode?: number }).statusCode
    error.value = status === 400 ? 'Confira o email digitado.' : 'Não foi possível enviar agora. Tente de novo em instantes.'
  } finally {
    sending.value = false
  }
}
</script>
