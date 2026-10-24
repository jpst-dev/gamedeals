<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-60" @keydown="onKeydown">
      <div class="absolute inset-0 bg-black/60 sm:bg-transparent" aria-hidden="true" @click="emit('close')" />

      <div
        ref="panelRef"
        role="dialog"
        aria-modal="true"
        aria-labelledby="filter-popover-title"
        class="absolute inset-x-0 bottom-0 flex max-h-[80vh] flex-col rounded-t-2xl border border-gray-700 bg-gray-900 shadow-xl sm:inset-x-auto sm:bottom-auto sm:max-h-[min(70vh,34rem)] sm:w-[270px] sm:rounded-xl"
        :style="panelStyle"
      >
        <div class="flex items-center justify-between border-b border-gray-800 px-4 py-3">
          <h2 id="filter-popover-title" class="text-sm font-semibold text-white">Filtros</h2>
          <button
            type="button"
            class="rounded-sm p-1 text-gray-400 hover:text-white focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#66c0f4]"
            aria-label="Fechar filtros"
            @click="emit('close')"
          >
            ✕
          </button>
        </div>

        <div class="flex-1 space-y-4 overflow-y-auto px-4 py-3 text-sm">
          <section>
            <div class="mb-1 flex items-center justify-between">
              <label for="filter-price" class="text-xs font-semibold uppercase tracking-wide text-gray-400">Preço máximo</label>
              <span class="text-xs font-medium text-[#66c0f4]">{{ priceLabel }}</span>
            </div>
            <input
              id="filter-price"
              v-model.number="priceDraft"
              type="range"
              min="0"
              :max="PRICE_UNLIMITED"
              step="10"
              class="w-full accent-[#66c0f4]"
              :aria-valuetext="priceLabel"
            >
          </section>

          <section>
            <h3 class="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">Desconto mínimo</h3>
            <div class="flex flex-wrap gap-1.5">
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
          </section>

          <section v-if="shops.length > 0">
            <h3 class="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">Lojas</h3>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="shop in visibleShops"
                :key="shop.id"
                type="button"
                :class="chipClass(state.lojas.includes(shop.id))"
                :aria-pressed="state.lojas.includes(shop.id)"
                @click="emit('update', { lojas: toggleId(state.lojas, shop.id) })"
              >
                {{ shop.title }}
              </button>
              <button
                v-if="!showAllShops && hiddenShopCount > 0"
                type="button"
                :class="chipClass(false)"
                @click="showAllShops = true"
              >
                + {{ hiddenShopCount }}
              </button>
            </div>
          </section>

          <section>
            <h3 class="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">Ativa em</h3>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="option in DRM_OPTIONS"
                :key="option.id"
                type="button"
                :class="chipClass(state.ativa.includes(option.id))"
                :aria-pressed="state.ativa.includes(option.id)"
                @click="emit('update', { ativa: toggleId(state.ativa, option.id) })"
              >
                {{ option.label }}
              </button>
            </div>
          </section>

          <section>
            <h3 class="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">Mostrar</h3>
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
          </section>
        </div>

        <div class="flex gap-2 border-t border-gray-800 px-4 py-3">
          <button
            type="button"
            class="flex-1 rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-200 hover:border-gray-500"
            @click="emit('clear')"
          >
            Limpar
          </button>
          <button
            type="button"
            class="flex-1 rounded-lg bg-[#66c0f4] px-3 py-2 text-sm font-bold text-gray-950 hover:bg-sky-300"
            @click="emit('close')"
          >
            Ver ofertas
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { Shop } from '~/composables/useGamesApi'
import { DRM_OPTIONS, type CatalogState } from '~/utils/catalog'

const props = defineProps<{
  state: CatalogState
  shops: Shop[]
  open: boolean
  anchor: HTMLElement | null
}>()

const emit = defineEmits<{
  (event: 'update', patch: Partial<CatalogState>): void
  (event: 'close'): void
  (event: 'clear'): void
}>()

