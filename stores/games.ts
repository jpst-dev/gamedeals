import { slugify, type Game, type GameInfo } from '~/composables/useGamesApi'
import {
  migrateLegacyIds,
  parseStoredFavorites,
  toggleFavoriteEntry,
  type FavoriteGame,
  type FavoriteInput,
  type ToggleResult
} from '~/utils/favorites'

type PriceFilter = {
  min: number | null
  max: number | null
}

const FAVORITES_STORAGE_KEY = 'gamedeals:favorites'

export const useGamesStore = defineStore('games', () => {
  const favorites = ref<FavoriteGame[]>([])
  // Ids saved by older versions, waiting for their game data.
  const legacyFavoriteIds = ref<string[]>([])
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

  const isFavorite = (gameId: string): boolean => {
    return favorites.value.some((item) => item.id === gameId) || legacyFavoriteIds.value.includes(gameId)
  }

  const toggleFavorite = (game: FavoriteInput): ToggleResult => {
    const next = toggleFavoriteEntry({ items: favorites.value, legacyIds: legacyFavoriteIds.value }, game)
    favorites.value = next.items
    legacyFavoriteIds.value = next.legacyIds
    return next.result
  }

  const migrateLegacyFavorites = async (getInfo: (gameId: string) => Promise<GameInfo>): Promise<void> => {
    if (legacyFavoriteIds.value.length === 0) {
      return
    }

    const { migrated, pendingIds } = await migrateLegacyIds(legacyFavoriteIds.value, async (gameId) => {
      const info = await getInfo(gameId)
      return { id: gameId, slug: slugify(info.title), title: info.title, image: info.image, addedAt: new Date().toISOString() }
    })
    const known = new Set(favorites.value.map((item) => item.id))
    favorites.value = [...favorites.value, ...migrated.filter((item) => !known.has(item.id))]
    legacyFavoriteIds.value = pendingIds
  }

  const hydrateFavorites = (): void => {
    if (!import.meta.client) {
      return
    }

    let raw: string | null = null
    try {
      raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY)
    } catch {
      raw = null
    }

    const stored = parseStoredFavorites(raw)
    favorites.value = stored.items
    legacyFavoriteIds.value = stored.legacyIds
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
    // Pending legacy ids are saved too, so a failed migration retries later.
    watch([favorites, legacyFavoriteIds], ([items, legacyIds]) => {
      try {
        window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify([...items, ...legacyIds]))
      } catch {
        // Storage full or blocked: favorites still work for this visit.
      }
    }, { deep: true })
  }

  return {
    favorites,
    isFavorite,
    migrateLegacyFavorites,
    priceFilter,
    searchResults,
    filteredResults,
    setSearchResults,
    setPriceFilter,
    toggleFavorite
  }
})
