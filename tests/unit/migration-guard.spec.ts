import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Static guard for the Nuxt UI v4 migration: fails while any Nuxt UI v2 API
// or Nuxt 3 layout is left in the app code.

const read = (path: string): string => (existsSync(path) ? readFileSync(path, 'utf8') : '')

const sourceFiles = (dir: string): string[] => {
  if (!existsSync(dir)) {
    return []
  }
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      return sourceFiles(path)
    }
    return /\.(vue|ts)$/.test(name) ? [path] : []
  })
}

const grepApp = (pattern: RegExp): string[] => {
  return sourceFiles('app').flatMap((file) => {
    return read(file)
      .split('\n')
      .flatMap((line, index) => (pattern.test(line) ? [`${file}:${index + 1}`] : []))
  })
}

describe('migração Nuxt UI v4', () => {
  it('o código do app vive em app/', () => {
    expect(existsSync('app/app.vue')).toBe(true)
  })

  it('não usa tons numéricos de primary', () => {
    expect(grepApp(/\bprimary-\d{2,3}\b/)).toEqual([])
  })

  it('não usa UNotifications', () => {
    expect(grepApp(/<UNotifications/)).toEqual([])
  })

  it('toasts usam cores semânticas do v4', () => {
    expect(grepApp(/color:\s*'(red|orange|green|gray)'/)).toEqual([])
  })

  it('badges não usam color="gray"', () => {
    expect(grepApp(/color="gray"/)).toEqual([])
  })

  it('o app é envolvido por UApp', () => {
    expect(read('app/app.vue')).toMatch(/<UApp[\s>]/)
  })

  it('tema escuro fixo com chave própria', () => {
    const config = read('nuxt.config.ts')
    expect(config).toMatch(/preference:\s*'dark'/)
    expect(config).toMatch(/storageKey:\s*'gamedeals-color-mode'/)
  })
})
