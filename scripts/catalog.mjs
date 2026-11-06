import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { format } from "prettier"

import { discoverCatalog } from "./lib/catalog-discovery.mjs"
import {
  CatalogError,
  detect,
  digestOf,
  renderCatalog,
} from "./lib/operation-catalog.mjs"

export const root = fileURLToPath(new URL("..", import.meta.url))

export async function catalog(mode = "check", directory = root) {
  const snapshot = await discoverCatalog(directory)
  const errors = detect(snapshot)
  if (errors.length)
    throw new AggregateError(
      errors,
      errors.map((error) => error.message).join("\n")
    )
  const outputs = renderCatalog(snapshot)
  for (const [file, source] of Object.entries(outputs)) {
    const content = file.endsWith(".ts")
      ? await format(source, {
          parser: "typescript",
          semi: false,
          trailingComma: "es5",
        })
      : source
    const target = path.join(directory, file)
    const current = existsSync(target)
      ? readFileSync(target, "utf8")
      : undefined
    if (
      (mode === "check" ? current?.replace(/\r\n?/g, "\n") : current) ===
      content
    )
      continue
    if (mode === "check")
      throw new CatalogError(
        "stale-output",
        file,
        "run node scripts/catalog.mjs generate"
      )
    mkdirSync(path.dirname(target), { recursive: true })
    const temporary = `${target}.${process.pid}.pending`
    writeFileSync(temporary, content)
    renameSync(temporary, target)
  }
  return { count: snapshot.operations.length, digest: digestOf(snapshot) }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [mode = "check", ...args] = process.argv.slice(2)
  const rootFlag = args.indexOf("--root")
  const directory = rootFlag === -1 ? root : path.resolve(args[rootFlag + 1])
  if (rootFlag !== -1) args.splice(rootFlag, 2)
  try {
    if (mode === "dev") {
      const { catalogDev } = await import("./lib/catalog-dev.mjs")
      await catalogDev(args[0] === "--" ? args.slice(1) : args, directory)
    } else if (["check", "generate"].includes(mode)) {
      console.log(JSON.stringify(await catalog(mode, directory)))
    } else
      throw new Error(
        "usage: node scripts/catalog.mjs check|generate|dev -- command"
      )
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
