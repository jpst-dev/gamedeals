<template>
  <section class="mx-auto max-w-md space-y-4">
    <h1 class="text-2xl font-bold text-white sm:text-3xl">Entrar</h1>

    <div class="space-y-4 rounded-xl border border-gray-800 p-6 text-sm text-gray-300">
      <template v-if="failed || !token">
        <p role="alert">Este link expirou ou já foi usado.</p>
        <NuxtLink to="/entrar" class="inline-flex rounded-lg bg-[#66c0f4] px-4 py-2 font-bold text-gray-950 hover:bg-sky-300">
          Pedir um novo link
        </NuxtLink>
      </template>
      <template v-else>
        <p>Clique para entrar na sua conta.</p>
        <!-- A button, not an automatic sign-in: mail scanners open links on their own. -->
        <button
          type="button"
          :disabled="signingIn"
          class="w-full rounded-lg bg-[#66c0f4] px-4 py-2 font-bold text-gray-950 hover:bg-sky-300 disabled:opacity-60"
          @click="confirm"
        >
          {{ signingIn ? 'Entrando...' : 'Entrar' }}
        </button>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
requireAccountsPage()
useSeoMeta({ title: 'Entrar | DealsGamer', robots: 'noindex' })

const route = useRoute()
const toast = useToast()
const { fetchSession, syncAfterLogin } = useAccount()

const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''))
const signingIn = ref(false)
const failed = ref(false)

const confirm = async (): Promise<void> => {
  signingIn.value = true
  try {
    const result = await $fetch<{ created: boolean }>('/api/auth/verify', { method: 'POST', body: { token: token.value } })
    await fetchSession()
    await syncAfterLogin().catch(() => {})
    toast.add({
      title: result.created ? 'Conta criada' : 'Você entrou',
      description: result.created ? 'Os alertas de promoção dos seus favoritos estão ligados.' : undefined,
      color: 'success'
    })
    await navigateTo('/favoritos')
  } catch {
    failed.value = true
  } finally {
    signingIn.value = false
  }
}
</script>
