<template>
  <section class="space-y-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-bold text-white">Top ofertas de jogos para PC</h1>
        <p class="text-sm text-gray-400">Compare as melhores ofertas atuais em multiplas lojas digitais.</p>
      </div>
      <div class="flex items-center gap-3">
        <UButton
          class="lg:hidden"
          size="sm"
          variant="outline"
          icon="i-heroicons-adjustments-horizontal"
          @click="openMobileFilters"
        >
          Filtros<span v-if="activeFilterCount > 0"> ({{ activeFilterCount }})</span>
        </UButton>
        <label for="sort-by" class="text-sm text-gray-300">Sort by</label>
        <select
          id="sort-by"
          :value="currentSort"
          class="rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-primary-400 focus:outline-none"
          aria-label="Sort game list"
          @change="changeSort(($event.target as HTMLSelectElement).value)"
        >
          <option v-for="option in sortOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
        <UIcon v-if="pending" name="i-heroicons-arrow-path" class="h-5 w-5 animate-spin text-primary-400" />
      </div>
    </div>

    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-200"
        leave-active-class="transition-opacity duration-200"
        enter-from-class="opacity-0"
        leave-to-class="opacity-0"
      >
        <div v-if="isMobileFiltersOpen" class="fixed inset-0 z-[130] lg:hidden">
          <button
            class="absolute inset-0 bg-black/70"
            aria-label="Fechar painel de filtros"
            @click="closeMobileFilters"
          />

          <div class="custom-scrollbar absolute inset-y-0 right-0 w-full max-w-sm overflow-y-auto bg-gray-950 p-4">
            <div class="mb-4 flex items-center justify-between">
              <h2 class="text-sm font-semibold text-white">Filtros</h2>
              <UButton size="xs" variant="ghost" color="gray" @click="closeMobileFilters">
                Fechar
              </UButton>
            </div>

            <div class="space-y-4 rounded-xl border border-gray-800 bg-gray-900 p-4">
              <div class="flex items-center justify-between">
                <h3 class="text-sm font-semibold text-white">Refinar resultados</h3>
                <UButton
                  size="xs"
                  variant="ghost"
                  color="gray"
                  aria-label="Clear all filters"
                  @click="resetFilters"
                >
                  Limpar
                </UButton>
              </div>

              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <label for="filter-min-discount-mobile" class="text-xs text-gray-400">Desconto minimo</label>
                  <span class="text-xs font-medium text-primary-300">{{ filters.minDiscount }}%</span>
                </div>
                <input
                  id="filter-min-discount-mobile"
                  v-model.number="filters.minDiscount"
                  type="range"
                  min="0"
                  max="95"
                  step="5"
                  class="w-full accent-primary-500"
                  aria-label="Minimum discount percentage"
                >
              </div>

              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <label for="filter-max-price-mobile" class="text-xs text-gray-400">Preco maximo</label>
                  <span class="text-xs font-medium text-primary-300">
                    {{ filters.priceCapEnabled ? formatCurrency(filters.maxPrice) : 'Sem limite' }}
                  </span>
                </div>
                <input
                  id="filter-max-price-mobile"
                  v-model.number="filters.maxPrice"
                  type="range"
                  min="10"
                  :max="dynamicPriceSliderMax"
                  step="5"
                  class="w-full accent-primary-500"
                  :disabled="!filters.priceCapEnabled"
                  aria-label="Maximum price cap"
                >
                <UCheckbox
                  v-model="filters.priceCapEnabled"
                  name="priceCapEnabledMobile"
                  label="Ativar limite de preco"
                />
              </div>

              <div class="space-y-1">
                <label class="text-xs text-gray-400" for="filter-title-mobile">Pesquisar titulo carregado</label>
                <UInput
                  id="filter-title-mobile"
                  v-model="filters.titleQuery"
                  placeholder="Ex.: cyberpunk"
                  aria-label="Filter by loaded title"
                />
              </div>

              <div class="space-y-1">
                <label class="text-xs text-gray-400" for="filter-store-mobile">Loja</label>
                <select
                  id="filter-store-mobile"
                  v-model="filters.store"
                  class="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-primary-400 focus:outline-none"
                  aria-label="Store filter"
                >
                  <option value="">Todas</option>
                  <option v-for="store in availableStores" :key="`mobile-${store}`" :value="store.toLowerCase()">
                    {{ store }}
                  </option>
                </select>
              </div>

              <div class="space-y-1">
                <label class="text-xs text-gray-400" for="filter-activation-mobile">Ativacao</label>
                <select
                  id="filter-activation-mobile"
                  v-model="filters.activation"
                  class="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-primary-400 focus:outline-none"
                  aria-label="Activation filter"
                >
                  <option value="">Todas</option>
                  <option value="steam">Steam</option>
                  <option value="epic">Epic</option>
                  <option value="drm free">DRM Free</option>
                </select>
              </div>

              <div class="space-y-1">
                <label class="text-xs text-gray-400" for="filter-platform-mobile">Plataforma</label>
                <select
                  id="filter-platform-mobile"
                  v-model="filters.platform"
                  class="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-primary-400 focus:outline-none"
                  aria-label="Platform filter"
                >
                  <option value="">Todas</option>
                  <option value="windows">Windows</option>
                  <option value="mac">Mac</option>
                  <option value="linux">Linux</option>
                </select>
              </div>

              <div class="space-y-2 border-t border-gray-800 pt-3">
                <UCheckbox v-model="filters.onlyWithExpiry" name="onlyWithExpiryMobile" label="Somente com validade" />
                <UCheckbox v-model="filters.onlyFavorites" name="onlyFavoritesMobile" label="Somente favoritos" />
                <UCheckbox v-model="filters.onlyDiscounted" name="onlyDiscountedMobile" label="Somente com desconto" />
              </div>
            </div>

            <UButton block class="mt-4" color="primary" @click="closeMobileFilters">
              Aplicar filtros
            </UButton>
          </div>
        </div>
      </Transition>
    </Teleport>

    <div class="grid gap-6 lg:grid-cols-[300px_1fr]">
      <aside class="hidden space-y-4 lg:sticky lg:top-24 lg:block lg:self-start">
        <div class="space-y-4 rounded-xl border border-gray-800 bg-gray-900 p-4">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-semibold text-white">Filtros</h2>
            <UButton
              size="xs"
              variant="ghost"
              color="gray"
              aria-label="Clear all filters"
              @click="resetFilters"
            >
              Limpar
            </UButton>
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <label for="filter-min-discount" class="text-xs text-gray-400">Desconto minimo</label>
              <span class="text-xs font-medium text-primary-300">{{ filters.minDiscount }}%</span>
            </div>
            <input
              id="filter-min-discount"
              v-model.number="filters.minDiscount"
              type="range"
              min="0"
              max="95"
              step="5"
              class="w-full accent-primary-500"
              aria-label="Minimum discount percentage"
            >
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <label for="filter-max-price" class="text-xs text-gray-400">Preco maximo</label>
              <span class="text-xs font-medium text-primary-300">
                {{ filters.priceCapEnabled ? formatCurrency(filters.maxPrice) : 'Sem limite' }}
              </span>
            </div>
            <input
              id="filter-max-price"
              v-model.number="filters.maxPrice"
              type="range"
              min="10"
              :max="dynamicPriceSliderMax"
              step="5"
              class="w-full accent-primary-500"
              :disabled="!filters.priceCapEnabled"
              aria-label="Maximum price cap"
            >
            <UCheckbox
              v-model="filters.priceCapEnabled"
              name="priceCapEnabled"
              label="Ativar limite de preco"
            />
          </div>

          <div class="space-y-1">
            <label class="text-xs text-gray-400" for="filter-title">Pesquisar titulo carregado</label>
            <UInput
              id="filter-title"
              v-model="filters.titleQuery"
              placeholder="Ex.: cyberpunk"
              aria-label="Filter by loaded title"
            />
          </div>

          <div class="space-y-1">
            <label class="text-xs text-gray-400" for="filter-store">Loja</label>
            <select
              id="filter-store"
              v-model="filters.store"
              class="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-primary-400 focus:outline-none"
              aria-label="Store filter"
            >
              <option value="">Todas</option>
              <option v-for="store in availableStores" :key="store" :value="store.toLowerCase()">
                {{ store }}
              </option>
            </select>
          </div>

          <div class="space-y-1">
            <label class="text-xs text-gray-400" for="filter-activation">Ativacao</label>
            <select
              id="filter-activation"
              v-model="filters.activation"
              class="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-primary-400 focus:outline-none"
              aria-label="Activation filter"
            >
              <option value="">Todas</option>
              <option value="steam">Steam</option>
              <option value="epic">Epic</option>
              <option value="drm free">DRM Free</option>
            </select>
          </div>

          <div class="space-y-1">
            <label class="text-xs text-gray-400" for="filter-platform">Plataforma</label>
            <select
              id="filter-platform"
              v-model="filters.platform"
              class="w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-primary-400 focus:outline-none"
              aria-label="Platform filter"
            >
              <option value="">Todas</option>
              <option value="windows">Windows</option>
              <option value="mac">Mac</option>
              <option value="linux">Linux</option>
            </select>
          </div>

          <div class="space-y-2 border-t border-gray-800 pt-3">
            <UCheckbox v-model="filters.onlyWithExpiry" name="onlyWithExpiry" label="Somente com validade" />
            <UCheckbox v-model="filters.onlyFavorites" name="onlyFavorites" label="Somente favoritos" />
            <UCheckbox v-model="filters.onlyDiscounted" name="onlyDiscounted" label="Somente com desconto" />
          </div>
        </div>

        <p class="text-xs text-gray-500">
          Filtros aplicados apenas aos jogos ja carregados.
        </p>
      </aside>

      <div class="space-y-4">
        <div class="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/70 px-3 py-2 text-xs text-gray-300">
          <p>{{ filteredGames.length }} resultados filtrados</p>
          <p>{{ loadedGames.length }} jogos carregados</p>
        </div>

        <div v-if="pending && loadedGames.length === 0" class="grid grid-cols-2 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          <USkeleton v-for="index in 8" :key="index" class="h-56 rounded-xl" />
        </div>

        <div v-else-if="errorMessage" class="rounded-lg border border-red-600/30 bg-red-950/40 p-4 text-sm text-red-200">
          {{ errorMessage }}
        </div>

        <div v-else class="grid grid-cols-2 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          <GameCard
            v-for="game in filteredGames"
            :key="game.id"
            :game="game"
            :is-favorite="gamesStore.favorites.includes(game.id)"
            @toggle-favorite="gamesStore.toggleFavorite"
          />
        </div>

        <div
          v-if="!pending && !errorMessage && loadedGames.length > 0 && filteredGames.length === 0"
          class="rounded-lg border border-gray-700 p-4 text-sm text-gray-300"
        >
          Nenhuma oferta encontrada com os filtros atuais.
        </div>

        <div
          v-if="!errorMessage && loadedGames.length > 0"
          class="flex flex-col items-center gap-2 pt-2"
        >
          <div
            v-if="hasMorePages && canAutoLoadMore"
            ref="autoLoadTrigger"
            class="h-2 w-full"
            aria-hidden="true"
          />
          <p v-if="isAutoLoading" class="text-xs text-primary-300">
            Carregando automaticamente...
          </p>
          <UButton
            size="sm"
            variant="outline"
            :loading="isLoadingMore"
            :disabled="isLoadingMore || pending || !hasMorePages"
            aria-label="Load more games"
            @click="loadMoreGames"
          >
            {{ hasMorePages ? 'Carregar mais' : 'Todos os jogos carregados' }}
          </UButton>
        </div>
      </div>
    </div>

    <UButton
      v-if="showBackToTop"
      size="sm"
      color="primary"
      icon="i-heroicons-arrow-up-20-solid"
      class="fixed bottom-5 right-5 z-40 shadow-lg"
      aria-label="Back to top"
      @click="scrollToTop"
    >
      Topo
    </UButton>
  </section>
