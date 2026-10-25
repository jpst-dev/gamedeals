// https://nuxt.com/docs/api/configuration/nuxt-config
const siteUrl = (process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '')

export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  app: {
    head: {
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }
      ]
    }
  },
  modules: ['@nuxt/ui', '@pinia/nuxt', '@nuxtjs/sitemap'],
  css: ['~/assets/css/main.css'],
  // The site is always dark. A dedicated storage key ignores the 'system' or
  // 'light' value Nuxt UI v2 may have saved under the default key.
  colorMode: {
    preference: 'dark',
    fallback: 'dark',
    storageKey: 'gamedeals-color-mode'
  },
  site: {
    url: siteUrl,
    name: 'GameDeals BR'
  },
  sitemap: {
    sources: ['/api/__sitemap__/urls'],
    exclude: ['/favoritos', '/search/**']
  },
  icon: {
    serverBundle: {
      collections: ['heroicons']
    }
  },
  runtimeConfig: {
    itadApiKey: process.env.ITAD_API_KEY || '',
    public: {
      appName: 'GameDeals BR',
      siteUrl
    }
  },
  typescript: {
    strict: true,
    typeCheck: true,
    tsConfig: {
      compilerOptions: {
        noImplicitAny: true,
        strictNullChecks: true
      }
    }
  },
  experimental: {
    appManifest: false
  }
})
