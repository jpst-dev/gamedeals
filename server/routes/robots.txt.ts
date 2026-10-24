export default defineEventHandler((event) => {
  const siteUrl = String(useRuntimeConfig(event).public.siteUrl ?? '').replace(/\/+$/, '')
  setHeader(event, 'content-type', 'text/plain; charset=utf-8')
  return [
    'User-agent: *',
    'Disallow: /favoritos',
    'Disallow: /api/',
    `Sitemap: ${siteUrl}/sitemap.xml`,
    ''
  ].join('\n')
})
