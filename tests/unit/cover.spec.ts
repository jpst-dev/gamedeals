import { describe, expect, it } from 'vitest'
import { getCoverFit, hueFromString, steamAsset } from '../../app/utils/cover'

describe('utils/cover', () => {
  it('uses cover when image matches the 2:3 frame within 12%', () => {
    expect(getCoverFit(300, 450)).toBe('cover')
    expect(getCoverFit(600, 900)).toBe('cover')
    expect(getCoverFit(320, 450)).toBe('cover')
  })

  it('uses contain for landscape banners', () => {
    expect(getCoverFit(460, 215)).toBe('contain')
    expect(getCoverFit(600, 350)).toBe('contain')
  })

  it('falls back to cover on invalid dimensions', () => {
    expect(getCoverFit(0, 0)).toBe('cover')
    expect(getCoverFit(Number.NaN, 450)).toBe('cover')
  })

  it('derives a stable hue from text', () => {
    expect(hueFromString('Hades')).toBe(hueFromString('Hades'))
    expect(hueFromString('Hades')).toBeGreaterThanOrEqual(0)
    expect(hueFromString('Hades')).toBeLessThan(360)
  })

  it('builds steam asset urls', () => {
    expect(steamAsset(1086940, 'library_hero.jpg'))
      .toBe('https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/1086940/library_hero.jpg')
  })
})
