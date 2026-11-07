import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  writeFileSync,
} from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { format } from "prettier"

import {
  browserPackageRoots,
  browserSource,
  discoverCatalog,
} from "./lib/catalog-discovery.mjs"
import {
  CatalogError,
  detect,
  digestOf,
  renderCatalog,
} from "./lib/operation-catalog.mjs"

export const root = fileURLToPath(new URL("..", import.meta.url))

export async function buildBrowserCatalog(directory = root) {
  const { build } = await import(
    pathToFileURL(
      path.join(root, "apps/web/node_modules/vite/dist/node/index.js")
    ).href
  )
  const webRoot = path.join(directory, "apps/web")
  const modules = new Set()
  const allowedPackages = browserPackageRoots(directory)
  const canonicalRoot = realpathSync(directory)
  const result = await build({
    root: webRoot,
    configFile: false,
    logLevel: "silent",
    plugins: [
      {
        name: "catalog-browser-boundary",
        generateBundle() {
          for (const file of this.getModuleIds()) modules.add(file)
        },
      },
    ],
    build: {
      write: false,
      minify: false,
      rollupOptions: {
        input: path.join(directory, "packages/domain/src/generated/catalog.ts"),
        preserveEntrySignatures: "strict",
      },
    },
  })
  const check = (source, output) => {
    if (source === "\0vite/preload-helper.js") return
    const absolute = path.resolve(webRoot, source.split("?")[0])
    const canonical = existsSync(absolute) ? realpathSync(absolute) : absolute
    const file = path
      .relative(canonicalRoot, canonical)
      .replaceAll(path.sep, "/")
    if (
      !file.startsWith("apps/api/") &&
      (browserSource(file) ||
        allowedPackages.some((allowed) =>
          canonical.startsWith(`${allowed}${path.sep}`)
        ))
    )
      return
    throw new CatalogError(
      "browser-import",
      file,
      `server or non-domain source in browser ${output}`
    )
  }
  for (const module of modules) check(module, "module")
  for (const bundle of Array.isArray(result) ? result : [result])
    for (const output of bundle.output)
      if (output.type === "chunk") {
        if (
          !output.fileName.endsWith(".js") ||
          /\bdata:[^\s"\x27`]*,/i.test(output.code)
        )
          throw new CatalogError(
            "browser-import",
            output.fileName,
            "browser chunks must be JavaScript without data: URLs"
          )
        for (const module of Object.keys(output.modules))
          check(module, "module")
      } else {
        for (const source of output.originalFileNames)
          check(source, `asset ${output.fileName}`)
        throw new CatalogError(
          "browser-import",
          output.fileName,
          "browser catalog may only emit JavaScript chunks; assets and CSS are forbidden"
        )
      }
  return result
}

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
  if (mode === "check") await buildBrowserCatalog(directory)
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
