<template>
  <section class="space-y-4">
    <h1 class="text-2xl font-bold text-white sm:text-3xl">Meus favoritos</h1>

    <div
      v-if="accountsEnabled && !loggedIn"
      class="flex flex-col gap-3 rounded-xl border border-gray-800 bg-gray-900/40 p-4 text-sm text-gray-300 sm:flex-row sm:items-center sm:justify-between"
    >
      <p>Receba um email quando seus favoritos entrarem em promoção.</p>
      <NuxtLink to="/entrar" class="inline-flex shrink-0 justify-center rounded-lg bg-[#66c0f4] px-4 py-2 font-bold text-gray-950 hover:bg-sky-300">
        Entrar
      </NuxtLink>
    </div>

    <ClientOnly>
      <div v-if="gamesStore.favorites.length === 0" class="space-y-3 rounded-xl border border-gray-800 p-6 text-sm text-gray-300">
        <p>Você ainda não favoritou nenhum jogo. Toque no ♥ de um jogo para salvá-lo aqui.</p>
        <NuxtLink to="/ofertas" class="inline-flex rounded-lg bg-[#66c0f4] px-4 py-2 font-bold text-gray-950 hover:bg-sky-300">
          Explorar ofertas
        </NuxtLink>
      </div>

      <div v-else-if="pending && !bestPrices" :class="GRID_CLASS">
        <div v-for="index in Math.min(gamesStore.favorites.length, 10)" :key="index" class="aspect-2/3 animate-pulse rounded-xl bg-gray-800/60" />
      </div>

      <div v-else :class="GRID_CLASS">
        <GameCard
          v-for="card in cards"
          :key="card.game.id"
          :game="card.game"
          :no-offer="card.noOffer"
          :is-favorite="gamesStore.isFavorite(card.game.id)"
          @toggle-favorite="toggleFavorite"
        />
      </div>

      <template #fallback>
        <div :class="GRID_CLASS">
          <div v-for="index in 5" :key="index" class="aspect-2/3 animate-pulse rounded-xl bg-gray-800/60" />
        </div>
      </template>
    </ClientOnly>
  </section>
</template>

<script setup lang="ts">
import { buildFavoriteCards } from '~/utils/favorites'

const GRID_CLASS = 'grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'

useSeoMeta({ title: 'Meus favoritos | GameDeals BR', robots: 'noindex' })

const gamesStore = useGamesStore()
const toggleFavorite = useFavoriteToggle()
const { enabled: accountsEnabled, loggedIn } = useAccount()
const { getBestPrices } = useGamesApi()

// Unfavoriting just hides a card; only newly added ids (e.g. legacy
// favorites migrated after load) need another price lookup.
let pricedIds = new Set<string>()
const { data: bestPrices, pending, refresh } = useLazyAsyncData(
  'favorite-prices',
  () => {
    const ids = gamesStore.favorites.map((item) => item.id)
    pricedIds = new Set(ids)
    return getBestPrices(ids)
  },
  { server: false }
)

watch(() => gamesStore.favorites.map((item) => item.id), (ids) => {
  if (ids.some((id) => !pricedIds.has(id))) {
    void refresh()
  }
})

const cards = computed(() => buildFavoriteCards(gamesStore.favorites, bestPrices.value ?? new Map()))
</script>