</template>

<script setup lang="ts">
import type { Game, TopGamesPageResult } from '~/composables/useGamesApi'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const gamesStore = useGamesStore()
const { getTopGames } = useGamesApi()
const runtimeConfig = useRuntimeConfig()
const appName = computed(() => runtimeConfig.public.appName || 'GameDeals BR')
const perPage = 20
const sortOptions = [
  { value: 'hottest-games', label: 'Mais populares' },
  { value: 'highest-cut', label: 'Maior desconto' },
  { value: 'lowest-price', label: 'Menor preco' },
  { value: 'highest-price', label: 'Maior preco' },
  { value: 'newest-deal', label: 'Mais recentes' },
  { value: 'title-asc', label: 'Titulo A-Z' }
] as const
type SortOptionValue = (typeof sortOptions)[number]['value']
type HomeDealFilters = {
  minDiscount: number
  maxPrice: number
  priceCapEnabled: boolean
  activation: string
  platform: string
  store: string
  titleQuery: string
  onlyWithExpiry: boolean
  onlyFavorites: boolean
  onlyDiscounted: boolean
}

const validSortValues = sortOptions.map((option) => option.value)
const isValidSortValue = (value: string): value is SortOptionValue => validSortValues.includes(value as SortOptionValue)
const filters = reactive<HomeDealFilters>({
  minDiscount: 0,
  maxPrice: 200,
  priceCapEnabled: false,
  activation: '',
  platform: '',
  store: '',
  titleQuery: '',
  onlyWithExpiry: false,
  onlyFavorites: false,
  onlyDiscounted: false
})

