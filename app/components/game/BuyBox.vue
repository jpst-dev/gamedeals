<template>
  <div class="space-y-3 rounded-xl border border-[#66c0f4]/30 bg-gray-900/70 p-4 shadow-lg shadow-black/30 backdrop-blur-md">
    <template v-if="best">
      <div class="flex items-center justify-between gap-2">
        <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">Melhor preço agora</p>
        <span v-if="best.discount > 0" class="rounded bg-green-600 px-1.5 py-0.5 text-xs font-bold text-white">-{{ best.discount }}%</span>
      </div>

      <p class="flex flex-wrap items-baseline gap-2">
        <span class="text-3xl font-extrabold text-green-300">{{ formatBrl(best.price) }}</span>
        <span v-if="(best.regularPrice ?? 0) > best.price" class="text-sm text-gray-400 line-through">{{ formatBrl(best.regularPrice ?? 0) }}</span>
      </p>

      <p class="text-sm text-gray-300">
        na <strong class="text-white">{{ best.store }}</strong>
        <template v-if="activationText(best.activation)"> · {{ lowerFirst(activationText(best.activation)) }}</template>
      </p>

      <span v-if="best.isHistoryLow" class="inline-block rounded-full bg-sky-500 px-2.5 py-0.5 text-xs font-semibold text-white">
        📉 menor preço da história
      </span>

      <a
        :href="best.link"
        target="_blank"
        rel="noopener noreferrer nofollow"
        class="flex w-full items-center justify-center rounded-lg bg-[#66c0f4] px-4 py-2.5 text-sm font-bold text-gray-950 transition-colors hover:bg-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        Comprar na {{ best.store }} ↗
      </a>

      <a v-if="offers.length >= 2" href="#ofertas" class="block text-center text-sm font-medium text-[#66c0f4] hover:underline">
        Comparar {{ offers.length }} lojas ↓
      </a>
    </template>

    <template v-else>
      <p class="text-sm text-gray-300">Nenhuma loja vende este jogo no Brasil agora.</p>
      <a href="#historico" class="text-sm font-medium text-[#66c0f4] hover:underline">Ver histórico de preços ↓</a>
    </template>
  </div>
</template>

<script setup lang="ts">
import { formatBrl } from '~/utils/money'
import { activationText, type RankedOffer } from '~/utils/offers'

const props = defineProps<{
  offers: RankedOffer[]
}>()

const best = computed(() => props.offers[0])

// "Ativa na Steam" -> "ativa na Steam" mid-sentence, keeping the store name.
const lowerFirst = (text: string): string => text.charAt(0).toLowerCase() + text.slice(1)
</script>
