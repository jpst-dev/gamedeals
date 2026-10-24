<template>
  <section aria-label="Destaques" class="hero-carousel relative -mx-4 sm:mx-0">
    <Swiper
      :modules="swiperModules"
      :slides-per-view="1"
      :loop="games.length > 1"
      :autoplay="games.length > 1 ? { delay: 6000, pauseOnMouseEnter: true, disableOnInteraction: false } : false"
      :navigation="games.length > 1"
      :pagination="games.length > 1 ? { clickable: true } : false"
      :keyboard="{ enabled: true }"
      class="overflow-hidden sm:rounded-2xl"
    >
      <SwiperSlide v-for="(game, index) in games" :key="game.id">
        <article class="relative bg-gray-950">
          <div class="relative h-40 sm:h-80 lg:h-104">
            <GameCover
              :sources="backgroundSources(game)"
              :title="game.title"
              :ratio="16 / 9"
              fit="cover"
              :eager="index === 0"
              class="absolute! inset-0 h-full!"
            />
            <div class="absolute inset-0 bg-linear-to-t from-gray-950 via-gray-950/30 to-transparent sm:bg-linear-to-r sm:from-gray-950 sm:via-gray-950/80" />
          </div>

          <div class="relative flex items-end gap-4 px-4 pb-10 -mt-16 sm:absolute sm:inset-x-0 sm:bottom-0 sm:mt-0 sm:px-16 sm:pb-12">
            <NuxtLink :to="`/game/${game.slug}`" class="w-24 shrink-0 overflow-hidden rounded-lg shadow-2xl shadow-black/60 sm:w-32" tabindex="-1">
              <GameCover :sources="coverSources(game)" :title="game.title" :eager="index === 0" />
            </NuxtLink>

            <div class="min-w-0 space-y-2">
              <span
                v-if="game.historyLowFlag === 'H' || game.historyLowFlag === 'N'"
                class="inline-block rounded-full bg-sky-500 px-2.5 py-0.5 text-xs font-semibold text-white"
              >
                📉 menor preço da história
              </span>
              <h2 class="line-clamp-2 text-xl font-bold text-white sm:text-3xl">{{ game.title }}</h2>
              <p class="flex flex-wrap items-baseline gap-2">
                <span class="text-2xl font-extrabold text-green-300">{{ formatPrice(game.price[0]?.amount ?? 0) }}</span>
                <span v-if="(game.regularPrice ?? 0) > 0" class="text-sm text-gray-400 line-through">
                  {{ formatPrice(game.regularPrice ?? 0) }}
                </span>
                <span v-if="(game.discount ?? 0) > 0" class="rounded-sm bg-green-600 px-1.5 py-0.5 text-xs font-bold text-white">
                  -{{ game.discount }}%
                </span>
              </p>
              <NuxtLink
                :to="`/game/${game.slug}`"
                class="inline-flex rounded-lg bg-[#66c0f4] px-4 py-2 text-sm font-bold text-gray-950 transition-colors hover:bg-sky-300 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-white"
              >
                Ver ofertas
              </NuxtLink>
            </div>
          </div>
        </article>
      </SwiperSlide>
    </Swiper>
  </section>
</template>

<script setup lang="ts">
import { Autoplay, Keyboard, Navigation, Pagination } from 'swiper/modules'
import { Swiper, SwiperSlide } from 'swiper/vue'
import 'swiper/css'
import 'swiper/css/navigation'
import 'swiper/css/pagination'
import type { HeroGame } from '~/composables/useGamesApi'
import { steamAsset } from '~/utils/cover'

defineProps<{
  games: HeroGame[]
}>()

const swiperModules = [Autoplay, Keyboard, Navigation, Pagination]

const backgroundSources = (game: HeroGame): string[] => [
  steamAsset(game.appid, 'library_hero.jpg'),
  steamAsset(game.appid, 'header.jpg'),
  ...game.images
]

const coverSources = (game: HeroGame): string[] => [
  steamAsset(game.appid, 'library_600x900.jpg'),
  ...game.images
]

const formatPrice = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0)
}
</script>

<style scoped>
.hero-carousel :deep(.swiper-button-prev),
.hero-carousel :deep(.swiper-button-next) {
  color: #fff;
  transform: scale(0.6);
}

.hero-carousel :deep(.swiper-pagination-bullet) {
  background: #9ca3af;
  opacity: 0.7;
}

.hero-carousel :deep(.swiper-pagination-bullet-active) {
  background: #66c0f4;
  opacity: 1;
}

@media (max-width: 639px) {
  .hero-carousel :deep(.swiper-button-prev),
  .hero-carousel :deep(.swiper-button-next) {
    display: none;
  }
}
</style>