const currentSort = computed<SortOptionValue>(() => {
  const sort = typeof route.query.sort === 'string' ? route.query.sort : 'hottest-games'
  return isValidSortValue(sort) ? sort : 'hottest-games'
})
const apiSortValue = computed(() => {
  if (currentSort.value === 'hottest-games') return '-hot'
  if (currentSort.value === 'highest-cut') return '-cut'
  if (currentSort.value === 'lowest-price') return 'price'
  if (currentSort.value === 'highest-price') return '-price'
  if (currentSort.value === 'newest-deal') return '-added'
  return '-hot'
})

useHead({
  title: computed(() => `${appName.value} | Ofertas em destaque`),
  meta: [
    { name: 'description', content: 'Catalogo paginado de jogos para PC com melhores ofertas por loja.' },
    { property: 'og:title', content: computed(() => `${appName.value} | Ofertas em destaque`) },
    { property: 'og:description', content: 'Veja as melhores ofertas de jogos para PC em um so lugar.' }
  ]
})

const { data, pending, error } = await useAsyncData<TopGamesPageResult>(
  () => `top-games-home-${apiSortValue.value}`,
  async () => getTopGames(perPage, apiSortValue.value, 1)
)
const loadedGames = ref<Game[]>([])
const loadedPages = ref(1)
const hasMorePages = ref(false)
const isLoadingMore = ref(false)
const showBackToTop = ref(false)
const isMobileFiltersOpen = ref(false)
const autoLoadTrigger = ref<HTMLElement | null>(null)
const autoLoadedBatches = ref(0)
const isAutoLoading = ref(false)
const MAX_AUTO_LOAD_BATCHES = 3
const AUTO_LOAD_COOLDOWN_MS = 900
let lastAutoLoadAt = 0
let autoLoadObserver: IntersectionObserver | null = null
let removeScrollListener: (() => void) | null = null

