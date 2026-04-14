import type { Game } from '~/composables/useGamesApi'

type PriceFilter = {
  min: number | null
  max: number | null
}

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

  const filteredResults = computed(() => {
    return searchResults.value.filter((game) => {
      const bestPrice = Math.min(...game.price.map((entry) => entry.amount))
      const minOk = priceFilter.value.min === null || bestPrice >= priceFilter.value.min
      const maxOk = priceFilter.value.max === null || bestPrice <= priceFilter.value.max
      return minOk && maxOk
    })
  })

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
