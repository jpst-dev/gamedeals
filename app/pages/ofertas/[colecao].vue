<template>
  <CatalogPage :preset="collection.state" :collection-slug="collection.slug" />
</template>

<script setup lang="ts">
import { findCollection } from '~/utils/catalog'

const route = useRoute()
const found = findCollection(String(route.params.colecao ?? ''))
if (!found) {
  throw createError({ statusCode: 404, statusMessage: 'Coleção não encontrada', fatal: true })
}
const collection = found
</script>
