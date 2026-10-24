import type { PriceRow } from '../composables/useGamesApi'

export type RankedOffer = PriceRow & { isBest: boolean; deltaFromBest: number; isHistoryLow: boolean }

const round2 = (value: number): number => Math.round(value * 100) / 100

// Cheapest first (stable on ties); only the first offer is "best".
export const rankOffers = (rows: PriceRow[]): RankedOffer[] => {
  const valid = rows
    .filter((row) => Number.isFinite(row.price) && row.price >= 0)
    .sort((a, b) => a.price - b.price)
  const best = valid[0]?.price ?? 0

  return valid.map((row, index) => ({
    ...row,
    isBest: index === 0,
    deltaFromBest: round2(row.price - best),
    isHistoryLow: (row.historyLow ?? 0) > 0 && row.price <= (row.historyLow ?? 0)
  }))
}

// ITAD reports DRM-free keys as "Drm Free" and unknown DRM as "N/A".
export const activationText = (activation: string): string => {
  const value = activation.trim()
  if (!value || value === 'N/A') {
    return ''
  }

  return /^drm[\s-]?free$/i.test(value) ? 'Sem DRM' : `Ativa na ${value}`
}
