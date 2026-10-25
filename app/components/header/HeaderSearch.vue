<template>
  <div ref="rootRef" class="relative w-full">
    <form role="search" @submit.prevent="submit()">
      <label :for="inputId" class="sr-only">Buscar jogo pelo nome</label>
      <div
        class="flex items-center gap-2 rounded-lg border bg-gray-900/80 px-3 transition-colors"
        :class="open ? 'border-green-400 ring-2 ring-green-400/20' : 'border-gray-700 hover:border-gray-600'"
      >
        <UIcon name="i-heroicons-magnifying-glass" class="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
        <input
          :id="inputId"
          ref="inputRef"
          :value="term"
          type="search"
          role="combobox"
          autocomplete="off"
          spellcheck="false"
          placeholder="Buscar jogos e DLCs…"
          aria-autocomplete="list"
          :aria-expanded="open"
          :aria-controls="listId"
          :aria-activedescendant="activeId"
          class="h-10 min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-gray-500 focus:outline-hidden [&::-webkit-search-cancel-button]:hidden"
          @input="handleInput"
          @focus="handleFocus"
          @keydown.down.prevent="move(1)"
          @keydown.up.prevent="move(-1)"
          @keydown.enter="handleEnter"
          @keydown.esc.prevent="close(true)"
        >
        <button
          v-if="fullscreen"
          type="button"
          class="text-sm text-gray-400 hover:text-white"
          @click="emit('close')"
        >
          Cancelar
        </button>
        <UKbd v-else-if="!open" class="hidden lg:inline-flex">/</UKbd>
      </div>
    </form>

    <div
      v-if="open"
      :id="listId"
      role="listbox"
      aria-label="Sugestões de busca"
      class="overflow-hidden border-gray-800 bg-gray-900"
      :class="fullscreen
        ? 'mt-3'
        : 'absolute inset-x-0 top-full z-120 mt-2 rounded-xl border shadow-2xl shadow-black/60'"
    >
      <template v-if="showRecent">
        <div class="flex items-center justify-between px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <span>Buscas recentes</span>
          <button type="button" class="normal-case tracking-normal text-gray-400 hover:text-white" @mousedown.prevent="clearRecent()">
            Limpar
          </button>
        </div>
        <button
          v-for="(entry, index) in recent"
          :id="optionId(index)"
          :key="entry"
          type="button"
          role="option"
          :aria-selected="index === highlighted"
          class="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-gray-200"
          :class="index === highlighted ? 'bg-gray-800' : 'hover:bg-gray-800/60'"
          @mouseenter="highlighted = index"
          @mousedown.prevent="pickRecent(entry)"
        >
          <UIcon name="i-heroicons-clock" class="h-4 w-4 text-gray-500" aria-hidden="true" />
          {{ entry }}
        </button>
      </template>

      <template v-else>
        <div v-if="loading && suggestions.length === 0" class="space-y-1 p-2" aria-hidden="true">
          <div v-for="index in 3" :key="index" class="flex items-center gap-3 px-1 py-1.5">
            <USkeleton class="h-[43px] w-[92px] rounded-md" />
            <div class="flex-1 space-y-2">
              <USkeleton class="h-3.5 w-2/3" />
              <USkeleton class="h-3 w-1/3" />
            </div>
          </div>
        </div>

        <p v-else-if="suggestions.length === 0" class="px-3 py-4 text-sm text-gray-400">
          Nenhum jogo encontrado.
        </p>

        <div :class="loading && suggestions.length > 0 ? 'opacity-60 transition-opacity' : ''">
          <NuxtLink
            v-for="(suggestion, index) in suggestions"
            :id="optionId(index)"
            :key="suggestion.id"
            :to="`/game/${suggestion.slug}`"
            role="option"
            :aria-selected="index === highlighted"
            class="flex items-center gap-3 border-b border-gray-800/70 px-3 py-2"
            :class="index === highlighted ? 'bg-gray-800' : 'hover:bg-gray-800/60'"
            @mouseenter="highlighted = index"
            @mousedown.prevent
            @click="pick(suggestion)"
          >
            <img
              v-if="suggestion.image"
              :src="suggestion.image"
              alt=""
              class="h-[34px] w-[72px] shrink-0 rounded-md bg-gray-800 object-cover sm:h-[43px] sm:w-[92px]"
              loading="lazy"
            >
            <div v-else class="grid h-[34px] w-[72px] shrink-0 place-items-center rounded-md bg-gray-800 sm:h-[43px] sm:w-[92px]">
              <UIcon name="i-heroicons-photo" class="h-5 w-5 text-gray-600" aria-hidden="true" />
            </div>

            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-semibold text-white">{{ suggestion.title }}</p>
              <p class="truncate text-xs text-gray-500">
                {{ suggestion.type === 'dlc' ? 'DLC' : 'Jogo' }}<template v-if="suggestion.price?.shop"> · melhor na {{ suggestion.price.shop }}</template>
              </p>
            </div>

            <template v-if="suggestion.price">
              <span
                v-if="suggestion.price.cut > 0"
                class="hidden rounded-md bg-green-400 px-1.5 py-0.5 text-xs font-extrabold text-gray-950 sm:inline"
              >
                -{{ suggestion.price.cut }}%
              </span>
              <div class="min-w-[4.75rem] text-right">
                <p class="text-sm font-bold text-white">{{ suggestion.price.amount === 0 ? 'Grátis' : formatBrl(suggestion.price.amount) }}</p>
                <p v-if="suggestion.price.isHistoryLow && suggestion.price.cut > 0" class="text-[10px] font-bold tracking-wide text-yellow-400">
                  MENOR PREÇO
                </p>
              </div>
            </template>
          </NuxtLink>
        </div>

        <NuxtLink
          v-if="suggestions.length > 0"
          :id="optionId(suggestions.length)"
          :to="searchLink"
          role="option"
          :aria-selected="highlighted === suggestions.length"
          class="block px-3 py-2.5 text-sm font-medium text-green-400"
          :class="highlighted === suggestions.length ? 'bg-gray-800' : 'hover:bg-gray-800/60'"
          @mouseenter="highlighted = suggestions.length"
          @mousedown.prevent
          @click="submit()"
        >
          Ver todos os resultados para "{{ term.trim() }}" →
        </NuxtLink>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Suggestion } from '../../../shared/types/suggest'

