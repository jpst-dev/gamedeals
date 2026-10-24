<template>
  <section class="space-y-4">
    <header class="space-y-1">
      <h1 class="text-2xl font-bold text-white sm:text-3xl">{{ collection?.title ?? 'Todas as ofertas' }}</h1>
      <p v-if="collection" class="text-sm text-gray-400">{{ collection.description }}</p>
    </header>

    <CatalogQuickFilterBar
      :state="state"
      :active-count="tags.length"
      @update="applyPatch"
      @open-filters="openFilters"
    />

    <CatalogActiveFilterTags :tags="tags" @remove="applyPatch" @clear="clearFilters" />

    <CatalogFilterPopover
      :state="state"
      :shops="shops ?? []"
      :open="filtersOpen"
      :anchor="filtersAnchor"
      @update="applyPatch"
      @close="filtersOpen = false"
      @clear="clearFilters"
    />

    <div v-if="pending && loadedGames.length === 0" :class="GRID_CLASS">
      <div v-for="index in 8" :key="index" class="aspect-[2/3] animate-pulse rounded-xl bg-gray-800/60" />
    </div>

    <div v-else-if="error" class="rounded-lg border border-red-600/30 bg-red-950/40 p-4 text-sm text-red-200">
      Não foi possível carregar as ofertas agora. Tente novamente em instantes.
    </div>

    <div v-else-if="loadedGames.length === 0" class="flex flex-col items-start gap-3 rounded-lg border border-gray-700 p-4 text-sm text-gray-300">
      Nenhuma oferta com esses filtros.
      <button type="button" class="rounded-lg border border-gray-600 px-3 py-1.5 text-gray-100 hover:border-gray-400" @click="clearFilters">
        Limpar filtros
      </button>
    </div>

    <template v-else>
      <div :class="GRID_CLASS">
        <GameCard
          v-for="game in loadedGames"
          :key="game.id"
          :game="game"
          :is-favorite="gamesStore.favorites.includes(game.id)"
          @toggle-favorite="(selected) => gamesStore.toggleFavorite(selected.id)"
        />
      </div>

      <div class="flex flex-col items-center gap-2 pt-2">
        <div v-if="hasMore && canAutoLoadMore" ref="autoLoadTrigger" class="h-2 w-full" aria-hidden="true" />
        <p v-if="isAutoLoading" class="text-xs text-[#66c0f4]">Carregando automaticamente...</p>
        <button
          type="button"
          class="rounded-lg border border-gray-600 px-4 py-2 text-sm text-gray-100 transition-colors hover:border-gray-400 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="isLoadingMore || !hasMore"
          aria-label="Carregar mais ofertas"
          @click="loadMore('manual')"
        >
          {{ isLoadingMore ? 'Carregando...' : hasMore ? 'Carregar mais' : 'Todas as ofertas carregadas' }}
        </button>
      </div>
    </template>

    <button
      v-if="showBackToTop"
      type="button"
      class="fixed bottom-5 right-5 z-40 inline-flex items-center gap-1 rounded-lg bg-[#66c0f4] px-3 py-2 text-sm font-semibold text-gray-950 shadow-lg"
      aria-label="Voltar ao topo"
      @click="scrollToTop"
    >
      <UIcon name="i-heroicons-arrow-up-20-solid" class="h-4 w-4" />
      Topo
    </button>
  </section>
</template>

<script setup lang="ts">
import type { Game } from '~/composables/useGamesApi'
import {
  activeFilterTags,
  catalogStateToQuery,
  findCollection,
  parseCatalogQuery,
  type CatalogState
} from '~/utils/catalog'

const props = defineProps<{
  preset?: Partial<CatalogState>
  collectionSlug?: string
}>()

const GRID_CLASS = 'grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
const MAX_AUTO_LOAD_BATCHES = 3
const AUTO_LOAD_COOLDOWN_MS = 800

const route = useRoute()
const router = useRouter()
const toast = useToast()
const gamesStore = useGamesStore()
const { getDealsPage, getShops } = useGamesApi()
const runtimeConfig = useRuntimeConfig()
const appName = computed(() => runtimeConfig.public.appName || 'GameDeals BR')

const collection = computed(() => (props.collectionSlug ? findCollection(props.collectionSlug) : undefined))
const state = computed(() => parseCatalogQuery(route.query, props.preset))

