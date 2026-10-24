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
