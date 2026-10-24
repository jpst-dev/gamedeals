<template>
  <div class="sticky top-[105px] z-30 -mx-4 border-b border-gray-800 bg-gray-950/90 px-4 py-2 backdrop-blur-sm sm:top-[65px] sm:mx-0 sm:px-0">
    <div class="flex items-center gap-3">
      <div class="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-0.5 scrollbar-none [&::-webkit-scrollbar]:hidden">
        <button
          v-for="chip in chips"
          :key="chip.key"
          type="button"
          class="shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#66c0f4]"
          :class="chip.active
            ? 'border-[#66c0f4] bg-[#66c0f4] text-gray-950'
            : 'border-gray-700 bg-gray-900 text-gray-200 hover:border-gray-500'"
          :aria-pressed="chip.active"
          @click="emit('update', chip.toggle())"
        >
          {{ chip.label }}
        </button>

        <button
          ref="filtersButtonRef"
          type="button"
          class="shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#66c0f4]"
          :class="activeCount > 0 ? 'border-[#66c0f4] text-[#66c0f4]' : 'border-gray-700 bg-gray-900 text-gray-200 hover:border-gray-500'"
          aria-haspopup="dialog"
          @click="emit('open-filters', filtersButtonRef)"
        >
          ⚙ Filtros<span v-if="activeCount > 0"> ({{ activeCount }})</span>
        </button>
      </div>

      <label class="flex shrink-0 items-center gap-2 text-xs text-gray-400">
        <span class="hidden sm:inline">Ordenar por</span>
        <select
          :value="state.ordem"
          class="rounded-md border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-100 focus:border-[#66c0f4] focus:outline-hidden"
          aria-label="Ordenar ofertas"
          @change="emit('update', { ordem: ($event.target as HTMLSelectElement).value as CatalogOrder })"
        >
          <option v-for="option in ORDER_OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</option>
        </select>
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CatalogOrder, CatalogState } from '~/utils/catalog'

const props = defineProps<{
  state: CatalogState
  activeCount: number
}>()

const emit = defineEmits<{
  (event: 'update', patch: Partial<CatalogState>): void
  (event: 'open-filters', anchor: HTMLElement | null): void
}>()

const ORDER_OPTIONS: Array<{ value: CatalogOrder; label: string }> = [
  { value: 'populares', label: 'Populares' },
  { value: 'desconto', label: 'Maior desconto' },
  { value: 'menor-preco', label: 'Menor preço' },
  { value: 'maior-preco', label: 'Maior preço' },
  { value: 'recentes', label: 'Mais recentes' },
  { value: 'titulo', label: 'Título A-Z' },
  { value: 'acabando', label: 'Acabando' }
]

// Shop ids from ITAD /service/shops: Steam 61, Epic 16, GOG 35.
const SHOP_CHIPS = [
  { id: 61, label: 'na Steam' },
  { id: 16, label: 'na Epic' },
  { id: 35, label: 'na GOG' }
]

const filtersButtonRef = ref<HTMLElement | null>(null)

const toggleShop = (shopId: number): Partial<CatalogState> => {
  const lojas = props.state.lojas.includes(shopId)
    ? props.state.lojas.filter((id) => id !== shopId)
    : [...props.state.lojas, shopId]
  return { lojas }
}

const chips = computed(() => [
  {
    key: 'minima',
    label: '📉 Menor preço da história',
    active: props.state.minima,
    toggle: () => ({ minima: !props.state.minima })
  },
  {
    key: 'acabando',
    label: '⏳ Acabando',
    active: props.state.ordem === 'acabando',
    toggle: (): Partial<CatalogState> => ({ ordem: props.state.ordem === 'acabando' ? 'populares' : 'acabando' })
  },
  ...[20, 50].map((cap) => ({
    key: `preco-${cap}`,
    label: `Até R$ ${cap}`,
    active: props.state.preco === cap,
    toggle: () => ({ preco: props.state.preco === cap ? undefined : cap })
  })),
  {
    key: 'desconto-75',
    label: '-75% ou mais',
    active: props.state.desconto === 75,
    toggle: (): Partial<CatalogState> => ({ desconto: props.state.desconto === 75 ? undefined : 75 })
  },
  ...SHOP_CHIPS.map((shop) => ({
    key: `loja-${shop.id}`,
    label: shop.label,
    active: props.state.lojas.includes(shop.id),
    toggle: () => toggleShop(shop.id)
  }))
])
</script>
