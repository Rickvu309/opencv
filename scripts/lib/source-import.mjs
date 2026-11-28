import { existsSync } from "node:fs"
import { registerHooks } from "node:module"

const root = new URL("../../", import.meta.url)
const sourceRoots = ["packages/domain/src/", "apps/api/src/"].map(
  (folder) => new URL(folder, root).href
)

registerHooks({
  resolve(specifier, context, next) {
    const conditions = [...(context.conditions ?? []), "opencv-source"]
    if (
      sourceRoots.some((folder) => context.parentURL?.startsWith(folder)) &&
      specifier.startsWith(".") &&
      specifier.endsWith(".js")
    ) {
      const source = new URL(
        specifier.replace(/\.js$/, ".ts"),
        context.parentURL
      )
      if (existsSync(source))
        return next(source.href, { ...context, conditions })
    }
    return next(specifier, { ...context, conditions })
  },
})

export const importSource = (file) => import(new URL(file, root).href)