const props = withDefaults(defineProps<{ fullscreen?: boolean }>(), { fullscreen: false })
const emit = defineEmits<{ close: [] }>()

const route = useRoute()
const router = useRouter()
const { term, suggestions, loading, recent, onInput, setTerm, ensureLoaded, remember, clearRecent } = useSearchSuggestions()

const uid = useId()
const inputId = `search-${uid}`
const listId = `search-list-${uid}`
const optionId = (index: number): string => `search-option-${uid}-${index}`

const rootRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)
const focused = ref(false)
const highlighted = ref(-1)

const typedEnough = computed(() => normalizeSearchTerm(term.value).length >= MIN_SEARCH_LENGTH)
const showRecent = computed(() => !typedEnough.value && recent.value.length > 0)
const open = computed(() => focused.value && (typedEnough.value || showRecent.value))
const optionCount = computed(() => showRecent.value ? recent.value.length : suggestions.value.length + (suggestions.value.length > 0 ? 1 : 0))
const activeId = computed(() => open.value && highlighted.value >= 0 ? optionId(highlighted.value) : undefined)
const searchLink = computed(() => ({ path: '/search', query: { q: term.value.trim() } }))

watch(suggestions, () => {
  highlighted.value = -1
})

// A search page shows its term in the box without opening suggestions.
watch(() => route.query.q, (value) => {
  setTerm(typeof value === 'string' ? value : '')
}, { immediate: true })

const handleFocus = (): void => {
  focused.value = true
  ensureLoaded()
}

const handleInput = (event: Event): void => {
  highlighted.value = -1
  onInput((event.target as HTMLInputElement).value)
}

const close = (blur = false): void => {
  focused.value = false
  highlighted.value = -1
  if (blur) {
    inputRef.value?.blur()
    if (props.fullscreen) {
      emit('close')
    }
  }
}

const move = (step: 1 | -1): void => {
  if (!open.value || optionCount.value === 0) {
    return
  }
  const next = highlighted.value + step
  highlighted.value = next < -1 ? optionCount.value - 1 : next >= optionCount.value ? -1 : next
}

const finish = (): void => {
  close(true)
  emit('close')
}

const pick = (suggestion: Suggestion): void => {
  remember(term.value)
  setTerm(suggestion.title)
  finish()
}

const pickRecent = (entry: string): void => {
  setTerm(entry)
  onInput(entry)
  highlighted.value = -1
}

const submit = (): void => {
  const value = term.value.trim()
  if (!value) {
    return
  }
  remember(value)
  finish()
  void router.push(searchLink.value)
}

const handleEnter = (event: KeyboardEvent): void => {
  event.preventDefault()
  if (!open.value || highlighted.value < 0) {
    submit()
    return
  }
  if (showRecent.value) {
    const entry = recent.value[highlighted.value]
    if (entry) {
      pickRecent(entry)
    }
    return
  }
  const suggestion = suggestions.value[highlighted.value]
  if (suggestion) {
    pick(suggestion)
    void router.push(`/game/${suggestion.slug}`)
    return
  }
  submit()
}

const handleClickOutside = (event: MouseEvent): void => {
  const target = event.target as Node | null
  if (target && rootRef.value && !rootRef.value.contains(target)) {
    close()
  }
}

const focus = (): void => {
  inputRef.value?.focus()
  inputRef.value?.select()
}

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside)
  if (props.fullscreen) {
    focus()
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleClickOutside)
})

defineExpose({ focus })
</script>
