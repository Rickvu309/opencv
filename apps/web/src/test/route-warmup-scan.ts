export type SourceFile = { name: string; text: string }

const WARM_ROUTES_IMPORT = /^import "\.\/warm-routes\.ts"$/m
const LAZY_ROUTE_RENDERER = /render-app-lazy-routes\.tsx/

export function rendererWarmsRoutes(renderAppSource: string) {
  return WARM_ROUTES_IMPORT.test(renderAppSource)
}

export function findColdAppRenders(
  files: SourceFile[],
  allowed: readonly string[]
) {
  return files
    .filter((file) => LAZY_ROUTE_RENDERER.test(file.text))
    .map((file) => file.name)
    .filter((name) => !allowed.includes(name))
}
