// What /api/games/suggest returns for each search suggestion.
export type SuggestionPrice = {
  amount: number
  regular: number
  cut: number
  shop: string
  isHistoryLow: boolean
}

export type Suggestion = {
  id: string
  slug: string
  title: string
  image: string
  type: 'game' | 'dlc'
  price: SuggestionPrice | null
}
