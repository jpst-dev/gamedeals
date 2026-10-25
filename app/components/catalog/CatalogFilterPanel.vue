<template>
  <div class="space-y-5 text-sm">
    <div class="flex items-center justify-between" :class="{ '-mb-2 justify-end': hideHeading }">
      <h2 v-if="!hideHeading" class="text-base font-semibold text-white">Filtros</h2>
      <button
        v-if="activeCount > 0"
        type="button"
        class="text-xs font-medium text-[#66c0f4] hover:text-sky-300"
        @click="emit('clear')"
      >
        Limpar filtros
      </button>
    </div>

    <fieldset>
      <div class="mb-2 flex items-center justify-between">
        <legend :class="LEGEND_CLASS">Preço máximo</legend>
        <span class="text-xs font-medium text-[#66c0f4]">{{ priceLabel(priceDraft) }}</span>
      </div>
      <div class="mb-2 flex flex-wrap gap-1">
        <button
          v-for="shortcut in PRICE_SHORTCUTS"
          :key="shortcut.value"
          type="button"
          :class="chipClass(state.preco === shortcut.value)"
          :aria-pressed="state.preco === shortcut.value"
          @click="emit('update', { preco: togglePrice(state.preco, shortcut.value) })"
        >
          {{ shortcut.label }}
        </button>
      </div>
      <input
        v-model.number="priceDraft"
        type="range"
        min="0"
        :max="PRICE_UNLIMITED"
        step="10"
        class="w-full accent-[#66c0f4]"
        aria-label="Preço máximo"
        :aria-valuetext="priceLabel(priceDraft)"
      >
    </fieldset>

    <fieldset>
      <legend :class="[LEGEND_CLASS, 'mb-2']">Desconto mínimo</legend>
      <div class="flex flex-wrap gap-1">
        <button
          v-for="option in DISCOUNT_OPTIONS"
          :key="option.label"
          type="button"
          :class="chipClass(state.desconto === option.value)"
          :aria-pressed="state.desconto === option.value"
          @click="emit('update', { desconto: option.value })"
        >
          {{ option.label }}
        </button>
      </div>
    </fieldset>

    <fieldset v-if="shops.length > 0">
      <legend :class="[LEGEND_CLASS, 'mb-2']">Lojas</legend>
      <input
        v-model="shopQuery"
        type="search"
        placeholder="Buscar loja…"
        aria-label="Buscar loja"
        class="mb-2 w-full rounded-md border border-gray-700 bg-gray-900 px-2.5 py-1.5 text-xs text-white placeholder:text-gray-500 focus:border-[#66c0f4] focus:outline-hidden"
      >
      <label
        v-for="shop in shownShops"
        :key="shop.id"
        class="flex cursor-pointer items-center gap-2 rounded-sm py-1 text-gray-200 hover:text-white"
      >
        <input
          type="checkbox"
          class="h-4 w-4 accent-[#66c0f4]"
          :checked="state.lojas.includes(shop.id)"
          @change="emit('update', { lojas: toggleId(state.lojas, shop.id) })"
        >
        <span class="truncate">{{ shop.title }}</span>
      </label>
      <p v-if="shownShops.length === 0" class="py-1 text-xs text-gray-500">Nenhuma loja com esse nome.</p>
      <button
        v-if="!shopQuery && shops.length > VISIBLE_SHOPS"
        type="button"
        class="mt-1 text-xs font-medium text-[#66c0f4] hover:text-sky-300"
        @click="showAllShops = !showAllShops"
      >
        {{ showAllShops ? 'ver menos' : `ver todas (${shops.length})` }}
      </button>
    </fieldset>

    <fieldset>
      <legend :class="[LEGEND_CLASS, 'mb-2']">Ativa em</legend>
      <label
        v-for="option in DRM_OPTIONS"
        :key="option.id"
        class="flex cursor-pointer items-center gap-2 py-1 text-gray-200 hover:text-white"
      >
        <input
          type="checkbox"
          class="h-4 w-4 accent-[#66c0f4]"
          :checked="state.ativa.includes(option.id)"
          @change="emit('update', { ativa: toggleId(state.ativa, option.id) })"
        >
        {{ option.label }}
      </label>
    </fieldset>

    <fieldset>
      <legend :class="[LEGEND_CLASS, 'mb-2']">Mostrar</legend>
      <div class="flex gap-1.5">
        <button
          v-for="option in TYPE_OPTIONS"
          :key="option.value"
          type="button"
          :class="chipClass(state.tipo === option.value)"
          :aria-pressed="state.tipo === option.value"
          @click="emit('update', { tipo: option.value })"
        >
          {{ option.label }}
        </button>
      </div>
    </fieldset>

    <label class="flex cursor-pointer items-center gap-2 text-gray-200 hover:text-white">
      <input
        type="checkbox"
        class="h-4 w-4 accent-[#66c0f4]"
        :checked="state.minima"
        @change="emit('update', { minima: !state.minima })"
      >
      Só menor preço da história
    </label>
  </div>
</template>

<script setup lang="ts">
import type { Shop } from '~/composables/useGamesApi'
import { DRM_OPTIONS, type CatalogState } from '~/utils/catalog'

const props = defineProps<{
  state: CatalogState
  shops: Shop[]
  activeCount: number
  // The phone slideover already shows its own "Filtros" title.
  hideHeading?: boolean
}>()

const emit = defineEmits<{
  (event: 'update', patch: Partial<CatalogState>): void
  (event: 'clear'): void
}>()

const LEGEND_CLASS = 'text-xs font-semibold uppercase tracking-wide text-gray-400'

const chipClass = (active: boolean): string => [
  'rounded-full border px-2 py-1 text-xs transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#66c0f4]',
  active ? 'border-[#66c0f4] bg-[#66c0f4] font-semibold text-gray-950' : 'border-gray-700 text-gray-200 hover:border-gray-500'
].join(' ')

const shopQuery = ref('')
const showAllShops = ref(false)
const shownShops = computed(() => shopsToShow(props.shops, props.state.lojas, shopQuery.value, showAllShops.value || shopQuery.value.trim() !== ''))

// The slider moves a draft; the filter changes once it rests, so dragging
// across the range is one ITAD request, not one per step.
const priceDraft = ref(priceDraftOf(props.state.preco))
watch(() => props.state.preco, (preco) => {
  priceDraft.value = priceDraftOf(preco)
})

let priceTimer: ReturnType<typeof setTimeout> | null = null
watch(priceDraft, (value) => {
  if (priceTimer) {
    clearTimeout(priceTimer)
  }
  const preco = priceFromDraft(value)
  if (preco === props.state.preco) {
    return
  }
  priceTimer = setTimeout(() => emit('update', { preco }), PRICE_DEBOUNCE_MS)
})

onBeforeUnmount(() => {
  if (priceTimer) {
    clearTimeout(priceTimer)
  }
})
</script>
