import { registerHooks } from "node:module"

registerHooks({
  resolve(specifier, context, nextResolve) {
    const parent = context.parentURL ?? ""
    if (
      specifier.endsWith(".js") &&
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      parent.includes("/packages/domain/src/")
    ) {
      try {
        return nextResolve(`${specifier.slice(0, -3)}.ts`, context)
      } catch {
        return nextResolve(specifier, context)
      }
    }
    return nextResolve(specifier, context)
  },
})
