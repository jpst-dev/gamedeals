<template>
  <article
    class="group mx-auto w-full max-w-sm overflow-hidden rounded-xl border border-gray-800 bg-gray-900 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary-500 hover:shadow-xl hover:shadow-primary-950/40"
    :aria-label="`Game card for ${game.title}`"
  >
    <NuxtLink :to="gameHref" class="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400">
      <div class="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-gray-950 [clip-path:inset(0_round_0.75rem)] [contain:paint]">
        <img
          :src="game.image || fallbackCover"
          :alt="`Cover image for ${game.title}`"
          class="absolute inset-0 h-full w-full object-cover transition-transform duration-500 transform-gpu will-change-transform [backface-visibility:hidden] group-hover:scale-105 group-focus-within:scale-105"
          loading="lazy"
        >

        <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent" />

        <div class="absolute left-2 top-2 flex gap-2">
          <span v-if="hasDiscount" class="rounded-full bg-green-600/95 px-2 py-0.5 text-xs font-semibold text-white">
            -{{ game.discount }}%
          </span>
          <span v-if="game.store" class="rounded-full bg-gray-900/90 px-2 py-0.5 text-xs text-gray-100">
            {{ game.store }}
          </span>
        </div>

        <div class="absolute inset-x-0 bottom-0">
          <div class="rounded-lg bg-black/72 p-3 shadow-[0_-6px_24px_rgba(0,0,0,0.45)] backdrop-blur-sm">
            <h2 class="line-clamp-2 min-h-[2.6rem] text-sm font-semibold text-white md:text-base">
              {{ game.title }}
            </h2>

            <div class="mt-2 space-y-1 pb-1">
              <p class="text-base font-bold text-primary-300">
                {{ formattedLowestPrice }}
              </p>
              <p v-if="hasRegularPrice" class="text-xs text-gray-300 line-through">
                {{ formattedRegularPrice }}
              </p>
            </div>

            <div
              class="max-h-0 space-y-1 overflow-hidden text-xs text-gray-200/90 opacity-0 transition-all duration-300 group-hover:mt-2 group-hover:max-h-28 group-hover:opacity-100 group-focus-within:mt-2 group-focus-within:max-h-28 group-focus-within:opacity-100"
            >
              <p v-if="game.activation">Ativacao: <span class="text-white">{{ game.activation }}</span></p>
              <p v-if="game.platforms">Plataforma: <span class="text-white">{{ game.platforms }}</span></p>
              <p v-if="offerValidityLabel">Validade: <span class="text-yellow-300">{{ offerValidityLabel }}</span></p>

              <UButton
                :variant="isFavorite ? 'solid' : 'outline'"
                size="xs"
                block
                class="mt-2"
                :aria-label="isFavorite ? 'Remove from favorites' : 'Add to favorites'"
                @click.prevent="emit('toggle-favorite', game.id)"
              >
                {{ isFavorite ? 'Favorito' : 'Favoritar' }}
              </UButton>
            </div>
          </div>
        </div>
      </div>
    </NuxtLink>
  </article>
</template>

<script setup lang="ts">
import type { Game } from '~/composables/useGamesApi'

const props = defineProps<{
  game: Game
  isFavorite?: boolean
}>()

const emit = defineEmits<{
  (event: 'toggle-favorite', gameId: string): void
}>()

const fallbackCover = 'https://placehold.co/600x300/111827/e5e7eb?text=No+Image'

const hasDiscount = computed(() => Number(props.game.discount ?? 0) > 0)
const hasRegularPrice = computed(() => Number(props.game.regularPrice ?? 0) > 0)

const gameHref = computed(() => {
  return `/game/${props.game.slug}`
})

const formattedLowestPrice = computed(() => {
  const lowestPrice = Math.min(...props.game.price.map((entry) => entry.amount))
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(Number.isFinite(lowestPrice) ? lowestPrice : 0)
})

const formattedRegularPrice = computed(() => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(Number(props.game.regularPrice ?? 0))
})

const offerValidityLabel = computed(() => {
  if (!props.game.expiryAt) {
    return ''
  }

  const expiryDate = new Date(props.game.expiryAt)
  if (Number.isNaN(expiryDate.getTime())) {
    return ''
  }

  const diffMs = expiryDate.getTime() - Date.now()
  if (diffMs <= 0) {
    return 'Encerrada'
  }

  const diffHours = Math.ceil(diffMs / (1000 * 60 * 60))
  if (diffHours < 24) {
    return `${diffHours}h restantes`
  }

  const diffDays = Math.ceil(diffHours / 24)
  return `${diffDays}d restantes`
})
</script>
