<template>
  <UApp>
    <NuxtLayout>
      <div class="flex min-h-screen flex-col bg-gray-950 text-gray-100">
        <HeaderBar />

        <main class="flex-1 pb-6 pt-20 sm:pt-32">
          <UContainer>
            <NuxtPage />
          </UContainer>
        </main>

        <footer class="border-t border-gray-800 py-4 text-center text-sm text-gray-400">
          <UContainer>
            <p>Dados de preço fornecidos por IsThereAnyDeal.</p>
            <p v-if="accountsEnabled" class="mt-1">
              <NuxtLink to="/privacidade" class="hover:text-white">Privacidade</NuxtLink>
            </p>
          </UContainer>
        </footer>
      </div>
    </NuxtLayout>
  </UApp>
</template>

<script setup lang="ts">
const gamesStore = useGamesStore()
const { getGameInfo } = useGamesApi()
const { enabled: accountsEnabled, loggedIn, refreshFavorites } = useAccount()

onMounted(() => {
  gamesStore.loadFavorites()
  void gamesStore.migrateLegacyFavorites(getGameInfo)
  if (accountsEnabled && loggedIn.value) {
    // Picks up changes made on other devices; offline it keeps the local copy.
    refreshFavorites().catch(() => {})
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
