<template>
  <section class="relative isolate space-y-8">
    <div v-if="pending" class="space-y-4">
      <UIcon name="i-heroicons-arrow-path" class="h-5 w-5 animate-spin text-green-400" />
      <USkeleton class="h-60 rounded-xl" />
    </div>

    <div v-else-if="errorMessage" class="rounded-lg border border-red-600/30 bg-red-950/40 p-4 text-sm text-red-200">
      {{ errorMessage }}
    </div>

    <template v-else>
      <div
        class="pointer-events-none absolute left-1/2 -top-28 z-0 h-[calc(100%+7rem)] w-screen -translate-x-1/2 overflow-hidden sm:-top-24 sm:h-[calc(100%+6rem)]"
      >
        <div class="absolute inset-0 scale-105 bg-cover bg-center opacity-60 blur-md" :style="heroBackdropStyle" />
        <div class="absolute inset-0 bg-linear-to-b from-gray-900/10 via-gray-950/70 to-gray-950" />
      </div>

      <!-- mt-8: Tailwind 3 space-y gave this margin (it follows the absolute backdrop). -->
      <div class="relative z-10 mt-8 space-y-8">
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

            <!-- Two sibling cards instead of the buy box nested inside the info card. -->
            <aside class="min-w-0 space-y-4">
              <div class="space-y-4 rounded-xl border border-white/10 bg-gray-900/45 p-4 backdrop-blur-md">
                <img
                  :src="sidebarHeaderImage"
                  :alt="`Imagem de ${gameInfo?.title ?? 'jogo'}`"
                  class="h-auto w-full rounded-lg"
                >

                <p class="text-sm text-gray-300">
                  {{ gameDescription }}
                </p>

                <div class="grid grid-cols-[120px_1fr] gap-2 text-sm">
                  <p class="text-gray-500">Lançamento:</p>
                  <p class="font-medium text-gray-100">{{ releaseDateText }}</p>
                </div>

                <div class="flex flex-wrap gap-2">
                  <UBadge v-for="tag in topTags" :key="tag" color="neutral" variant="soft">{{ tag }}</UBadge>
                </div>
              </div>

              <GameBuyBox :offers="offers" />
            </aside>
          </div>
        </div>

        <GameShopOfferList :offers="offers" />

        <div class="grid gap-6 lg:grid-cols-2">
          <div id="historico" class="scroll-mt-28 space-y-3">
            <h2 class="text-xl font-semibold text-white">Histórico de preços</h2>
            <PriceHistoryChart
              :history="priceHistory"
              :current-price="topOffer?.price"
              :regular-price="topOffer?.regularPrice"
            />
          </div>

          <div class="space-y-3">
            <h2 class="text-xl font-semibold text-white">Avaliações e metadados</h2>
            <div class="space-y-3 rounded-xl border border-white/10 bg-gray-900/45 p-4 backdrop-blur-md">
              <div v-if="gameInfo?.reviewStats.length" class="space-y-2">
                <div
                  v-for="review in gameInfo.reviewStats.slice(0, 4)"
                  :key="`${review.source}-${review.score}`"
                  class="flex items-center justify-between rounded-md bg-gray-950/50 px-3 py-2 text-xs"
                >
                  <span class="text-gray-300">{{ review.source }}</span>
                  <span class="font-semibold text-gray-100">{{ review.score }} ({{ review.count }})</span>
                </div>
              </div>
              <p v-else class="text-sm text-gray-400">Sem avaliações agregadas disponíveis no momento.</p>

              <div class="space-y-1 text-sm text-gray-300">
                <p><span class="text-gray-500">Developers:</span> {{ gameInfo?.developers.join(', ') || 'N/A' }}</p>
                <p><span class="text-gray-500">Publishers:</span> {{ gameInfo?.publishers.join(', ') || 'N/A' }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import type { GameInfo, GameMedia, PriceHistoryPoint, PriceRow } from '~/composables/useGamesApi'
import { rankOffers } from '~/utils/offers'
import { buildGameSeoDescription, buildGameSeoTitle, buildProductJsonLd, serializeJsonLd } from '~/utils/seo'

const route = useRoute()
const toast = useToast()
const { getGameInfo, getPrices, getPriceHistory, getGameIdBySlug, getGameMedia } = useGamesApi()
const runtimeConfig = useRuntimeConfig()
const appName = computed(() => runtimeConfig.public.appName || 'DealsGamer')
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
} = await useAsyncData<{
  gameInfo: GameInfo
  prices: PriceRow[]
  priceHistory: PriceHistoryPoint[]
  gameMedia: GameMedia
}>(
  () => `game-detail-${String(route.params.id ?? '')}`,
  async () => {
    const routeParam = String(route.params.id ?? '').trim()
    const resolvedGameId = gameId.value || await getGameIdBySlug(routeParam)
    const emptyMedia: GameMedia = { shortDescription: '', screenshots: [], videos: [] }
    const [gameInfo, prices, priceHistory] = await Promise.all([
      getGameInfo(resolvedGameId),
      getPrices(resolvedGameId),
      // History and media are secondary: never fail the whole page because of them.
      getPriceHistory(resolvedGameId).catch(() => [])
    ])

    const gameMedia = gameInfo.appid
      ? await getGameMedia(gameInfo.appid).catch(() => emptyMedia)
      : emptyMedia

    return { gameInfo, prices, priceHistory, gameMedia }
  }
)

