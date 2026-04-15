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
      <div class="space-y-3">
        <h1 class="text-3xl font-bold text-white">{{ gameInfo?.title }}</h1>
        <div class="grid gap-4 lg:grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)]">
          <GameMediaGallery
            class="min-w-0"
            :media-items="mediaItems"
            :fallback-cover="fallbackCover"
            :game-title="gameInfo?.title || 'jogo'"
            embedded
          />

          <aside class="min-w-0 space-y-4 rounded-xl border border-gray-800 bg-gray-900 p-4">
            <img
              :src="sidebarHeaderImage"
              :alt="`Header image for ${gameInfo?.title ?? 'game'}`"
              class="h-auto w-full rounded-lg"
            >

            <p class="text-sm text-gray-300">
              {{ gameDescription }}
            </p>

            <div class="space-y-2 text-sm">
              <div class="grid grid-cols-[120px_1fr] gap-2">
                <p class="text-gray-500">Ativacao:</p>
                <p class="font-medium text-gray-100">{{ topOffer?.activation || 'DRM nao informado' }}</p>
              </div>
              <div class="grid grid-cols-[120px_1fr] gap-2">
                <p class="text-gray-500">Regiao:</p>
                <p class="font-medium text-gray-100">{{ topOffer?.region || 'Global' }}</p>
              </div>
              <div class="grid grid-cols-[120px_1fr] gap-2">
                <p class="text-gray-500">Melhor preco:</p>
                <p class="font-semibold text-green-300">{{ formatCurrency(topOffer?.price ?? 0) }}</p>
              </div>
              <div class="grid grid-cols-[120px_1fr] gap-2">
                <p class="text-gray-500">Lancamento:</p>
                <p class="font-medium text-gray-100">{{ releaseDateText }}</p>
              </div>
            </div>

            <div class="flex flex-wrap gap-2">
              <UBadge v-for="tag in topTags" :key="tag" color="gray" variant="soft">{{ tag }}</UBadge>
            </div>
          </aside>
        </div>
      </div>

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
import type { GameInfo, GameMedia, PriceRow } from '~/composables/useGamesApi'

const route = useRoute()
const toast = useToast()
const { getGameInfo, getPrices, getGameIdBySlug, getGameMedia } = useGamesApi()
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
} = await useAsyncData<{ gameInfo: GameInfo; prices: PriceRow[]; gameMedia: GameMedia }>(
  () => `game-detail-${String(route.params.id ?? '')}`,
  async () => {
    const routeParam = String(route.params.id ?? '').trim()
    const resolvedGameId = gameId.value || await getGameIdBySlug(routeParam)
    const [gameInfo, prices] = await Promise.all([
      getGameInfo(resolvedGameId),
      getPrices(resolvedGameId)
    ])

    const gameMedia = gameInfo.appid
      ? await getGameMedia(gameInfo.appid)
      : { shortDescription: '', screenshots: [], videos: [] }

    return { gameInfo, prices, gameMedia }
  }
)

const gameInfo = computed(() => gamePayload.value?.gameInfo)
const priceRows = computed(() => gamePayload.value?.prices ?? [])
const gameMedia = computed<GameMedia>(() => gamePayload.value?.gameMedia ?? { shortDescription: '', screenshots: [], videos: [] })
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
  const steamDescription = gameMedia.value.shortDescription?.trim()
  if (steamDescription) {
    return steamDescription
  }

  if (gameInfo.value?.description) {
    return gameInfo.value.description
  }

  const activationText = topOffer.value?.activation || 'DRM'
  const regionText = topOffer.value?.region || 'Global'
  return `Esta oferta e uma chave digital para ativacao em ${activationText}, com cobertura de regiao ${regionText}. A comparacao abaixo mostra diferentes lojas, descontos e links para compra com entrega digital.`
})

const sidebarHeaderImage = computed(() => {
  const appid = gameInfo.value?.appid
  if (appid && Number.isFinite(appid) && appid > 0) {
    return `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`
  }

  return gameInfo.value?.image || fallbackCover
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

type MediaItem = {
  key: string
  kind: 'video' | 'image'
  name: string
  thumbnail: string
  url: string
  webm?: string
  mp4?: string
  hls?: string
  dash?: string
}

const mediaItems = computed<MediaItem[]>(() => {
  const videoItems = gameMedia.value.videos.map((video) => ({
    key: `video-${video.id}`,
    kind: 'video' as const,
    name: video.name || 'Trailer',
    thumbnail: video.thumbnail || '',
    url: video.webm || video.mp4 || video.hls || video.dash || '',
    webm: video.webm,
    mp4: video.mp4,
    hls: video.hls,
    dash: video.dash
  }))

  const screenshotItems = gameMedia.value.screenshots.map((screenshot, index) => ({
    key: `image-${index}`,
    kind: 'image' as const,
    name: `Screenshot ${index + 1}`,
    thumbnail: screenshot,
    url: screenshot
  }))

  const leadingVideos = videoItems.slice(0, 2)
  const trailingVideos = videoItems.slice(2)

  return [...leadingVideos, ...screenshotItems, ...trailingVideos].filter((item) => Boolean(item.url))
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
