<template>
  <header class="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-gray-950/70 backdrop-blur-md">
    <UContainer class="flex h-14 items-center gap-3 sm:h-16 sm:gap-6">
      <button
        type="button"
        class="-ml-1 rounded-md p-1.5 text-gray-300 hover:text-white sm:hidden"
        aria-label="Abrir menu"
        @click="menuOpen = true"
      >
        <UIcon name="i-heroicons-bars-3" class="h-6 w-6" />
      </button>

      <NuxtLink
        to="/"
        class="shrink-0 text-lg font-extrabold tracking-tight text-white focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-green-400 sm:text-xl"
        aria-label="DealsGamer, página inicial"
      >
        Deals<span class="text-green-400">Gamer</span>
      </NuxtLink>

      <div class="hidden max-w-2xl flex-1 sm:block">
        <HeaderSearch ref="searchRef" />
      </div>

      <div class="ml-auto flex items-center gap-1 sm:gap-3">
        <button
          type="button"
          class="rounded-md p-1.5 text-gray-300 hover:text-white sm:hidden"
          aria-label="Buscar"
          @click="searchOpen = true"
        >
          <UIcon name="i-heroicons-magnifying-glass" class="h-6 w-6" />
        </button>

        <NuxtLink
          to="/favoritos"
          class="relative rounded-md p-1.5 text-gray-300 transition-colors hover:text-white"
          active-class="text-white!"
          :aria-label="`Favoritos, ${favoritesCount} ${favoritesCount === 1 ? 'jogo' : 'jogos'}`"
        >
          <UIcon name="i-heroicons-heart" class="h-6 w-6" />
          <ClientOnly>
            <span
              v-if="favoritesCount > 0"
              class="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-[#66c0f4] px-1 text-center text-[10px] font-bold leading-4 text-gray-950"
              aria-hidden="true"
            >
              {{ favoritesCount }}
            </span>
          </ClientOnly>
        </NuxtLink>

        <template v-if="accountsEnabled">
          <UDropdownMenu v-if="loggedIn" :items="accountItems" :content="{ align: 'end' }">
            <button
              type="button"
              class="hidden h-8 w-8 place-items-center rounded-full bg-green-900 text-sm font-bold text-green-300 ring-1 ring-green-400/30 hover:ring-green-400 sm:grid"
              :aria-label="`Conta de ${email ?? ''}`"
            >
              {{ initial }}
            </button>
          </UDropdownMenu>
          <NuxtLink
            v-else
            to="/entrar"
            class="hidden rounded-lg border border-gray-700 px-3 py-1.5 text-sm font-medium text-gray-200 hover:border-gray-500 hover:text-white sm:inline-block"
          >
            Entrar
          </NuxtLink>
        </template>
      </div>
    </UContainer>

    <nav class="hidden border-t border-white/5 bg-gray-950/40 sm:block" aria-label="Seções">
      <UContainer class="flex h-10 items-center gap-5 overflow-x-auto text-sm">
        <NuxtLink
          v-for="link in HEADER_LINKS"
          :key="link.to"
          :to="link.to"
          class="relative shrink-0 py-2.5 transition-colors"
          :class="isActiveLink(route.path, route.fullPath, link)
            ? 'text-white after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-green-400'
            : 'text-gray-400 hover:text-white'"
          :aria-current="isActiveLink(route.path, route.fullPath, link) ? 'page' : undefined"
        >
          {{ link.label }}
        </NuxtLink>

        <UDropdownMenu :items="shopItems" :ui="{ content: 'max-h-80 overflow-y-auto' }" @update:open="loadShops">
          <button type="button" class="flex shrink-0 items-center gap-1 py-2.5 text-gray-400 hover:text-white">
            Por loja
            <UIcon name="i-heroicons-chevron-down" class="h-4 w-4" aria-hidden="true" />
          </button>
        </UDropdownMenu>
      </UContainer>
    </nav>

    <HeaderMobileMenu v-model:open="menuOpen" :shops="shops" @load-shops="loadShops" />

    <Teleport to="body">
      <div
        v-if="searchOpen"
        class="fixed inset-0 z-[200] overflow-y-auto bg-gray-950 p-3 sm:hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Buscar jogos"
      >
        <HeaderSearch fullscreen @close="searchOpen = false" />
      </div>
    </Teleport>
  </header>
</template>

<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

type Shop = { id: number; title: string }

const route = useRoute()
const gamesStore = useGamesStore()
const { enabled: accountsEnabled, loggedIn, email, logout } = useAccount()

const favoritesCount = computed(() => gamesStore.favorites.length)
const initial = computed(() => (email.value ?? '?').charAt(0).toUpperCase())
const menuOpen = ref(false)
const searchOpen = ref(false)
const searchRef = ref<{ focus: () => void } | null>(null)
const shops = ref<Shop[]>([])

const accountItems = computed<DropdownMenuItem[][]>(() => [
  [{ label: email.value ?? '', type: 'label' }],
  [
    { label: 'Minha conta', icon: 'i-heroicons-user-circle', to: '/conta' },
    { label: 'Sair', icon: 'i-heroicons-arrow-right-on-rectangle', onSelect: () => void logout() }
  ]
])

const shopItems = computed<DropdownMenuItem[]>(() => shops.value.length > 0
  ? shops.value.map((shop) => ({ label: shop.title, to: shopLink(shop.id) }))
  : [{ label: 'Carregando lojas…', disabled: true }])

// Shops load the first time a menu opens, not on every page view.
let shopsRequest: Promise<void> | null = null
const loadShops = (): void => {
  shopsRequest ??= $fetch<Shop[]>('/api/shops')
    .then((list) => {
      shops.value = sortShops(list)
    })
    .catch(() => {
      shopsRequest = null
    })
}

watch(() => route.fullPath, () => {
  menuOpen.value = false
  searchOpen.value = false
})

const handleShortcut = (event: KeyboardEvent): void => {
  if (!isSearchShortcut(event)) {
    return
  }
  event.preventDefault()
  if (window.matchMedia('(min-width: 640px)').matches) {
    searchRef.value?.focus()
  } else {
    searchOpen.value = true
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleShortcut)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleShortcut)
})
</script>
