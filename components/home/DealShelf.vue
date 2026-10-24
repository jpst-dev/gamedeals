<template>
  <section class="space-y-3" :aria-labelledby="headingId">
    <div class="flex items-center justify-between gap-3">
      <h2 :id="headingId" class="text-lg font-semibold text-white sm:text-xl">{{ shelf.title }}</h2>
      <div class="flex items-center gap-2">
        <button
          v-for="direction in ([-1, 1] as const)"
          :key="direction"
          type="button"
          class="hidden h-8 w-8 items-center justify-center rounded-full border border-gray-700 text-gray-200 transition-colors hover:border-[#66c0f4] hover:text-white disabled:cursor-not-allowed disabled:opacity-30 md:flex"
          :disabled="direction < 0 ? atStart : atEnd"
          :aria-label="direction < 0 ? `Rolar ${shelf.title} para a esquerda` : `Rolar ${shelf.title} para a direita`"
          @click="scrollBy(direction)"
        >
          <UIcon :name="direction < 0 ? 'i-heroicons-chevron-left' : 'i-heroicons-chevron-right'" class="h-4 w-4" />
        </button>
        <NuxtLink :to="shelf.href" class="text-sm font-medium text-[#66c0f4] hover:underline">
          Ver tudo →
        </NuxtLink>
      </div>
    </div>

    <div
      ref="trackRef"
      class="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
      @scroll.passive="updateEdges"
    >
      <div
        v-for="game in shelf.games"
        :key="game.id"
        class="w-[42%] shrink-0 snap-start sm:w-[28%] md:w-[22%] lg:w-[16%]"
      >
        <GameCard
          :game="game"
          :is-favorite="isFavorite(game.id)"
          @toggle-favorite="(selected) => emit('toggle-favorite', selected)"
        />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { Game, HomeShelf } from '~/composables/useGamesApi'

const props = defineProps<{
  shelf: HomeShelf
  isFavorite: (gameId: string) => boolean
}>()

const emit = defineEmits<{
  (event: 'toggle-favorite', game: Game): void
}>()

const headingId = computed(() => `shelf-${props.shelf.key}`)
const trackRef = ref<HTMLElement | null>(null)
const atStart = ref(true)
const atEnd = ref(false)

const updateEdges = (): void => {
  const track = trackRef.value
  if (!track) {
    return
  }

  atStart.value = track.scrollLeft <= 4
  atEnd.value = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4
}

const scrollBy = (direction: -1 | 1): void => {
  const track = trackRef.value
  if (track) {
    track.scrollBy({ left: direction * track.clientWidth * 0.9, behavior: 'smooth' })
  }
}

onMounted(updateEdges)
</script>
