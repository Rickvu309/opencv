import { existsSync, globSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../..")

const workingTree = {
  read: (name) =>
    existsSync(path.join(root, name))
      ? readFileSync(path.join(root, name), "utf8")
      : null,
  hasPacks: (directory) =>
    globSync(`${directory}/**/pack.yml`, { cwd: root }).length > 0,
}

function builtDirectories(exports) {
  const found = new Set()
  const visit = (value) => {
    if (typeof value === "string") {
      const match = /^\.\/([^/]+)\//.exec(value)
      if (match && match[1] !== "src") found.add(match[1])
    } else if (value && typeof value === "object") {
      for (const inner of Object.values(value)) visit(inner)
    }
  }
  visit(exports)
  return [...found]
}

export function detect(text, file = "tsconfig.json", io = workingTree) {
  const directory = path.posix.dirname(file)
  const manifestText = io.read(path.posix.join(directory, "package.json"))
  if (manifestText === null || !io.hasPacks(directory)) return []
  const built = builtDirectories(JSON.parse(manifestText).exports)
  if (built.length === 0) return []
  const outDir = JSON.parse(text).compilerOptions?.outDir
  const declared =
    typeof outDir === "string" ? outDir.replace(/^\.\//, "") : null
  return built
    .filter((directory) => directory !== declared)
    .map(
      (out) =>
        `${file}: the package exports built files from ${out}/ but compilerOptions.outDir is ${declared ?? "missing"}, so ts-packwerk resolves them as built files instead of the source packs`
    )
}
