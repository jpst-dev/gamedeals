<template>
  <NuxtLayout>
    <div class="flex min-h-screen flex-col bg-gray-950 text-gray-100">
      <header class="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-gray-950/55 backdrop-blur-md">
        <UContainer class="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <NuxtLink
            to="/"
            class="text-lg font-semibold text-primary-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            aria-label="Go to home page"
          >
            {{ appName }}
          </NuxtLink>

          <div ref="searchContainerRef" class="relative w-full sm:w-80">
            <form @submit.prevent="handleSearchSubmit">
              <label for="global-search" class="sr-only">Search game by name</label>
              <UInput
                id="global-search"
                v-model="searchValue"
                icon="i-heroicons-magnifying-glass"
                placeholder="Buscar jogo..."
                autocomplete="off"
                aria-label="Search game by name"
                @focus="handleSearchFocus"
                @blur="handleSearchBlur"
                @keydown.down.prevent="moveHighlightedSuggestion(1)"
                @keydown.up.prevent="moveHighlightedSuggestion(-1)"
                @keydown.esc.prevent="closeSuggestions"
                @keydown.enter="handleSearchEnter"
              />
            </form>

            <div
              v-if="showSuggestions"
              class="custom-scrollbar absolute z-[120] mt-2 max-h-96 w-full overflow-y-auto rounded-lg border border-gray-700 bg-gray-900 shadow-xl"
            >
              <div v-if="isSuggestionsLoading" class="px-3 py-2 text-xs text-gray-400">
                Buscando jogos...
              </div>

              <button
                v-for="(suggestion, index) in suggestions"
                :key="suggestion.id"
                type="button"
                class="flex w-full items-center gap-3 border-b border-gray-800 px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-gray-800/70"
                :class="index === highlightedSuggestionIndex ? 'bg-gray-800/80' : ''"
                @mousedown.prevent="selectSuggestion(suggestion)"
                @mouseenter="highlightedSuggestionIndex = index"
              >
                <img
                  :src="suggestion.image || fallbackCover"
                  :alt="`Cover image for ${suggestion.title}`"
                  class="h-10 w-7 rounded object-cover"
                  loading="lazy"
                >
                <div class="min-w-0">
                  <p class="truncate text-sm font-medium text-gray-100">{{ suggestion.title }}</p>
                  <p class="text-xs uppercase tracking-wide text-gray-400">{{ suggestion.type || 'game' }}</p>
                </div>
              </button>

              <div v-if="!isSuggestionsLoading && suggestions.length === 0" class="px-3 py-2 text-xs text-gray-400">
                Nenhum jogo encontrado.
              </div>
            </div>
          </div>
        </UContainer>
      </header>

      <main class="flex-1 pb-6 pt-28 sm:pt-24">
        <UContainer>
          <NuxtPage />
        </UContainer>
      </main>

      <footer class="border-t border-gray-800 py-4 text-center text-sm text-gray-400">
        <UContainer>
          <p>Dados de preco fornecidos por IsThereAnyDeal.</p>
        </UContainer>
      </footer>
      <UNotifications />
    </div>
  </NuxtLayout>
</template>

<script setup lang="ts">
import type { GameSuggestion } from '~/composables/useGamesApi'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { searchGameSuggestions } = useGamesApi()
const runtimeConfig = useRuntimeConfig()
const appName = computed(() => runtimeConfig.public.appName || 'GameDeals BR')

const searchValue = ref('')
const suggestions = ref<GameSuggestion[]>([])
const showSuggestions = ref(false)
const isSuggestionsLoading = ref(false)
const highlightedSuggestionIndex = ref(-1)
const isSearchFocused = ref(false)
const searchContainerRef = ref<HTMLElement | null>(null)
const fallbackCover = 'https://placehold.co/120x180/111827/e5e7eb?text=No+Image'
const suppressSuggestionsFetch = ref(false)
let suggestionsDebounceTimer: ReturnType<typeof setTimeout> | null = null
let lastSuggestionsRequestId = 0

const closeSuggestions = (): void => {
  showSuggestions.value = false
  highlightedSuggestionIndex.value = -1
}

const runSearch = async (): Promise<void> => {
  const cleanValue = searchValue.value.trim()
  if (!cleanValue) {
    return
  }

  try {
    await router.push({
      path: '/search',
      query: { q: cleanValue }
    })
  } catch {
    toast.add({
      title: 'Erro ao buscar',
      description: 'Nao foi possivel abrir os resultados.',
      color: 'red'
    })
  }
}