watch(data, (value) => {
  loadedGames.value = value?.games ?? []
  loadedPages.value = 1
  hasMorePages.value = Boolean(value?.hasMore)
  autoLoadedBatches.value = 0
}, { immediate: true })

const canAutoLoadMore = computed(() => autoLoadedBatches.value < MAX_AUTO_LOAD_BATCHES)
const activeFilterCount = computed(() => {
  let count = 0
  if (filters.minDiscount > 0) count += 1
  if (filters.priceCapEnabled) count += 1
  if (filters.activation) count += 1
  if (filters.platform) count += 1
  if (filters.store) count += 1
  if (filters.titleQuery.trim()) count += 1
  if (filters.onlyWithExpiry) count += 1
  if (filters.onlyFavorites) count += 1
  if (filters.onlyDiscounted) count += 1
  return count
})
const dynamicPriceSliderMax = computed(() => {
  const highestLoadedPrice = loadedGames.value.reduce((highest, game) => {
    const gamePrice = Number(game.price[0]?.amount ?? 0)
    return gamePrice > highest ? gamePrice : highest
  }, 100)
  return Math.max(100, Math.ceil(highestLoadedPrice / 50) * 50)
})
const availableStores = computed(() => {
  const stores = new Set<string>()
  loadedGames.value.forEach((game) => {
    if (game.store) {
      stores.add(game.store)
    }
  })
  return Array.from(stores).sort((a, b) => a.localeCompare(b, 'pt-BR'))
})

