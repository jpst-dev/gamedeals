import type { FavoriteGame } from '~/utils/favorites'

export const planFavoriteSync = (action: 'added' | 'removed', gameId: string): { method: 'PUT' | 'DELETE'; url: string } => {
  return { method: action === 'added' ? 'PUT' : 'DELETE', url: `/api/favorites/${encodeURIComponent(gameId)}` }
}

// Signed-in visitors keep favorites in their account; the browser copy is
// a cache. `enabled` is false until the own domain exists.
export const useAccount = () => {
  const enabled = useRuntimeConfig().public.accountsEnabled
  const { loggedIn, user, clear, fetch: fetchSession } = useUserSession()
  const gamesStore = useGamesStore()

  const email = computed(() => user.value?.email ?? null)

  // After every sign-in (and on load while signed in): the browser's
  // favorites join the account's, and the browser shows the result.
  const syncAfterLogin = async (): Promise<void> => {
    const merged = await $fetch<FavoriteGame[]>('/api/favorites/merge', {
      method: 'POST',
      body: { items: gamesStore.favorites }
    })
    gamesStore.replaceFavorites(merged)
  }

  // Signing out clears the browser copy, so a game removed on one device
  // can't come back from another.
  const logout = async (): Promise<void> => {
    await $fetch('/api/auth/logout', { method: 'POST' })
    await clear()
    gamesStore.clearFavorites()
    await navigateTo('/')
  }

  return { enabled, loggedIn, email, fetchSession, logout, syncAfterLogin }
}

// Account pages don't exist while accounts are hidden.
export const requireAccountsPage = (): void => {
  if (!useRuntimeConfig().public.accountsEnabled) {
    throw createError({ statusCode: 404, statusMessage: 'Página não encontrada', fatal: true })
  }
}
