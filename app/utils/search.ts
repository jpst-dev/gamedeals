import type { Suggestion } from '../../shared/types/suggest'

// "  Cyberpunk   2077 " and "cyberpunk 2077" are the same search: one cache
// entry on the server and in the browser.
export const normalizeSearchTerm = (raw: unknown): string => {
  if (typeof raw !== 'string') {
    return ''
  }
  return raw.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 100)
}

export const SEARCH_DEBOUNCE_MS = 300
export const MIN_SEARCH_LENGTH = 2
export const RECENT_SEARCHES_KEY = 'dealsgamer:recent-searches'
export const MAX_RECENT_SEARCHES = 5

type SuggestionList = Suggestion[]

// Session cache plus "latest wins": a slow answer for "cy" arriving after
// the one for "cyber" resolves null instead of replacing the list.
export const createSuggestionLoader = (fetch: (term: string) => Promise<SuggestionList>) => {
  const cache = new Map<string, SuggestionList>()
  let latest = 0

  const load = async (raw: string): Promise<SuggestionList | null> => {
    const term = normalizeSearchTerm(raw)
    const request = ++latest
    if (term.length < MIN_SEARCH_LENGTH) {
      return []
    }
    const cached = cache.get(term)
    if (cached) {
      return cached
    }
    const list = await fetch(term)
    cache.set(term, list)
    return request === latest ? list : null
  }

  return { load }
}

export const readRecentSearches = (storage: Pick<Storage, 'getItem'> | null): string[] => {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(RECENT_SEARCHES_KEY) ?? '[]')
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === 'string').slice(0, MAX_RECENT_SEARCHES)
      : []
  } catch {
    return []
  }
}

export const addRecentSearch = (list: string[], raw: string): string[] => {
  const term = raw.trim()
  if (!term) {
    return list
  }
  const others = list.filter((entry) => entry.toLowerCase() !== term.toLowerCase())
  return [term, ...others].slice(0, MAX_RECENT_SEARCHES)
}

// Private windows and full storage throw; recent searches are a nicety.
export const writeRecentSearches = (storage: Pick<Storage, 'setItem'> | null, list: string[]): void => {
  try {
    storage?.setItem(RECENT_SEARCHES_KEY, JSON.stringify(list))
  } catch {
    // ignore
  }
}

const isTypingTarget = (target: unknown): boolean => {
  const node = (target ?? {}) as { tagName?: unknown; isContentEditable?: unknown }
  return node.isContentEditable === true || ['INPUT', 'TEXTAREA', 'SELECT'].includes(String(node.tagName ?? '').toUpperCase())
}

// "/" and Ctrl/Cmd+K jump to the search, unless the person is typing elsewhere.
export const isSearchShortcut = (event: { key: string; ctrlKey: boolean; metaKey: boolean; target: unknown }): boolean => {
  if (isTypingTarget(event.target)) {
    return false
  }
  const withModifier = event.ctrlKey || event.metaKey
  return (event.key === '/' && !withModifier) || (event.key.toLowerCase() === 'k' && withModifier)
}
