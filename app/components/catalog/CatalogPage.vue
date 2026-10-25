<template>
  <section class="lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-6">
    <aside class="hidden lg:block" aria-label="Filtros">
      <div class="custom-scrollbar sticky top-[122px] max-h-[calc(100vh-138px)] overflow-y-auto rounded-xl border border-gray-800 bg-gray-900/40 p-4">
        <CatalogFilterPanel :state="state" :shops="shops ?? []" :active-count="tags.length" @update="applyPatch" @clear="clearFilters" />
      </div>
    </aside>

    <div class="min-w-0 space-y-4">
      <header class="space-y-1">
        <h1 class="text-2xl font-bold text-white sm:text-3xl">{{ collection?.title ?? 'Todas as ofertas' }}</h1>
        <p v-if="collection" class="text-sm text-gray-400">{{ collection.description }}</p>
      </header>

      <div class="flex flex-wrap items-center gap-2">
        <div class="min-w-0 flex-1">
          <CatalogActiveFilterTags :tags="tags" @remove="applyPatch" @clear="clearFilters" />
        </div>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-lg border border-gray-700 px-3 py-1.5 text-sm text-gray-200 hover:border-gray-500 lg:hidden"
          @click="filtersOpen = true"
        >
          <UIcon name="i-heroicons-adjustments-horizontal" class="h-4 w-4" aria-hidden="true" />
          Filtros<template v-if="tags.length > 0"> ({{ tags.length }})</template>
        </button>
        <label class="flex shrink-0 items-center gap-2 text-xs text-gray-400">
          <span class="hidden sm:inline">Ordenar por</span>
          <select
            :value="state.ordem"
            class="rounded-lg border border-gray-700 bg-gray-900 px-2 py-1.5 text-sm text-gray-100 focus:border-[#66c0f4] focus:outline-hidden"
            aria-label="Ordenar ofertas"
            @change="applyPatch({ ordem: ($event.target as HTMLSelectElement).value as CatalogOrder })"
          >
            <option v-for="option in ORDER_OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </label>
      </div>

      <USlideover v-model:open="filtersOpen" side="left" title="Filtros" :ui="{ content: 'max-w-xs' }">
        <template #body>
          <CatalogFilterPanel hide-heading :state="state" :shops="shops ?? []" :active-count="tags.length" @update="applyPatch" @clear="clearFilters" />
        </template>
      </USlideover>

      <div v-if="isStale || (pending && loadedGames.length === 0)" :class="GRID_CLASS" aria-busy="true">
        <div v-for="index in 8" :key="index" class="aspect-2/3 animate-pulse rounded-xl bg-gray-800/60" />
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
            :is-favorite="gamesStore.isFavorite(game.id)"
            @toggle-favorite="toggleFavorite"
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

    </div>

    <!-- Teleported: as the last child of this space-y section it would add a gap below the grid. -->
    <Teleport to="body">
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
    </Teleport>
  </section>
</template>

<script setup lang="ts">
import type { Game } from '~/composables/useGamesApi'
import {
  activeFilterTags,
  catalogStateToQuery,
  findCollection,
  parseCatalogQuery,
  type CatalogOrder,
  type CatalogState
} from '~/utils/catalog'

const props = defineProps<{
  preset?: Partial<CatalogState>
  collectionSlug?: string
}>()

const GRID_CLASS = 'grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5'
const MAX_AUTO_LOAD_BATCHES = 3
const AUTO_LOAD_COOLDOWN_MS = 800

const route = useRoute()
const router = useRouter()
const toast = useToast()
const gamesStore = useGamesStore()
const toggleFavorite = useFavoriteToggle()
const { getDealsPage, getShops } = useGamesApi()
const runtimeConfig = useRuntimeConfig()
const appName = computed(() => runtimeConfig.public.appName || 'DealsGamer')

const collection = computed(() => (props.collectionSlug ? findCollection(props.collectionSlug) : undefined))
const state = computed(() => parseCatalogQuery(route.query, props.preset))

const { data: shops } = await useAsyncData('itad-shops', getShops)
const shopNames = computed(() => new Map((shops.value ?? []).map((shop) => [shop.id, shop.title])))
const tags = computed(() => activeFilterTags(state.value, shopNames.value))

const pageTitle = computed(() => `${collection.value?.title ?? 'Todas as ofertas'} | ${appName.value}`)
const pageDescription = computed(() => {
  return collection.value?.description ?? 'Todas as promoções de jogos para PC nas lojas que vendem no Brasil.'
})
// Filtered variants all point to the unfiltered page.
const canonicalUrl = computed(() => {
  return `${runtimeConfig.public.siteUrl}${collection.value ? `/ofertas/${collection.value.slug}` : '/ofertas'}`
})

useSeoMeta({
  title: () => pageTitle.value,
  description: () => pageDescription.value,
  ogTitle: () => pageTitle.value,
  ogDescription: () => pageDescription.value,
  ogImage: `${runtimeConfig.public.siteUrl}/og-default.png`,
  ogUrl: () => canonicalUrl.value,
  ogType: 'website',
  twitterCard: 'summary_large_image'
})

useHead({ link: [{ rel: 'canonical', href: canonicalUrl }] })

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
  void router.push({ path: '/ofertas' })
}

// Phone/tablet panel; it stays open while filtering so several can be picked.
const filtersOpen = ref(false)

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

// While a new filter loads, useAsyncData still exposes the previous data, so
// remember which state the grid belongs to and show the skeleton until the
// current one arrives (this also keeps "Carregar mais" off the old offsets).
const stateKey = computed(() => JSON.stringify(state.value))
const loadedKey = ref('')
const isStale = computed(() => loadedKey.value !== stateKey.value)

watch([data, pending], ([page, isPending]) => {
  if (isPending) {
    return
  }
  loadedGames.value = page?.games ?? []
  hasMore.value = Boolean(page?.hasMore)
  nextOffset.value = page?.nextOffset ?? 0
  autoLoadedBatches.value = 0
  loadedKey.value = stateKey.value
}, { immediate: true })

const loadMore = async (mode: 'manual' | 'auto'): Promise<void> => {
  if (isLoadingMore.value || !hasMore.value || isStale.value) {
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
  const requestedKey = stateKey.value
  try {
    const page = await getDealsPage(state.value, nextOffset.value)
    if (requestedKey !== stateKey.value || requestedKey !== loadedKey.value) {
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
    toast.add({ title: 'Erro ao carregar mais ofertas', description: 'Tente novamente em instantes.', color: 'error' })
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