const PRICE_UNLIMITED = 300
const PRICE_DEBOUNCE_MS = 400
const VISIBLE_SHOPS = 6

const DISCOUNT_OPTIONS: Array<{ label: string; value: CatalogState['desconto'] }> = [
  { label: 'Qualquer', value: undefined },
  { label: '25%', value: 25 },
  { label: '50%', value: 50 },
  { label: '75%', value: 75 },
  { label: '90%', value: 90 }
]

const TYPE_OPTIONS: Array<{ label: string; value: CatalogState['tipo'] }> = [
  { label: 'Jogos', value: 'jogos' },
  { label: 'DLCs', value: 'dlcs' }
]

const panelRef = ref<HTMLElement | null>(null)
const panelStyle = ref<Record<string, string>>({})
const showAllShops = ref(false)
const priceDraft = ref(PRICE_UNLIMITED)

const chipClass = (active: boolean): string => [
  'rounded-full border px-2.5 py-1 text-xs transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#66c0f4]',
  active ? 'border-[#66c0f4] bg-[#66c0f4] font-semibold text-gray-950' : 'border-gray-700 text-gray-200 hover:border-gray-500'
].join(' ')

const toggleId = (ids: number[], id: number): number[] => {
  return ids.includes(id) ? ids.filter((entry) => entry !== id) : [...ids, id]
}

const visibleShops = computed(() => (showAllShops.value ? props.shops : props.shops.slice(0, VISIBLE_SHOPS)))
const hiddenShopCount = computed(() => Math.max(props.shops.length - VISIBLE_SHOPS, 0))

const priceLabel = computed(() => {
  if (priceDraft.value >= PRICE_UNLIMITED) {
    return 'Sem limite'
  }
  return priceDraft.value === 0 ? 'Grátis' : `Até R$ ${priceDraft.value}`
})

const syncPriceDraft = (): void => {
  priceDraft.value = props.state.preco === undefined ? PRICE_UNLIMITED : Math.min(props.state.preco, PRICE_UNLIMITED)
}

let priceTimer: ReturnType<typeof setTimeout> | null = null
watch(priceDraft, (value) => {
  if (priceTimer) {
    clearTimeout(priceTimer)
  }
  const preco = value >= PRICE_UNLIMITED ? undefined : value
  if (preco === props.state.preco) {
    return
  }
  priceTimer = setTimeout(() => emit('update', { preco }), PRICE_DEBOUNCE_MS)
})

const positionPanel = (): void => {
  const anchor = props.anchor
  if (!anchor || window.innerWidth < 640) {
    panelStyle.value = {}
    return
  }

  const rect = anchor.getBoundingClientRect()
  const left = Math.min(Math.max(rect.right - 270, 8), window.innerWidth - 278)
  panelStyle.value = { top: `${rect.bottom + 8}px`, left: `${left}px` }
}

const focusableElements = (): HTMLElement[] => {
  return Array.from(panelRef.value?.querySelectorAll<HTMLElement>('button, input, select, [tabindex]:not([tabindex="-1"])') ?? [])
}

const onKeydown = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('close')
    return
  }

  if (event.key !== 'Tab') {
    return
  }

  const elements = focusableElements()
  const first = elements[0]
  const last = elements[elements.length - 1]
  if (!first || !last) {
    return
  }

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

watch(() => props.open, async (isOpen) => {
  if (isOpen) {
    syncPriceDraft()
    positionPanel()
    window.addEventListener('resize', positionPanel)
    await nextTick()
    // Skip the close button so focus lands on the first filter control.
    focusableElements()[1]?.focus()
    return
  }

  window.removeEventListener('resize', positionPanel)
  props.anchor?.focus()
})

watch(() => props.state.preco, syncPriceDraft)

onBeforeUnmount(() => {
  if (priceTimer) {
    clearTimeout(priceTimer)
  }
  if (import.meta.client) {
    window.removeEventListener('resize', positionPanel)
  }
})
</script>
