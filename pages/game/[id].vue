<template>
  <section class="space-y-8">
    <div v-if="pending" class="space-y-4">
      <UIcon name="i-heroicons-arrow-path" class="h-5 w-5 animate-spin text-primary-400" />
      <USkeleton class="h-60 rounded-xl" />
    </div>

    <div v-else-if="errorMessage" class="rounded-lg border border-red-600/30 bg-red-950/40 p-4 text-sm text-red-200">
      {{ errorMessage }}
    </div>

    <template v-else>
      <article class="space-y-5 rounded-xl border border-gray-800 bg-gray-900 p-4">
        <div class="grid gap-6 md:grid-cols-[300px_1fr]">
          <div>
            <img
              :src="gameInfo?.image || fallbackCover"
              :alt="`Cover image for ${gameInfo?.title ?? 'game'}`"
              class="h-60 w-full rounded-lg object-cover md:h-72"
            >
          </div>

          <div class="space-y-4">
            <h1 class="text-2xl font-bold text-white">{{ gameInfo?.title }}</h1>
            <p class="text-sm text-gray-300">
              {{ gameDescription }}
            </p>

            <div class="grid gap-3 sm:grid-cols-2">
              <div class="rounded-lg border border-gray-800 bg-gray-950 p-3">
                <p class="text-xs uppercase tracking-wide text-gray-400">Ativacao</p>
                <p class="text-sm font-medium text-gray-100">{{ topOffer?.activation || 'DRM nao informado' }}</p>
              </div>
              <div class="rounded-lg border border-gray-800 bg-gray-950 p-3">
                <p class="text-xs uppercase tracking-wide text-gray-400">Regiao</p>
                <p class="text-sm font-medium text-gray-100">{{ topOffer?.region || 'Global' }}</p>
              </div>
              <div class="rounded-lg border border-gray-800 bg-gray-950 p-3">
                <p class="text-xs uppercase tracking-wide text-gray-400">Melhor preco</p>
                <p class="text-sm font-medium text-green-300">{{ formatCurrency(topOffer?.price ?? 0) }}</p>
              </div>
              <div class="rounded-lg border border-gray-800 bg-gray-950 p-3">
                <p class="text-xs uppercase tracking-wide text-gray-400">Lancamento</p>
                <p class="text-sm font-medium text-gray-100">{{ releaseDateText }}</p>
              </div>
            </div>

            <div class="flex flex-wrap gap-2">
              <UBadge v-for="tag in topTags" :key="tag" color="gray" variant="soft">{{ tag }}</UBadge>
            </div>

            <!-- <UButton
              v-if="gameInfo?.gameUrl"
              :to="gameInfo.gameUrl"
              target="_blank"
              rel="noopener noreferrer"
              size="sm"
              variant="outline"
              color="primary"
            >
              Ver pagina no IsThereAnyDeal
            </UButton> -->
          </div>
        </div>
      </article>

      <div class="space-y-3">
        <h2 class="text-xl font-semibold text-white">Tabela de precos</h2>
        <PriceTable :rows="priceRows" />
      </div>

      <div class="grid gap-6 lg:grid-cols-2">
        <div class="space-y-3">
          <h2 class="text-xl font-semibold text-white">Historico de precos</h2>
          <PriceHistoryChart
            :points="priceHistoryPoints"
            :comparison-price="topOffer?.regularPrice"
            comparison-label="preco original"
          />
        </div>

        <div class="space-y-3">
          <h2 class="text-xl font-semibold text-white">Avaliacoes e metadados</h2>
          <div class="space-y-3 rounded-xl border border-gray-800 bg-gray-900 p-4">
            <div v-if="gameInfo?.reviewStats.length" class="space-y-2">
              <div
                v-for="review in gameInfo.reviewStats.slice(0, 4)"
                :key="`${review.source}-${review.score}`"
                class="flex items-center justify-between rounded-md bg-gray-950 px-3 py-2 text-xs"
              >
                <span class="text-gray-300">{{ review.source }}</span>
                <span class="font-semibold text-gray-100">{{ review.score }} ({{ review.count }})</span>
              </div>
            </div>
            <p v-else class="text-sm text-gray-400">Sem reviews agregados disponiveis no momento.</p>

            <div class="space-y-1 text-sm text-gray-300">
              <p><span class="text-gray-500">Developers:</span> {{ gameInfo?.developers.join(', ') || 'N/A' }}</p>
              <p><span class="text-gray-500">Publishers:</span> {{ gameInfo?.publishers.join(', ') || 'N/A' }}</p>
            </div>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import type { GameInfo, PriceRow } from '~/composables/useGamesApi'

