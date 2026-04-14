<template>
  <div class="space-y-4 rounded-xl border border-gray-800 bg-gray-900 p-4">
    <UTable
      :rows="paginatedRows"
      :columns="columns"
      :ui="{ td: { base: 'text-gray-100' }, th: { base: 'text-gray-300' } }"
    >
      <template #price-data="{ row }">
        {{ formatCurrency(row.price) }}
      </template>

      <template #regularPrice-data="{ row }">
        {{ formatCurrency(row.regularPrice ?? 0) }}
      </template>

      <template #discount-data="{ row }">
        {{ row.discount }}%
      </template>

      <template #activation-data="{ row }">
        <span class="text-xs text-primary-300">{{ row.activation }}</span>
      </template>

      <template #platforms-data="{ row }">
        <span class="text-xs text-gray-300">{{ row.platforms }}</span>
      </template>

      <template #region-data="{ row }">
        <span class="text-xs text-gray-300">{{ row.region }}</span>
      </template>

      <template #link-data="{ row }">
        <UButton
          size="xs"
          variant="ghost"
          color="primary"
          :to="row.link"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open affiliate link"
        >
          Ver oferta
        </UButton>
      </template>
    </UTable>

    <div v-if="totalPages > 1" class="flex items-center justify-between border-t border-gray-800 pt-3">
      <p class="text-xs text-gray-400">
        Mostrando {{ pageStart + 1 }}-{{ Math.min(pageStart + perPage, normalizedRows.length) }} de {{ normalizedRows.length }} ofertas
      </p>

      <div class="flex items-center gap-2">
        <UButton
          size="xs"
          variant="outline"
          :disabled="currentPage === 1"
          aria-label="Previous offers page"
          @click="currentPage -= 1"
        >
          Anterior
        </UButton>
        <span class="text-xs text-gray-300">Pagina {{ currentPage }} de {{ totalPages }}</span>
        <UButton
          size="xs"
          variant="outline"
          :disabled="currentPage >= totalPages"
          aria-label="Next offers page"
          @click="currentPage += 1"
        >
          Proxima
        </UButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PriceRow } from '~/composables/useGamesApi'

const props = defineProps<{
  rows: PriceRow[]
}>()

const columns = [
  { key: 'store', label: 'Loja' },
  { key: 'price', label: 'Preco' },
  { key: 'regularPrice', label: 'Preco original' },
  { key: 'discount', label: 'Desconto' },
  { key: 'activation', label: 'Ativacao' },
  { key: 'platforms', label: 'Plataforma' },
  { key: 'region', label: 'Regiao' },
  { key: 'link', label: 'Link afiliado' }
]

const currentPage = ref(1)
const perPage = 8

const normalizedRows = computed(() => {
  return props.rows.map((row) => ({
    ...row,
    discount: Number.isFinite(row.discount) ? row.discount : 0
  })).sort((a, b) => a.price - b.price)
})

const totalPages = computed(() => Math.max(1, Math.ceil(normalizedRows.value.length / perPage)))
const pageStart = computed(() => (currentPage.value - 1) * perPage)
const paginatedRows = computed(() => normalizedRows.value.slice(pageStart.value, pageStart.value + perPage))

watch(normalizedRows, () => {
  currentPage.value = 1
})

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value ?? 0)
}
</script>
