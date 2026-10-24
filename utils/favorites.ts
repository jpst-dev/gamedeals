import type { Game } from '../composables/useGamesApi'

// Favorites live in localStorage. Old versions stored bare ITAD ids; those
// stay as "legacy ids" until their game data can be fetched once.

export type FavoriteGame = {
  id: string
  slug: string
  title: string
  image: string
  addedAt: string
}

export type FavoriteInput = Pick<FavoriteGame, 'id' | 'slug' | 'title' | 'image'>

export type FavoritesState = {
  items: FavoriteGame[]
  legacyIds: string[]
}

export type ToggleResult = 'added' | 'removed' | 'limit'

export const MAX_FAVORITES = 50

const toFavoriteGame = (entry: Record<string, unknown>): FavoriteGame | null => {
  const id = typeof entry.id === 'string' ? entry.id.trim() : ''
  if (!id) {
    return null
  }

  return {
    id,
    slug: typeof entry.slug === 'string' ? entry.slug : '',
    title: typeof entry.title === 'string' ? entry.title : '',
    image: typeof entry.image === 'string' ? entry.image : '',
    addedAt: typeof entry.addedAt === 'string' ? entry.addedAt : new Date(0).toISOString()
  }
}

export const parseStoredFavorites = (raw: string | null): FavoritesState => {
  const empty: FavoritesState = { items: [], legacyIds: [] }
  if (!raw) {
    return empty
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return empty
  }

  if (!Array.isArray(parsed)) {
    return empty
  }

  const seen = new Set<string>()
  const state: FavoritesState = { items: [], legacyIds: [] }
  for (const entry of parsed) {
    if (seen.size >= MAX_FAVORITES) {
      break
    }

    if (typeof entry === 'string') {
      const id = entry.trim()
      if (id && !seen.has(id)) {
        seen.add(id)
        state.legacyIds.push(id)
      }
      continue
    }

    const favorite = entry && typeof entry === 'object' ? toFavoriteGame(entry as Record<string, unknown>) : null
    if (favorite && !seen.has(favorite.id)) {
      seen.add(favorite.id)
      state.items.push(favorite)
    }
  }

  return state
}

export const toggleFavoriteEntry = (
  state: FavoritesState,
  game: FavoriteInput,
  now = new Date()
): FavoritesState & { result: ToggleResult } => {
  if (state.items.some((item) => item.id === game.id) || state.legacyIds.includes(game.id)) {
    return {
      items: state.items.filter((item) => item.id !== game.id),
      legacyIds: state.legacyIds.filter((id) => id !== game.id),
      result: 'removed'
    }
  }

  if (state.items.length + state.legacyIds.length >= MAX_FAVORITES) {
    return { ...state, result: 'limit' }
  }

  const added: FavoriteGame = { id: game.id, slug: game.slug, title: game.title, image: game.image, addedAt: now.toISOString() }
  return { items: [...state.items, added], legacyIds: state.legacyIds, result: 'added' }
}

export const migrateLegacyIds = async (
  legacyIds: string[],
  toFavorite: (id: string) => Promise<FavoriteGame>
): Promise<{ migrated: FavoriteGame[]; pendingIds: string[] }> => {
  const results = await Promise.allSettled(legacyIds.map((id) => toFavorite(id)))
  const migrated: FavoriteGame[] = []
  const pendingIds: string[] = []
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      migrated.push(result.value)
    } else {
      pendingIds.push(legacyIds[index]!)
    }
  })

  return { migrated, pendingIds }
}

export type FavoriteCard = { game: Game; noOffer: boolean }

// Games on sale first; within each group, the most recently favorited first.
export const buildFavoriteCards = (items: FavoriteGame[], bestPrices: Map<string, number>): FavoriteCard[] => {
  return items
    .map((item) => {
      const price = bestPrices.get(item.id)
      const game: Game = {
        id: item.id,
        slug: item.slug,
        title: item.title,
        image: item.image,
        images: item.image ? [item.image] : [],
        price: price === undefined ? [] : [{ amount: price }]
      }
      return { game, noOffer: price === undefined, addedAt: item.addedAt }
    })
    .sort((a, b) => Number(a.noOffer) - Number(b.noOffer) || b.addedAt.localeCompare(a.addedAt))
    .map(({ game, noOffer }) => ({ game, noOffer }))
}