const gameInfo = computed(() => gamePayload.value?.gameInfo)
const priceRows = computed(() => gamePayload.value?.prices ?? [])
const priceHistory = computed(() => gamePayload.value?.priceHistory ?? [])
const gameMedia = computed<GameMedia>(() => gamePayload.value?.gameMedia ?? { shortDescription: '', screenshots: [], videos: [] })
const offers = computed(() => rankOffers(priceRows.value))
const topOffer = computed(() => offers.value[0])
const topTags = computed(() => gameInfo.value?.tags.slice(0, 6) ?? [])
const releaseDateText = computed(() => {
  if (!gameInfo.value?.releaseDate) {
    return 'Não informado'
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

  return 'Compare abaixo os preços deste jogo nas principais lojas digitais, com descontos, tipo de ativação e links para compra.'
})

const sidebarHeaderImage = computed(() => {
  const appid = gameInfo.value?.appid
  if (appid && Number.isFinite(appid) && appid > 0) {
    return `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`
  }

  return gameInfo.value?.image || fallbackCover
})

const heroBackdropImage = computed(() => {
  const firstScreenshot = gameMedia.value.screenshots[0]
  if (firstScreenshot) {
    return firstScreenshot
  }

  return sidebarHeaderImage.value
})

const heroBackdropStyle = computed(() => ({
  backgroundImage: `url('${heroBackdropImage.value}')`
}))

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
  return error.value ? 'Não foi possível carregar os dados deste jogo.' : ''
})

const seoTitle = computed(() => buildGameSeoTitle(gameInfo.value?.title ?? 'Jogo', offers.value))
const seoDescription = computed(() => buildGameSeoDescription(gameInfo.value?.title ?? 'este jogo', offers.value))
// ITAD's slug is the one every link uses; the visited param is only a fallback.
const canonicalUrl = computed(() => {
  const slug = gameInfo.value?.slug || String(route.params.id ?? '').toLowerCase()
  return `${runtimeConfig.public.siteUrl}/game/${slug}`
})
const ogImage = computed(() => {
  return sidebarHeaderImage.value === fallbackCover ? `${runtimeConfig.public.siteUrl}/og-default.png` : sidebarHeaderImage.value
})

useSeoMeta({
  title: () => `${seoTitle.value} | ${appName.value}`,
  description: () => seoDescription.value,
  ogTitle: () => seoTitle.value,
  ogDescription: () => seoDescription.value,
  ogImage: () => ogImage.value,
  ogUrl: () => canonicalUrl.value,
  ogType: 'website',
  twitterCard: 'summary_large_image'
})

useHead({
  link: [{ rel: 'canonical', href: canonicalUrl }],
  script: computed(() => (gameInfo.value
    ? [{
        type: 'application/ld+json',
        innerHTML: serializeJsonLd(buildProductJsonLd({
          name: gameInfo.value.title,
          url: canonicalUrl.value,
          image: ogImage.value,
          description: gameDescription.value,
          offers: offers.value
        }))
      }]
    : []))
})

watch(
  error,
  (value) => {
    if (value) {
      toast.add({
        title: 'Erro ao carregar jogo',
        description: 'Não foi possível carregar detalhes e preços.',
        color: 'error'
      })
    }
  },
  { immediate: true }
)
</script>
