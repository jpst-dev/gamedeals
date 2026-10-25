import { normalizeSearchTerm } from '../../../app/utils/search'

const limitOf = (value: unknown): number => parseIntInRange(value, 8, 1, 10)

export default defineCachedEventHandler(async (event) => {
  const query = getQuery(event)
  return await buildSuggestions(normalizeSearchTerm(query.q), limitOf(query.limit))
}, {
  maxAge: 300,
  swr: true,
  name: 'itad-suggest',
  getKey: (event) => {
    const query = getQuery(event)
    return suggestCacheKey(query.q, limitOf(query.limit))
  }
})
