export function detect(source) {
  const mountsRoot = /\brenderApp\(\s*["']\/["']\s*\)/.test(source)
  const assertsDestination =
    /\.state\.location\.pathname\)\.toBe\(\s*["']\/[^"']+/.test(source)
  const warmsRoutes = /import\s+["']@\/test\/warm-routes\.ts["']/.test(source)
  return mountsRoot && assertsDestination && !warmsRoutes
    ? ["Warm signed-in lazy routes before root redirect tests can unmount"]
    : []
}
