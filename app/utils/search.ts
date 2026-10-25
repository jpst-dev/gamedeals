// "  Cyberpunk   2077 " and "cyberpunk 2077" are the same search: one cache
// entry on the server and in the browser.
export const normalizeSearchTerm = (raw: unknown): string => {
  if (typeof raw !== 'string') {
    return ''
  }
  return raw.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 100)
}
