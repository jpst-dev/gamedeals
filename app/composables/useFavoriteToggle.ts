import type { Game } from '~/composables/useGamesApi'
import { MAX_FAVORITES } from '~/utils/favorites'

export const useFavoriteToggle = () => {
  const gamesStore = useGamesStore()
  const toast = useToast()

  return (game: Pick<Game, 'id' | 'slug' | 'title' | 'image'>): void => {
    if (gamesStore.toggleFavorite(game) === 'limit') {
      toast.add({
        title: `Limite de ${MAX_FAVORITES} favoritos atingido`,
        description: 'Remova algum favorito para adicionar outro.',
        color: 'orange'
      })
    }
  }
}
