import type { Game } from '~/composables/useGamesApi'

type PriceFilter = {
  min: number | null
  max: number | null
}

const FAVORITES_STORAGE_KEY = 'gamedeals:favorites'

export const useGamesStore = defineStore('games', () => {
  const favorites = ref<string[]>([])
  const priceFilter = ref<PriceFilter>({
    min: null,
    max: null
  })
  const searchResults = ref<Game[]>([])

  const setSearchResults = (games: Game[]): void => {
    searchResults.value = games
  }

  const setPriceFilter = (min: number | null, max: number | null): void => {
    priceFilter.value = {
      min,
      max
    }
  }

  const toggleFavorite = (gameId: string): void => {
    if (favorites.value.includes(gameId)) {
      favorites.value = favorites.value.filter((id) => id !== gameId)
      return
    }

    favorites.value.push(gameId)
  }

  const hydrateFavorites = (): void => {
    if (!import.meta.client) {
      return
    }

    try {
      const rawFavorites = window.localStorage.getItem(FAVORITES_STORAGE_KEY)
      if (!rawFavorites) {
        return
      }

      const parsed = JSON.parse(rawFavorites)
      if (Array.isArray(parsed)) {
        favorites.value = parsed
          .map((entry) => String(entry))
          .filter(Boolean)
      }
    } catch {
      favorites.value = []
    }
  }

  const filteredResults = computed(() => {
    return searchResults.value.filter((game) => {
      const bestPrice = Math.min(...game.price.map((entry) => entry.amount))
      const minOk = priceFilter.value.min === null || bestPrice >= priceFilter.value.min
      const maxOk = priceFilter.value.max === null || bestPrice <= priceFilter.value.max
      return minOk && maxOk
    })
  })

  if (import.meta.client) {
    hydrateFavorites()
    watch(favorites, (nextFavorites) => {
      window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(nextFavorites))
    }, { deep: true })
  }

  return {
    favorites,
    priceFilter,
    searchResults,
    filteredResults,
    setSearchResults,
    setPriceFilter,
    toggleFavorite
  }
})