const route = useRoute()
const toast = useToast()
const { getGameInfo, getPrices, getGameIdBySlug } = useGamesApi()
const runtimeConfig = useRuntimeConfig()
const appName = computed(() => runtimeConfig.public.appName || 'GameDeals BR')
const fallbackCover = 'https://placehold.co/600x300/111827/e5e7eb?text=No+Image'

const gameId = computed(() => {
  const routeParam = String(route.params.id ?? '')
  const uuidMatch = routeParam.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i)
  return uuidMatch?.[1] ?? ''
})

const {
  data: gamePayload,
  pending,
  error
} = await useAsyncData<{ gameInfo: GameInfo; prices: PriceRow[] }>(
  () => `game-detail-${String(route.params.id ?? '')}`,
  async () => {
    const routeParam = String(route.params.id ?? '').trim()
    const resolvedGameId = gameId.value || await getGameIdBySlug(routeParam)
    const [gameInfo, prices] = await Promise.all([
      getGameInfo(resolvedGameId),
      getPrices(resolvedGameId)
    ])

    return { gameInfo, prices }
  }
)

const gameInfo = computed(() => gamePayload.value?.gameInfo)
const priceRows = computed(() => gamePayload.value?.prices ?? [])
const topOffer = computed(() => priceRows.value[0])
const topTags = computed(() => gameInfo.value?.tags.slice(0, 6) ?? [])
const releaseDateText = computed(() => {
  if (!gameInfo.value?.releaseDate) {
    return 'Nao informado'
  }

  const parsedDate = new Date(gameInfo.value.releaseDate)
  return Number.isNaN(parsedDate.getTime())
    ? gameInfo.value.releaseDate
    : parsedDate.toLocaleDateString('pt-BR')
})

const gameDescription = computed(() => {
  if (gameInfo.value?.description) {
    return gameInfo.value.description
  }

  const activationText = topOffer.value?.activation || 'DRM'
  const regionText = topOffer.value?.region || 'Global'
  return `Esta oferta e uma chave digital para ativacao em ${activationText}, com cobertura de regiao ${regionText}. A comparacao abaixo mostra diferentes lojas, descontos e links para compra com entrega digital.`
})

const priceHistoryPoints = computed(() => {
  const current = topOffer.value?.price ?? 0
  const storeLow = topOffer.value?.storeLow ?? current
  const rawHistoryLow = topOffer.value?.historyLow ?? storeLow
  const historyLow = rawHistoryLow > 0 ? rawHistoryLow : Math.min(storeLow, current)

  return [
    { label: 'Historico low', value: historyLow },
    { label: 'Store low', value: storeLow },
    { label: 'Atual', value: current }
  ]
})

const errorMessage = computed(() => {
  return error.value ? 'Nao foi possivel carregar os dados deste jogo.' : ''
})

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value || 0)
}

useHead({
  title: computed(() => `${gameInfo.value?.title ?? 'Detalhe do jogo'} | ${appName.value}`),
  meta: [
    {
      name: 'description',
      content: 'Compare precos por loja e veja historico de valores de jogos para PC.'
    },
    { property: 'og:title', content: computed(() => gameInfo.value?.title ?? appName.value) }
  ]
})

watch(
  error,
  (value) => {
    if (value) {
      toast.add({
        title: 'Erro ao carregar jogo',
        description: 'Nao foi possivel carregar detalhes e precos.',
        color: 'red'
      })
    }
  },
  { immediate: true }
)
</script>
