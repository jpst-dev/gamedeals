<template>
  <USlideover v-model:open="open" side="left" title="DealsGamer" :ui="{ content: 'max-w-xs' }">
    <template #body>
      <nav class="flex flex-col gap-1 text-base" aria-label="Seções">
        <NuxtLink
          v-for="link in HEADER_LINKS"
          :key="link.to"
          :to="link.to"
          class="rounded-lg px-3 py-2.5"
          :class="isActiveLink(route.path, route.fullPath, link) ? 'bg-gray-800 text-white' : 'text-gray-300 hover:bg-gray-800/60'"
        >
          {{ link.label }}
        </NuxtLink>

        <UCollapsible @update:open="(value: boolean) => value && emit('load-shops')">
          <button type="button" class="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-gray-300 hover:bg-gray-800/60">
            Por loja
            <UIcon name="i-heroicons-chevron-down" class="h-4 w-4" aria-hidden="true" />
          </button>
          <template #content>
            <div class="ml-3 flex max-h-72 flex-col overflow-y-auto border-l border-gray-800 pl-2">
              <p v-if="shops.length === 0" class="px-3 py-2 text-sm text-gray-500">Carregando lojas…</p>
              <NuxtLink
                v-for="shop in shops"
                :key="shop.id"
                :to="shopLink(shop.id)"
                class="rounded-md px-3 py-1.5 text-sm text-gray-400 hover:bg-gray-800/60 hover:text-white"
              >
                {{ shop.title }}
              </NuxtLink>
            </div>
          </template>
        </UCollapsible>

        <div class="my-2 border-t border-gray-800" />

        <NuxtLink to="/favoritos" class="rounded-lg px-3 py-2.5 text-gray-300 hover:bg-gray-800/60">Favoritos</NuxtLink>
        <template v-if="accountsEnabled">
          <template v-if="loggedIn">
            <NuxtLink to="/conta" class="rounded-lg px-3 py-2.5 text-gray-300 hover:bg-gray-800/60">Minha conta</NuxtLink>
            <button type="button" class="rounded-lg px-3 py-2.5 text-left text-gray-300 hover:bg-gray-800/60" @click="logout()">
              Sair
            </button>
          </template>
          <NuxtLink v-else to="/entrar" class="rounded-lg px-3 py-2.5 font-medium text-green-400 hover:bg-gray-800/60">Entrar</NuxtLink>
        </template>
      </nav>
    </template>
  </USlideover>
</template>

<script setup lang="ts">
defineProps<{ shops: { id: number; title: string }[] }>()
const emit = defineEmits<{ 'load-shops': [] }>()
const open = defineModel<boolean>('open', { default: false })

const route = useRoute()
const { enabled: accountsEnabled, loggedIn, logout } = useAccount()
</script>
