<template>
  <div v-if="props.mediaItems.length > 0" :class="props.embedded ? 'min-w-0 space-y-2' : 'min-w-0 space-y-3'">
    <h2 v-if="!props.embedded" class="text-xl font-semibold text-white">Midia do jogo</h2>
    <div :class="props.embedded
      ? 'min-w-0 space-y-3 bg-transparent p-0'
      : 'min-w-0 space-y-3 rounded-xl border border-gray-800 bg-gray-900 p-4'"
    >
      <ClientOnly>
        <Swiper
          class="steam-gallery aspect-video w-full min-w-0 max-w-full overflow-hidden rounded-lg border border-gray-800 bg-gray-950"
          :modules="swiperModules"
          :slides-per-view="1"
          :space-between="0"
          :navigation="true"
          :autoplay="{
            delay: 6500,
            disableOnInteraction: false,
            pauseOnMouseEnter: true
          }"
          :keyboard="{ enabled: true }"
          :thumbs="{ swiper: thumbsSwiper }"
          @swiper="onMainSwiperReady"
          @slide-change="onSlideChange"
        >
          <SwiperSlide
            v-for="(item, index) in props.mediaItems"
            :key="item.key"
            class="!h-auto max-w-full overflow-hidden"
          >
            <template v-if="item.kind === 'video'">
              <video
                v-if="item.webm || item.mp4 || item.hls || item.dash || item.url"
                :poster="item.thumbnail || props.fallbackCover"
                :autoplay="index === activeIndex"
                controls
                muted
                playsinline
                class="h-full w-full max-w-full bg-black object-contain"
              >
                <source v-if="item.webm" :src="item.webm" type="video/webm">
                <source v-if="item.mp4" :src="item.mp4" type="video/mp4">
                <source v-if="item.hls" :src="item.hls" type="application/x-mpegURL">
                <source v-if="item.dash" :src="item.dash" type="application/dash+xml">
                <source
                  v-if="!item.webm && !item.mp4 && !item.hls && !item.dash"
                  :src="item.url"
                  :type="item.url.endsWith('.webm') ? 'video/webm' : item.url.endsWith('.m3u8') ? 'application/x-mpegURL' : 'video/mp4'"
                >
                Seu navegador nao suporta reproducao de video.
              </video>
            </template>
            <template v-else>
              <button
                type="button"
                class="h-full w-full max-w-full cursor-zoom-in overflow-hidden"
                :aria-label="`Abrir modo cinema para ${item.name}`"
                @click="openLightboxAtCurrent"
              >
                <img
                  :src="item.url || props.fallbackCover"
                  :alt="item.name || `Screenshot de ${props.gameTitle}`"
                  class="h-full w-full max-w-full object-cover [transform:scale(1.01)]"
                >
              </button>
            </template>
          </SwiperSlide>

          <div v-if="props.mediaItems[activeIndex]?.kind !== 'video'" class="absolute bottom-3 right-3 z-20">
            <button
              type="button"
              class="rounded p-1.5 text-white/80 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              aria-label="Abrir modo cinema em tela cheia"
              @click="openLightboxAtCurrent"
            >
              <UIcon name="i-heroicons-arrows-pointing-out-20-solid" class="h-5 w-5" />
            </button>
          </div>
        </Swiper>

        <Swiper
          class="custom-scrollbar mt-2 w-full min-w-0 max-w-full"
          :modules="swiperModules"
          :slides-per-view="'auto'"
          :space-between="8"
          :free-mode="true"
          :watch-slides-progress="true"
          @swiper="onThumbsReady"
        >
          <SwiperSlide
            v-for="(item, index) in props.mediaItems"
            :key="`thumb-${item.key}`"
            class="!h-16 !w-28 overflow-hidden rounded-md border transition-all"
            :class="index === activeIndex ? 'border-primary-400 ring-1 ring-primary-400/70' : 'border-gray-700 hover:border-gray-500'"
          >
            <button
              type="button"
              class="relative h-full w-full"
              :aria-label="item.kind === 'video' ? `Abrir trailer ${item.name}` : `Abrir screenshot ${item.name}`"
              @click="goToIndex(index)"
            >
              <img :src="item.thumbnail || item.url || props.fallbackCover" :alt="item.name" class="h-full w-full object-cover">
              <span
                v-if="item.kind === 'video'"
                class="absolute bottom-1 right-1 rounded bg-black/75 px-1.5 py-0.5 text-[10px] text-gray-100"
              >
                VIDEO
              </span>
            </button>
          </SwiperSlide>
        </Swiper>

        <template #fallback>
          <div class="aspect-video animate-pulse rounded-lg bg-gray-800/60" />
        </template>
      </ClientOnly>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Swiper as SwiperInstance } from 'swiper/types'