const fetchSuggestions = async (): Promise<void> => {
  const cleanValue = searchValue.value.trim()
  if (cleanValue.length < 2) {
    suggestions.value = []
    closeSuggestions()
    return
  }

  const requestId = ++lastSuggestionsRequestId
  isSuggestionsLoading.value = true
  try {
    const result = await searchGameSuggestions(cleanValue, 8)
    if (requestId !== lastSuggestionsRequestId) {
      return
    }
    suggestions.value = result
    showSuggestions.value = true
    highlightedSuggestionIndex.value = result.length > 0 ? 0 : -1
  } catch {
    if (requestId !== lastSuggestionsRequestId) {
      return
    }
    suggestions.value = []
    showSuggestions.value = true
  } finally {
    if (requestId === lastSuggestionsRequestId) {
      isSuggestionsLoading.value = false
    }
  }
}

const queueSuggestionsFetch = (): void => {
  if (suggestionsDebounceTimer) {
    clearTimeout(suggestionsDebounceTimer)
  }

  suggestionsDebounceTimer = setTimeout(() => {
    void fetchSuggestions()
  }, 650)
}

const selectSuggestion = async (suggestion: GameSuggestion): Promise<void> => {
  closeSuggestions()
  suppressSuggestionsFetch.value = true
  searchValue.value = suggestion.title
  isSearchFocused.value = false
  try {
    await router.push(`/game/${suggestion.slug}`)
  } catch {
    toast.add({
      title: 'Erro ao abrir jogo',
      description: 'Nao foi possivel abrir os detalhes do jogo.',
      color: 'red'
    })
  }
}

const moveHighlightedSuggestion = (step: 1 | -1): void => {
  if (!showSuggestions.value || suggestions.value.length === 0) {
    return
  }

  if (highlightedSuggestionIndex.value < 0) {
    highlightedSuggestionIndex.value = 0
    return
  }

  const total = suggestions.value.length
  highlightedSuggestionIndex.value = (highlightedSuggestionIndex.value + step + total) % total
}

const handleSearchEnter = async (event: KeyboardEvent): Promise<void> => {
  if (!showSuggestions.value) {
    return
  }

  const activeSuggestion = suggestions.value[highlightedSuggestionIndex.value]
  if (activeSuggestion) {
    event.preventDefault()
    await selectSuggestion(activeSuggestion)
  }
}

const handleSearchSubmit = async (): Promise<void> => {
  isSearchFocused.value = false
  closeSuggestions()
  await runSearch()
}

const handleSearchFocus = (): void => {
  isSearchFocused.value = true
  if (searchValue.value.trim().length >= 2) {
    showSuggestions.value = true
    if (suggestions.value.length === 0) {
      queueSuggestionsFetch()
    }
  }
}

const handleSearchBlur = (): void => {
  isSearchFocused.value = false
}

watch(
  () => route.query.q,
  (queryValue) => {
    const safeValue = typeof queryValue === 'string' ? queryValue : ''
    suppressSuggestionsFetch.value = true
    searchValue.value = safeValue
  },
  { immediate: true }
)

watch(searchValue, () => {
  if (suppressSuggestionsFetch.value) {
    suppressSuggestionsFetch.value = false
    return
  }
  if (!isSearchFocused.value) {
    return
  }
  queueSuggestionsFetch()
})

const handleClickOutside = (event: MouseEvent) => {
  const container = searchContainerRef.value
  const target = event.target as Node | null
  if (!container || !target) {
    return
  }

  if (!container.contains(target)) {
    closeSuggestions()
  }
}

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleClickOutside)
  if (suggestionsDebounceTimer) {
    clearTimeout(suggestionsDebounceTimer)
  }
})
</script>

<style>
:root {
  scrollbar-color: rgba(148, 163, 184, 0.45) transparent;
  scrollbar-width: thin;
}

html,
body {
  scrollbar-color: rgba(148, 163, 184, 0.45) transparent;
  scrollbar-width: thin;
}

html::-webkit-scrollbar,
body::-webkit-scrollbar,
.custom-scrollbar::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

html::-webkit-scrollbar-track,
body::-webkit-scrollbar-track,
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

html::-webkit-scrollbar-thumb,
body::-webkit-scrollbar-thumb,
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(148, 163, 184, 0.4);
  border-radius: 9999px;
  border: 2px solid transparent;
  background-clip: content-box;
}

html::-webkit-scrollbar-thumb:hover,
body::-webkit-scrollbar-thumb:hover,
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: rgba(148, 163, 184, 0.62);
}
</style>
