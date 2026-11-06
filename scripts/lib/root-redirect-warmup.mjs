import { runtimeStaticImports } from "./source-imports.mjs"

const warmer = "apps/web/src/test/warm-routes.ts"

export function detect(
  source,
  file = "apps/web/src/features/unknown.test.tsx"
) {
  const mountsRoot = /\brenderApp\(\s*["']\/["']\s*\)/.test(source)
  const assertsDestination =
    /\.\s*state\s*\.\s*location\s*\.\s*pathname\s*\)\s*\.\s*toBe\(\s*["']\/[^"']+/.test(
      source
    )
  const warmsRoutes = runtimeStaticImports(source, file).includes(warmer)
  return mountsRoot && assertsDestination && !warmsRoutes
    ? ["Warm signed-in lazy routes before root redirect tests can unmount"]
    : []
}