import { Autoplay, FreeMode, Keyboard, Navigation, Thumbs } from 'swiper/modules'
import { Swiper, SwiperSlide } from 'swiper/vue'
import 'glightbox/dist/css/glightbox.css'
import 'swiper/css'
import 'swiper/css/free-mode'
import 'swiper/css/navigation'
import 'swiper/css/thumbs'

type MediaItem = {
  key: string
  kind: 'video' | 'image'
  name: string
  thumbnail: string
  url: string
  webm?: string
  mp4?: string
  hls?: string
  dash?: string
}

const props = defineProps<{
  mediaItems: MediaItem[]
  fallbackCover: string
  gameTitle: string
  embedded?: boolean
}>()

const swiperModules = [Navigation, Thumbs, Keyboard, FreeMode, Autoplay]
const mainSwiper = ref<SwiperInstance | null>(null)
const thumbsSwiper = ref<SwiperInstance | null>(null)
const activeIndex = ref(0)
type SwiperAutoplayController = {
  start: () => void
  stop: () => void
}
type LightboxInstance = {
  openAt: (index: number) => void
  setElements: (elements: unknown[]) => void
  destroy: () => void
}

type LightboxFactory = (options: Record<string, unknown>) => LightboxInstance

let glightboxFactory: LightboxFactory | null = null
let lightbox: LightboxInstance | null = null

const getAutoplayController = (instance: SwiperInstance): SwiperAutoplayController | undefined => {
  const controller = (instance as unknown as { autoplay?: SwiperAutoplayController }).autoplay
  if (!controller || typeof controller.start !== 'function' || typeof controller.stop !== 'function') {
    return undefined
  }

  return controller
}

const syncPlaybackWithActiveSlide = (instance: SwiperInstance): void => {
  if (!import.meta.client) {
    return
  }

  const activeMedia = props.mediaItems[instance.activeIndex]
  const activeIsVideo = activeMedia?.kind === 'video'
  const autoplayController = getAutoplayController(instance)

  if (activeIsVideo) {
    autoplayController?.stop()
  } else {
    autoplayController?.start()
  }

  const swiperElement = instance.el instanceof HTMLElement ? instance.el : null
  if (!swiperElement) {
    return
  }

  const activeVideoElement = swiperElement.querySelector('.swiper-slide-active video')
  const activeVideo = activeVideoElement instanceof HTMLVideoElement ? activeVideoElement : null
  const allVideos = swiperElement.querySelectorAll('video')

  allVideos.forEach((video) => {
    if (!(video instanceof HTMLVideoElement)) {
      return
    }

    if (video !== activeVideo) {
      video.pause()
      video.currentTime = 0
    }
  })

  if (!activeVideo) {
    return
  }

  activeVideo.muted = true
  activeVideo.defaultMuted = true
  const autoplayPromise = activeVideo.play()
  if (autoplayPromise && typeof autoplayPromise.catch === 'function') {
    autoplayPromise.catch(() => {
      // Ignore autoplay rejections when the browser blocks media playback.
    })
  }
}

const onMainSwiperReady = (instance: SwiperInstance): void => {
  mainSwiper.value = instance
  nextTick(() => {
    syncPlaybackWithActiveSlide(instance)
  })
}