const { data: shops } = await useAsyncData('itad-shops', getShops)
const shopNames = computed(() => new Map((shops.value ?? []).map((shop) => [shop.id, shop.title])))
const tags = computed(() => activeFilterTags(state.value, shopNames.value))

useHead({
  title: computed(() => `${collection.value?.title ?? 'Todas as ofertas'} | ${appName.value}`),
  meta: [
    {
      name: 'description',
      content: computed(() => collection.value?.description ?? 'Todas as promoções de jogos para PC, com filtros por loja, preço e desconto.')
    }
  ]
})

// Every change lands on /ofertas (a collection is only a starting preset);
// push keeps each filter step in history so "voltar" restores it.
const navigateToState = (next: CatalogState): void => {
  void router.push({ path: '/ofertas', query: catalogStateToQuery(next) })
}

const applyPatch = (patch: Partial<CatalogState>): void => {
  const next = { ...state.value, ...patch }
  if (collection.value || JSON.stringify(next) !== JSON.stringify(state.value)) {
    navigateToState(next)
  }
}

const clearFilters = (): void => {
  filtersOpen.value = false
  void router.push({ path: '/ofertas' })
}

const filtersOpen = ref(false)
const filtersAnchor = ref<HTMLElement | null>(null)
const openFilters = (anchor: HTMLElement | null): void => {
  filtersAnchor.value = anchor
  filtersOpen.value = true
}

const { data, pending, error } = await useAsyncData(
  () => `catalog:${JSON.stringify(state.value)}`,
  () => getDealsPage(state.value, 0)
)

const loadedGames = ref<Game[]>([])
const hasMore = ref(false)
const nextOffset = ref(0)
const isLoadingMore = ref(false)
const isAutoLoading = ref(false)
const autoLoadedBatches = ref(0)
const canAutoLoadMore = computed(() => autoLoadedBatches.value < MAX_AUTO_LOAD_BATCHES)
let lastAutoLoadAt = 0

watch(data, (page) => {
  loadedGames.value = page?.games ?? []
  hasMore.value = Boolean(page?.hasMore)
  nextOffset.value = page?.nextOffset ?? 0
  autoLoadedBatches.value = 0
}, { immediate: true })

const loadMore = async (mode: 'manual' | 'auto'): Promise<void> => {
  if (isLoadingMore.value || !hasMore.value) {
    return
  }

  if (mode === 'auto') {
    const now = Date.now()
    if (!canAutoLoadMore.value || now - lastAutoLoadAt < AUTO_LOAD_COOLDOWN_MS) {
      return
    }
    lastAutoLoadAt = now
    isAutoLoading.value = true
  }

  isLoadingMore.value = true
  const requestedState = state.value
  try {
    const page = await getDealsPage(requestedState, nextOffset.value)
    if (requestedState !== state.value) {
      return
    }

    const existingIds = new Set(loadedGames.value.map((game) => game.id))
    loadedGames.value = [...loadedGames.value, ...page.games.filter((game) => !existingIds.has(game.id))]
    hasMore.value = page.hasMore
    nextOffset.value = page.nextOffset
    if (mode === 'auto') {
      autoLoadedBatches.value += 1
    }
  } catch {
    toast.add({ title: 'Erro ao carregar mais ofertas', description: 'Tente novamente em instantes.', color: 'red' })
  } finally {
    isLoadingMore.value = false
    isAutoLoading.value = false
  }
}

const autoLoadTrigger = ref<HTMLElement | null>(null)
let autoLoadObserver: IntersectionObserver | null = null

watch([autoLoadTrigger, hasMore, canAutoLoadMore], ([element, more, canAuto]) => {
  autoLoadObserver?.disconnect()
  autoLoadObserver = null
  if (!element || !more || !canAuto) {
    return
  }

  autoLoadObserver = new IntersectionObserver((entries) => {
    if (entries[0]?.isIntersecting) {
      void loadMore('auto')
    }
  }, { rootMargin: '500px 0px', threshold: 0.01 })
  autoLoadObserver.observe(element)
})

const showBackToTop = ref(false)
const updateBackToTop = (): void => {
  showBackToTop.value = window.scrollY > 480
}
const scrollToTop = (): void => {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(() => {
  updateBackToTop()
  window.addEventListener('scroll', updateBackToTop, { passive: true })
})

onBeforeUnmount(() => {
  autoLoadObserver?.disconnect()
  window.removeEventListener('scroll', updateBackToTop)
})
</script>
