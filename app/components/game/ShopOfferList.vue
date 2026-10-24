<template>
  <section id="ofertas" class="scroll-mt-28 space-y-3" aria-labelledby="ofertas-title">
    <h2 id="ofertas-title" class="text-xl font-semibold text-white">Onde comprar</h2>

    <p v-if="offers.length === 0" class="rounded-xl border border-white/10 bg-gray-900/45 p-4 text-sm text-gray-400">
      Nenhuma loja vende este jogo no Brasil agora.
    </p>

    <ul v-else class="space-y-2">
      <li
        v-for="offer in visibleOffers"
        :key="`${offer.store}-${offer.link}`"
        class="relative grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl border p-3 backdrop-blur-md sm:grid-cols-[1.6fr_1fr_auto_auto]"
        :class="offer.isBest ? 'border-green-500/70 bg-green-950/20' : 'border-white/10 bg-gray-900/45'"
      >
        <span
          v-if="offer.isBest"
          class="absolute -top-2 left-3 rounded-sm bg-green-600 px-1.5 py-px text-[10px] font-bold tracking-wide text-white"
        >
          MELHOR PREÇO
        </span>

        <div class="col-span-2 flex min-w-0 items-center gap-3 sm:col-span-1">
          <span
            class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white"
            :style="{ backgroundColor: `hsl(${hueFromString(offer.store)} 55% 35%)` }"
            aria-hidden="true"
          >
            {{ offer.store.charAt(0).toUpperCase() }}
          </span>
          <div class="min-w-0">
            <p class="truncate font-medium text-white">{{ offer.store }}</p>
            <p v-if="activationText(offer.activation)" class="truncate text-xs text-gray-400">{{ activationText(offer.activation) }}</p>
          </div>
        </div>

        <div class="col-span-2 text-xs empty:hidden sm:col-span-1 sm:empty:block">
          <span v-if="offer.isHistoryLow" class="inline-block rounded-full bg-sky-500 px-2 py-0.5 font-semibold text-white">
            📉 menor preço da história
          </span>
          <span v-else-if="offer.deltaFromBest > 0" class="text-gray-400">+ {{ formatBrl(offer.deltaFromBest) }}</span>
          <p v-if="offer.voucher" class="mt-1 text-amber-300">Cupom: <code class="font-semibold">{{ offer.voucher }}</code></p>
        </div>

        <div class="flex flex-col sm:items-end">
          <span class="text-lg font-bold text-green-300">{{ formatBrl(offer.price) }}</span>
          <span class="flex items-baseline gap-1.5 text-xs">
            <span v-if="offer.discount > 0" class="font-bold text-green-400">-{{ offer.discount }}%</span>
            <span v-if="(offer.regularPrice ?? 0) > offer.price" class="text-gray-500 line-through">{{ formatBrl(offer.regularPrice ?? 0) }}</span>
          </span>
        </div>

        <a
          :href="offer.link"
          target="_blank"
          rel="noopener noreferrer nofollow"
          class="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-white"
          :class="offer.isBest ? 'bg-[#66c0f4] text-gray-950 hover:bg-sky-300' : 'border border-[#66c0f4]/60 text-[#66c0f4] hover:bg-[#66c0f4]/10'"
          :aria-label="`Comprar na ${offer.store} por ${formatBrl(offer.price)}`"
        >
          Comprar ↗
        </a>
      </li>
    </ul>

    <button
      v-if="hiddenCount > 0"
      type="button"
      class="w-full rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-200 hover:border-gray-500"
      @click="showAll = true"
    >
      Ver mais {{ hiddenCount }} {{ hiddenCount === 1 ? 'loja' : 'lojas' }}
    </button>
  </section>
</template>

<script setup lang="ts">
import { hueFromString } from '~/utils/cover'
import { formatBrl } from '~/utils/money'
import { activationText, type RankedOffer } from '~/utils/offers'

const props = defineProps<{
  offers: RankedOffer[]
}>()

const VISIBLE_OFFERS = 5
const showAll = ref(false)
const visibleOffers = computed(() => (showAll.value ? props.offers : props.offers.slice(0, VISIBLE_OFFERS)))
const hiddenCount = computed(() => (showAll.value ? 0 : Math.max(props.offers.length - VISIBLE_OFFERS, 0)))
</script>
