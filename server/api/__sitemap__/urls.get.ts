export default defineCachedEventHandler(() => buildSitemapUrls(), {
  maxAge: 21_600,
  swr: true,
  name: 'sitemap-urls'
})
