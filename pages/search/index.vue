<template>
  <section class="space-y-6">
    <header class="space-y-2">
      <h1 class="text-2xl font-bold text-white">Resultado da busca</h1>
      <p class="text-sm text-gray-400">
        Termo: <span class="font-medium text-gray-200">{{ queryTerm || '-' }}</span>
      </p>
    </header>

    <div class="grid gap-3 rounded-xl border border-gray-800 bg-gray-900 p-4 sm:grid-cols-2">
      <UInput
        v-model.number="minPriceModel"
        type="number"
        min="0"
        step="1"
        placeholder="Preco minimo"
        aria-label="Minimum price filter"
      />
      <UInput
        v-model.number="maxPriceModel"
        type="number"
        min="0"
        step="1"
        placeholder="Preco maximo"
        aria-label="Maximum price filter"
      />
    </div>

    <div v-if="pending" class="space-y-4">
      <UIcon name="i-heroicons-arrow-path" class="h-5 w-5 animate-spin text-primary-400" />
      <div class="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        <USkeleton v-for="index in 8" :key="index" class="h-56 rounded-xl" />
      </div>
    </div>

    <div v-else-if="gamesStore.filteredResults.length === 0" class="rounded-lg border border-gray-700 p-4 text-sm text-gray-300">
      Nenhum resultado encontrado para esse termo/filtro.
    </div>

    <div v-else class="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
      <GameCard
        v-for="game in gamesStore.filteredResults"
        :key="game.id"
        :game="game"
        :is-favorite="gamesStore.favorites.includes(game.id)"
        @toggle-favorite="gamesStore.toggleFavorite"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
const route = useRoute()
const toast = useToast()
const gamesStore = useGamesStore()
const { searchGames } = useGamesApi()
const runtimeConfig = useRuntimeConfig()
const appName = computed(() => runtimeConfig.public.appName || 'GameDeals BR')

const minPriceModel = ref<number | undefined>(undefined)
const maxPriceModel = ref<number | undefined>(undefined)
const pending = ref(false)

const queryTerm = computed(() => {
  return typeof route.query.q === 'string' ? route.query.q.trim() : ''
})

useHead({
  title: computed(() => `Busca por ${queryTerm.value || 'jogos'} | ${appName.value}`),
  meta: [
    { name: 'description', content: 'Busque jogos para PC e compare precos por loja.' },
    { property: 'og:title', content: computed(() => `${appName.value} | Busca de jogos`) }
  ]
})

const executeSearch = async (): Promise<void> => {
  if (!queryTerm.value) {
    gamesStore.setSearchResults([])
    return
  }

  pending.value = true
  try {
    const results = await searchGames(queryTerm.value)
    gamesStore.setSearchResults(results)
  } catch {
    toast.add({
      title: 'Erro na busca',
      description: 'Nao foi possivel consultar os jogos.',
      color: 'red'
    })
    gamesStore.setSearchResults([])
  } finally {
    pending.value = false
  }
}

watch([minPriceModel, maxPriceModel], ([minValue, maxValue]) => {
  gamesStore.setPriceFilter(minValue ?? null, maxValue ?? null)
})

watch(
  () => queryTerm.value,
  async () => {
    await executeSearch()
  },
  { immediate: true }
)
</script>