const sortedGames = computed(() => {
  const list = [...loadedGames.value]

  if (currentSort.value === 'hottest-games') {
    return list
  }

  if (currentSort.value === 'lowest-price') {
    return list.sort((a, b) => (a.price[0]?.amount ?? 0) - (b.price[0]?.amount ?? 0))
  }

  if (currentSort.value === 'highest-price') {
    return list.sort((a, b) => (b.price[0]?.amount ?? 0) - (a.price[0]?.amount ?? 0))
  }

  if (currentSort.value === 'newest-deal') {
    return list.sort((a, b) => {
      const timeA = new Date(a.dealTimestamp ?? 0).getTime()
      const timeB = new Date(b.dealTimestamp ?? 0).getTime()
      return timeB - timeA
    })
  }

  if (currentSort.value === 'title-asc') {
    return list.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'))
  }

  return list.sort((a, b) => (b.discount ?? 0) - (a.discount ?? 0))
})
const filteredGames = computed(() => {
  return sortedGames.value.filter((game) => {
    const price = game.price[0]?.amount ?? 0
    const discount = game.discount ?? 0
    const activation = (game.activation ?? '').toLowerCase()
    const platforms = (game.platforms ?? '').toLowerCase()
    const title = game.title.toLowerCase()
    const store = (game.store ?? '').toLowerCase()
    const isFavorite = gamesStore.favorites.includes(game.id)
    const hasDiscount = discount > 0

    const matchesMinDiscount = discount >= filters.minDiscount
    const matchesMaxPrice = !filters.priceCapEnabled || price <= filters.maxPrice
    const matchesActivation = !filters.activation || activation.includes(filters.activation.toLowerCase())
    const matchesPlatform = !filters.platform || platforms.includes(filters.platform.toLowerCase())
    const matchesStore = !filters.store || store.includes(filters.store.toLowerCase())
    const matchesTitle = !filters.titleQuery || title.includes(filters.titleQuery.toLowerCase())
    const matchesExpiry = !filters.onlyWithExpiry || Boolean(game.expiryAt)
    const matchesFavorite = !filters.onlyFavorites || isFavorite
    const matchesDiscounted = !filters.onlyDiscounted || hasDiscount

    return matchesMinDiscount
      && matchesMaxPrice
      && matchesActivation
      && matchesPlatform
      && matchesStore
      && matchesTitle
      && matchesExpiry
      && matchesFavorite
      && matchesDiscounted
  })
})

const resetFilters = (): void => {
  filters.minDiscount = 0
  filters.maxPrice = dynamicPriceSliderMax.value
  filters.priceCapEnabled = false
  filters.activation = ''
  filters.platform = ''
  filters.store = ''
  filters.titleQuery = ''
  filters.onlyWithExpiry = false
  filters.onlyFavorites = false
  filters.onlyDiscounted = false
}

