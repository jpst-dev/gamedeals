export default defineCachedEventHandler(async () => {
  return await buildHome()
}, { maxAge: 300, swr: true, name: 'home' })
