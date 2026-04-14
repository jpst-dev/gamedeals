// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  modules: ['@nuxt/ui', '@pinia/nuxt'],
  icon: {
    serverBundle: {
      collections: ['heroicons']
    }
  },
  runtimeConfig: {
    itadApiKey: process.env.ITAD_API_KEY || '',
    public: {
      appName: 'GameDeals BR'
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
