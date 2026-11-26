import { existsSync, readdirSync } from "node:fs"
import path from "node:path"

export function domainEntryAliases(webDir: string) {
  const source = path.resolve(webDir, "../../packages/domain/src")
  return Object.fromEntries(
    readdirSync(source)
      .filter((name) => existsSync(path.join(source, name, "public.ts")))
      .map((name) => [
        `@workspace/domain/${name}`,
        path.join(source, name, "public.ts"),
      ])
  )
}
