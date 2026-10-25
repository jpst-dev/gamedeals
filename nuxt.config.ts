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
  modules: ['@nuxt/ui', '@pinia/nuxt', '@nuxtjs/sitemap', 'nuxt-auth-utils'],
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
    exclude: ['/favoritos', '/search/**', '/entrar/**', '/conta', '/alertas/**', '/privacidade']
  },
  icon: {
    serverBundle: {
      collections: ['heroicons']
    }
  },
  runtimeConfig: {
    itadApiKey: process.env.ITAD_API_KEY || '',
    databaseUrl: process.env.DATABASE_URL || '',
    resendApiKey: process.env.RESEND_API_KEY || '',
    emailFrom: process.env.EMAIL_FROM || 'GameDeals BR <onboarding@resend.dev>',
    cronSecret: process.env.CRON_SECRET || '',
    session: {
      password: process.env.NUXT_SESSION_PASSWORD || '',
      maxAge: 60 * 60 * 24 * 30
    },
    public: {
      appName: 'GameDeals BR',
      siteUrl,
      // Accounts and alerts stay hidden until the own domain exists.
      accountsEnabled: process.env.NUXT_PUBLIC_ACCOUNTS_ENABLED === 'true'
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
