<template>
  <div class="space-y-10">
    <template v-if="pending && !home">
      <div class="h-64 animate-pulse rounded-2xl bg-gray-800/60 sm:h-80 lg:h-104" />
      <div v-for="row in 3" :key="row" class="space-y-3">
        <div class="h-6 w-48 animate-pulse rounded-sm bg-gray-800/60" />
        <div class="flex gap-3 overflow-hidden">
          <div
            v-for="item in 6"
            :key="item"
            class="aspect-2/3 w-[42%] shrink-0 animate-pulse rounded-xl bg-gray-800/60 sm:w-[28%] md:w-[22%] lg:w-[16%]"
          />
        </div>
      </div>
    </template>

    <div v-else-if="error || !home || home.shelves.length === 0" class="rounded-lg border border-red-600/30 bg-red-950/40 p-4 text-sm text-red-200">
      Não foi possível carregar as ofertas agora.
      <NuxtLink to="/ofertas" class="ml-1 font-medium text-white underline">Ver todas as ofertas</NuxtLink>
    </div>

    <template v-else>
      <h1 class="sr-only">Promoções de jogos para PC no Brasil</h1>
      <!-- Tailwind 3 space-y gave the hero this top margin (it follows the sr-only h1). -->
      <HomeHeroCarousel v-if="home.hero.length > 0" class="mt-10" :games="home.hero" />
      <HomeDealShelf
        v-for="shelf in home.shelves"
        :key="shelf.key"
        :shelf="shelf"
        :is-favorite="gamesStore.isFavorite"
        @toggle-favorite="toggleFavorite"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const gamesStore = useGamesStore()
const toggleFavorite = useFavoriteToggle()
const { getHome } = useGamesApi()
const runtimeConfig = useRuntimeConfig()
const appName = computed(() => runtimeConfig.public.appName || 'GameDeals BR')

// The old home was the catalog; keep its shared links working.
const LEGACY_SORTS: Record<string, string> = {
  'hottest-games': 'populares',
  'highest-cut': 'desconto',
  'lowest-price': 'menor-preco',
  'highest-price': 'maior-preco',
  'newest-deal': 'recentes',
  'title-asc': 'titulo'
}

if (typeof route.query.sort === 'string') {
  const ordem = LEGACY_SORTS[route.query.sort]
  await navigateTo({ path: '/ofertas', query: ordem ? { ordem } : {} }, { redirectCode: 301 })
}

const homeTitle = computed(() => `${appName.value} — promoções de jogos para PC no Brasil`)
const homeDescription = 'Os menores preços de jogos para PC em Steam, Epic, GOG e outras lojas, com histórico de preços.'

useSeoMeta({
  title: () => homeTitle.value,
  description: homeDescription,
  ogTitle: () => homeTitle.value,
  ogDescription: homeDescription,
  ogImage: `${runtimeConfig.public.siteUrl}/og-default.png`,
  ogUrl: `${runtimeConfig.public.siteUrl}/`,
  ogType: 'website',
  twitterCard: 'summary_large_image'
})

useHead({ link: [{ rel: 'canonical', href: `${runtimeConfig.public.siteUrl}/` }] })

const { data: home, pending, error } = await useAsyncData('home', getHome)
</script>