const openMobileFilters = (): void => {
  isMobileFiltersOpen.value = true
}

const closeMobileFilters = (): void => {
  isMobileFiltersOpen.value = false
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value || 0)
}

watch(dynamicPriceSliderMax, (value) => {
  if (filters.maxPrice > value || !filters.priceCapEnabled) {
    filters.maxPrice = value
  }
}, { immediate: true })

watch(isMobileFiltersOpen, (isOpen) => {
  if (!import.meta.client) {
    return
  }

  document.body.style.overflow = isOpen ? 'hidden' : ''
})

const changeSort = async (sortValue: string): Promise<void> => {
  const safeSort = isValidSortValue(sortValue) ? sortValue : 'hottest-games'
  await router.push({
    query: {
      ...route.query,
      sort: safeSort === 'hottest-games' ? undefined : safeSort
    }
  })
}

const loadMoreGames = async (mode: 'manual' | 'auto' = 'manual'): Promise<void> => {
  if (isLoadingMore.value || !hasMorePages.value) {
    return
  }

  if (mode === 'auto' && !canAutoLoadMore.value) {
    return
  }

  if (mode === 'auto') {
    const now = Date.now()
    if (now - lastAutoLoadAt < AUTO_LOAD_COOLDOWN_MS) {
      return
    }
    lastAutoLoadAt = now
    isAutoLoading.value = true
  }

  isLoadingMore.value = true
  try {
    const nextPage = loadedPages.value + 1
    const nextBatch = await getTopGames(perPage, apiSortValue.value, nextPage)
    const existingIds = new Set(loadedGames.value.map((game) => game.id))
    const uniqueGames = nextBatch.games.filter((game) => !existingIds.has(game.id))

    loadedGames.value = [...loadedGames.value, ...uniqueGames]
    loadedPages.value = nextPage
    hasMorePages.value = nextBatch.hasMore
    if (mode === 'auto') {
      autoLoadedBatches.value += 1
    }
  } catch {
    toast.add({
      title: 'Erro ao carregar mais jogos',
      description: 'Tente novamente em instantes.',
      color: 'red'
    })
  } finally {
    isLoadingMore.value = false
    isAutoLoading.value = false
  }
}

const updateBackToTopVisibility = (): void => {
  showBackToTop.value = window.scrollY > 480
}

const scrollToTop = (): void => {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const errorMessage = computed(() => {
  if (!error.value) {
    return ''
  }

  return 'Nao foi possivel carregar os jogos agora.'
})

watch(
  error,
  (value) => {
    if (value) {
      toast.add({
        title: 'Erro ao carregar catalogo',
        description: 'Tente novamente em instantes.',
        color: 'red'
      })
    }
  },
  { immediate: true }
)

watch(
  [autoLoadTrigger, hasMorePages, canAutoLoadMore],
  ([element, hasMore, canAuto]) => {
    if (autoLoadObserver) {
      autoLoadObserver.disconnect()
      autoLoadObserver = null
    }

    if (!element || !hasMore || !canAuto) {
      return
    }

    autoLoadObserver = new IntersectionObserver(
      (entries) => {
        const first = entries[0]
        if (first?.isIntersecting) {
          void loadMoreGames('auto')
        }
      },
      {
        root: null,
        rootMargin: '500px 0px',
        threshold: 0.01
      }
    )

    autoLoadObserver.observe(element)
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  if (import.meta.client) {
    document.body.style.overflow = ''
  }

  if (autoLoadObserver) {
    autoLoadObserver.disconnect()
    autoLoadObserver = null
  }

  if (removeScrollListener) {
    removeScrollListener()
    removeScrollListener = null
  }
})

onMounted(() => {
  updateBackToTopVisibility()
  const listener = () => updateBackToTopVisibility()
  window.addEventListener('scroll', listener, { passive: true })
  removeScrollListener = () => window.removeEventListener('scroll', listener)
})
</script>
