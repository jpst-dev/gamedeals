<template>
  <div class="relative w-full overflow-hidden bg-gray-900" :style="{ aspectRatio: String(ratio) }">
    <template v-if="currentSource">
      <div
        v-if="fit === 'contain'"
        class="absolute inset-0 scale-110 bg-cover bg-center blur-xl brightness-50"
        :style="{ backgroundImage: `url('${currentSource}')` }"
        aria-hidden="true"
      />
      <img
        :key="currentSource"
        ref="imageRef"
        :src="currentSource"
        :alt="`Capa de ${title}`"
        class="absolute inset-0 h-full w-full"
        :class="fit === 'contain' ? 'object-contain' : 'object-cover'"
        :loading="eager ? 'eager' : 'lazy'"
        decoding="async"
        @load="handleLoad"
        @error="handleError"
      >
    </template>

    <div
      v-else
      class="absolute inset-0 flex items-center justify-center p-3 text-center"
      :style="{ background: generatedBackground }"
      role="img"
      :aria-label="`Capa de ${title}`"
    >
      <span class="line-clamp-4 text-sm font-bold text-gray-100 sm:text-base">{{ title }}</span>
    </div>

    <slot />
  </div>
</template>

<script setup lang="ts">
import { getCoverFit, hueFromString, type CoverFit } from '~/utils/cover'

const props = withDefaults(defineProps<{
  sources: string[]
  title: string
  ratio?: number
  eager?: boolean
  fit?: 'auto' | 'cover'
}>(), {
  ratio: 2 / 3,
  eager: false,
  fit: 'auto'
})

const sourceIndex = ref(0)
const detectedFit = ref<CoverFit>('cover')

const usableSources = computed(() => props.sources.filter(Boolean))
const currentSource = computed(() => usableSources.value[sourceIndex.value] ?? '')
const fit = computed<CoverFit>(() => (props.fit === 'cover' ? 'cover' : detectedFit.value))

const generatedBackground = computed(() => {
  const hue = hueFromString(props.title)
  return `linear-gradient(135deg, hsl(${hue} 45% 28%), #111827 60%, hsl(${(hue + 60) % 360} 45% 22%))`
})

watch(() => props.sources.join('|'), () => {
  sourceIndex.value = 0
  detectedFit.value = 'cover'
})

const imageRef = ref<HTMLImageElement | null>(null)

const applyLoadedImage = (image: HTMLImageElement): void => {
  detectedFit.value = getCoverFit(image.naturalWidth, image.naturalHeight, props.ratio)
}

const handleLoad = (event: Event): void => {
  applyLoadedImage(event.target as HTMLImageElement)
}

const handleError = (): void => {
  detectedFit.value = 'cover'
  sourceIndex.value += 1
}

// With SSR the image may finish (or fail) before hydration attaches the
// listeners above, so check its state once mounted.
onMounted(() => {
  const image = imageRef.value
  if (!image?.complete) {
    return
  }

  if (image.naturalWidth > 0) {
    applyLoadedImage(image)
  } else {
    handleError()
  }
})
</script>
