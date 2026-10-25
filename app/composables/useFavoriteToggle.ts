import type { Game } from '~/composables/useGamesApi'
import { MAX_FAVORITES } from '~/utils/favorites'

export const useFavoriteToggle = () => {
  const gamesStore = useGamesStore()
  const toast = useToast()
  const { enabled, loggedIn } = useAccount()

  return (game: Pick<Game, 'id' | 'slug' | 'title' | 'image'>): void => {
    const result = gamesStore.toggleFavorite(game)
    if (result === 'limit') {
      toast.add({
        title: `Limite de ${MAX_FAVORITES} favoritos atingido`,
        description: 'Remova algum favorito para adicionar outro.',
        color: 'warning'
      })
      return
    }
    if (!enabled || !loggedIn.value) {
      return
    }

    // Signed in: save to the account in the background; undo on failure.
    const { method, url } = planFavoriteSync(result, game.id)
    const body = method === 'PUT' ? { slug: game.slug, title: game.title, image: game.image } : undefined
    $fetch(url, { method, body }).catch(() => {
      gamesStore.toggleFavorite(game)
      toast.add({ title: 'Não foi possível salvar na sua conta', description: 'Tente de novo em instantes.', color: 'error' })
    })
  }
}
