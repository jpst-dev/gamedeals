<template>
  <section class="mx-auto max-w-xl space-y-4">
    <h1 class="text-2xl font-bold text-white sm:text-3xl">Minha conta</h1>

    <div v-if="account" class="space-y-6 rounded-xl border border-gray-800 p-6 text-sm text-gray-300">
      <div>
        <p class="text-xs uppercase tracking-wide text-gray-500">Email</p>
        <p class="text-base text-white">{{ account.email }}</p>
      </div>

      <USwitch
        :model-value="account.alertsEnabled"
        :disabled="saving"
        label="Avisar por email quando meus favoritos entrarem em promoção"
        description="No máximo um email por dia."
        @update:model-value="setAlerts"
      />

      <div class="flex flex-wrap gap-3 border-t border-gray-800 pt-6">
        <button type="button" class="rounded-lg border border-gray-700 px-4 py-2 font-medium text-gray-200 hover:bg-gray-800" @click="logout">
          Sair
        </button>
        <button
          v-if="!confirmingDelete"
          type="button"
          class="rounded-lg px-4 py-2 font-medium text-red-400 hover:bg-red-500/10"
          @click="confirmingDelete = true"
        >
          Excluir minha conta
        </button>
      </div>

      <div v-if="confirmingDelete" class="space-y-3 rounded-lg border border-red-500/40 bg-red-500/5 p-4" role="alert">
        <p class="text-gray-200">Isso apaga seu email, seus favoritos salvos na conta e os alertas. Não dá para desfazer.</p>
        <div class="flex flex-wrap gap-3">
          <button type="button" class="rounded-lg bg-red-500 px-4 py-2 font-bold text-white hover:bg-red-400" @click="deleteAccount">
            Sim, excluir
          </button>
          <button type="button" class="rounded-lg px-4 py-2 font-medium text-gray-300 hover:bg-gray-800" @click="confirmingDelete = false">
            Cancelar
          </button>
        </div>
      </div>
    </div>

    <div v-else class="h-48 animate-pulse rounded-xl bg-gray-800/60" />
  </section>
</template>

<script setup lang="ts">
requireAccountsPage()
useSeoMeta({ title: 'Minha conta | DealsGamer', robots: 'noindex' })

const toast = useToast()
const gamesStore = useGamesStore()
const { loggedIn, logout } = useAccount()
const { clear: clearSession } = useUserSession()
if (!loggedIn.value) {
  await navigateTo('/entrar')
}

const { data: account } = await useFetch<{ email: string; alertsEnabled: boolean }>('/api/account')
const saving = ref(false)
const confirmingDelete = ref(false)

const setAlerts = async (enabled: boolean): Promise<void> => {
  if (!account.value) {
    return
  }
  saving.value = true
  const previous = account.value.alertsEnabled
  account.value.alertsEnabled = enabled
  try {
    await $fetch('/api/account', { method: 'PATCH', body: { alertsEnabled: enabled } })
  } catch {
    account.value.alertsEnabled = previous
    toast.add({ title: 'Não foi possível salvar', description: 'Tente de novo em instantes.', color: 'error' })
  } finally {
    saving.value = false
  }
}

const deleteAccount = async (): Promise<void> => {
  try {
    await $fetch('/api/account', { method: 'DELETE' })
  } catch {
    toast.add({ title: 'Não foi possível excluir a conta', description: 'Tente de novo em instantes.', color: 'error' })
    return
  }
  await clearSession()
  gamesStore.clearFavorites()
  toast.add({ title: 'Conta excluída', color: 'success' })
  await navigateTo('/')
}
</script>