const onThumbsReady = (instance: SwiperInstance): void => {
  thumbsSwiper.value = instance
}

const onSlideChange = (instance: SwiperInstance): void => {
  activeIndex.value = instance.activeIndex
  syncPlaybackWithActiveSlide(instance)
}

const goToIndex = (index: number): void => {
  mainSwiper.value?.slideTo(index)
  activeIndex.value = index
}

const goToPrevious = (): void => {
  if (props.mediaItems.length <= 1) {
    return
  }

  const targetIndex = (activeIndex.value - 1 + props.mediaItems.length) % props.mediaItems.length
  goToIndex(targetIndex)
}

const goToNext = (): void => {
  if (props.mediaItems.length <= 1) {
    return
  }

  const targetIndex = (activeIndex.value + 1) % props.mediaItems.length
  goToIndex(targetIndex)
}

const buildLightboxElements = () => {
  return props.mediaItems.map((item) => {
    if (item.kind === 'video') {
      return {
        href: item.mp4 || item.webm || item.url,
        type: 'video'
      }
    }

    return {
      href: item.url,
      type: 'image'
    }
  })
}

const openLightboxAtCurrent = (): void => {
  if (!import.meta.client || props.mediaItems.length === 0) {
    return
  }

  const loadAndOpen = async (): Promise<void> => {
    if (!glightboxFactory) {
      const module = await import('glightbox')
      glightboxFactory = (module.default ?? module) as LightboxFactory
    }

    const factory = glightboxFactory
    if (!factory) {
      return
    }

    const elements = buildLightboxElements()
    if (!lightbox) {
      lightbox = factory({
        elements: elements as unknown as [],
        autoplayVideos: true,
        touchNavigation: true,
        keyboardNavigation: true,
        closeButton: true
      })
    } else {
      lightbox.setElements(elements as unknown as [])
    }

    lightbox.openAt(activeIndex.value)
  }

  void loadAndOpen()
}

const syncLightboxElements = (): void => {
  if (!lightbox) {
    return
  }

  const elements = buildLightboxElements()
  lightbox.setElements(elements as unknown as [])
}

watch(() => props.mediaItems, (nextItems) => {
  if (nextItems.length === 0) {
    activeIndex.value = 0
    return
  }

  if (activeIndex.value >= nextItems.length) {
    activeIndex.value = 0
    goToIndex(0)
  }

  syncLightboxElements()
  nextTick(() => {
    if (mainSwiper.value) {
      syncPlaybackWithActiveSlide(mainSwiper.value)
    }
  })
}, { deep: true })

onBeforeUnmount(() => {
  lightbox?.destroy()
  lightbox = null
})
</script>

<style scoped>
:deep(.glightbox-container .gslide-description) {
  display: none !important;
}

:deep(.steam-gallery .swiper-wrapper) {
  max-width: 100%;
  backface-visibility: hidden;
  will-change: transform;
}

:deep(.steam-gallery .swiper-slide) {
  width: 100% !important;
  flex-shrink: 0;
  max-width: 100%;
  backface-visibility: hidden;
}

:deep(.steam-gallery) {
  /* Hard clip avoids 1px slide bleeding on fractional transforms. */
  clip-path: inset(0 round 0.5rem);
  contain: paint;
}

:deep(.steam-gallery .swiper-button-next),
:deep(.steam-gallery .swiper-button-prev) {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.18s ease;
  color: #e5e7eb;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.75);
}

:deep(.steam-gallery:hover .swiper-button-next),
:deep(.steam-gallery:hover .swiper-button-prev) {
  opacity: 1;
  pointer-events: auto;
}

:deep(.glightbox-container .gcounter) {
  bottom: 8px;
  left: 50%;
  top: auto;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.65);
  border-radius: 9999px;
  color: #e5e7eb;
  padding: 2px 10px;
  font-size: 12px;
}
</style>
