const literalPaths = (text) =>
  [...text.matchAll(/\bpath:\s*"([^"]+)"/g)].map((match) => match[1])

export function surfacePaths(productPathsText) {
  return [
    ...productPathsText.matchAll(
      /path:\s*"([^"]+)"[^}]*?\bshown:\s*(true|false)/g
    ),
  ].map((match) => ({ path: match[1], shown: match[2] === "true" }))
}

export function staticRoutes(routerText, productPathsText) {
  const surfaces = surfacePaths(productPathsText)
  const hidden = new Set(
    surfaces.filter((surface) => !surface.shown).map((surface) => surface.path)
  )
  const paths = [
    ...literalPaths(routerText),
    ...surfaces
      .filter((surface) => surface.shown)
      .map((surface) => surface.path),
  ].filter(
    (path) => path.startsWith("/") && !/[$*{]/.test(path) && !hidden.has(path)
  )
  return [...new Set(paths)].sort()
}

export function routeScreens(routes, screens) {
  const covered = new Set(
    screens
      .filter((screen) => !screen.unreachable)
      .map((screen) => screen.route)
  )
  return routes
    .filter((route) => !covered.has(route))
    .map((route) => ({
      id: `route:${route}`,
      route,
      steps: [],
      sharedAccount: true,
    }))
}
