import type { Suggestion } from '../../shared/types/suggest'

const browserStorage = (): Storage | null => {
  try {
    return import.meta.client ? window.localStorage : null
  } catch {
    return null
  }
}

// State for the header search. Suggestions load from typing (onInput), never
// from a watcher on the value: filling the box from the URL with setTerm
// can't swallow the next keystroke.
export const useSearchSuggestions = () => {
  const term = ref('')
  const suggestions = ref<Suggestion[]>([])
  const loading = ref(false)
  const recent = ref<string[]>([])
  const loader = createSuggestionLoader((q) => $fetch<Suggestion[]>('/api/games/suggest', { query: { q, limit: 8 } }))
  let timer: ReturnType<typeof setTimeout> | null = null

  const run = async (value: string): Promise<void> => {
    try {
      const list = await loader.load(value)
      if (list !== null) {
        suggestions.value = list
        loading.value = false
      }
    } catch {
      suggestions.value = []
      loading.value = false
    }
  }

  const onInput = (value: string): void => {
    term.value = value
    if (timer) {
      clearTimeout(timer)
    }
    if (normalizeSearchTerm(value).length < MIN_SEARCH_LENGTH) {
      suggestions.value = []
      loading.value = false
      return
    }
    loading.value = true
    timer = setTimeout(() => void run(value), SEARCH_DEBOUNCE_MS)
  }

  const setTerm = (value: string): void => {
    term.value = value
  }

  const remember = (value: string): void => {
    recent.value = addRecentSearch(recent.value, value)
    writeRecentSearches(browserStorage(), recent.value)
  }

  const clearRecent = (): void => {
    recent.value = []
    writeRecentSearches(browserStorage(), [])
  }

  onMounted(() => {
    recent.value = readRecentSearches(browserStorage())
  })

  onBeforeUnmount(() => {
    if (timer) {
      clearTimeout(timer)
    }
  })

  return { term, suggestions, loading, recent, onInput, setTerm, remember, clearRecent }
}
