<template>
  <div v-if="tags.length > 0" class="flex flex-wrap items-center gap-2">
    <span
      v-for="tag in tags"
      :key="tag.key"
      class="inline-flex items-center gap-1 rounded-full bg-gray-800 py-0.5 pl-3 pr-1 text-xs text-gray-100"
    >
      {{ tag.label }}
      <button
        type="button"
        class="rounded-full px-1.5 text-gray-400 hover:bg-gray-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#66c0f4]"
        :aria-label="`Remover filtro ${tag.label}`"
        @click="emit('remove', tag.remove)"
      >
        ✕
      </button>
    </span>
    <button type="button" class="text-xs font-medium text-[#66c0f4] hover:underline" @click="emit('clear')">
      Limpar tudo
    </button>
  </div>
</template>

<script setup lang="ts">
import type { ActiveFilterTag, CatalogState } from '~/utils/catalog'

defineProps<{
  tags: ActiveFilterTag[]
}>()

const emit = defineEmits<{
  (event: 'remove', patch: Partial<CatalogState>): void
  (event: 'clear'): void
}>()
</script>
