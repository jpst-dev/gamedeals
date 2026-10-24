export type CoverFit = 'cover' | 'contain'
export type SteamAssetFile = 'library_hero.jpg' | 'library_600x900.jpg' | 'header.jpg'

const STEAM_ASSETS_BASE_URL = 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps'

// Images close enough to the frame fill it; anything else (e.g. landscape
// banners) is shown whole so titles and logos never get cropped.
export const getCoverFit = (
  width: number,
  height: number,
  targetRatio = 2 / 3,
  tolerance = 0.12
): CoverFit => {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return 'cover'
  }

  const deviation = Math.abs(width / height - targetRatio) / targetRatio
  return deviation <= tolerance ? 'cover' : 'contain'
}

export const hueFromString = (text: string): number => {
  let hash = 0
  for (const char of text) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0
  }

  return Math.abs(hash) % 360
}

export const steamAsset = (appid: number, file: SteamAssetFile): string => {
  return `${STEAM_ASSETS_BASE_URL}/${appid}/${file}`
}
