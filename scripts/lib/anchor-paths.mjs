import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { UNKNOWN } from "./anchor-syntax.mjs"

function relativeToRoot(root, abs) {
  const rel = path.relative(root, abs).split(path.sep).join("/")
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null
  return rel || "."
}

function fromFake(combined) {
  const normal = path.posix.normalize(combined)
  if (normal === "/repo") return "."
  if (!normal.startsWith("/repo/")) return null
  return normal.slice("/repo/".length)
}

function pathValue(rel) {
  const normal = path.posix.normalize(rel)
  if (normal === ".") return { kind: "path", path: "." }
  if (normal.startsWith("..") || path.posix.isAbsolute(normal)) return UNKNOWN
  return { kind: "path", path: normal }
}

export function createPathOps({ root, file, exists, evalList }) {
  function fromCwd(rel) {
    const clean = path.posix.normalize(rel || ".")
    if (clean.startsWith("..") || path.posix.isAbsolute(clean)) return null
    let dir = path.posix.dirname(file)
    const seen = new Set()
    while (!seen.has(dir)) {
      seen.add(dir)
      const candidate = path.posix.normalize(
        path.posix.join(dir === "." ? "" : dir, clean === "." ? "" : clean)
      )
      const relPath = candidate === "" ? "." : candidate
      if (!relPath.startsWith("..") && exists(relPath)) return relPath
      if (dir === "." || dir === "") break
      dir = path.posix.dirname(dir)
    }
    return null
  }

  function resolveLoose(textPath) {
    if (path.isAbsolute(textPath)) {
      const rel = relativeToRoot(root, textPath)
      return rel && exists(rel) ? rel : null
    }
    const fromTest = path.posix.normalize(
      path.posix.join(path.posix.dirname(file), textPath)
    )
    if (!fromTest.startsWith("..") && exists(fromTest)) return fromTest
    const fromRoot = path.posix.normalize(textPath)
    if (!fromRoot.startsWith("..") && exists(fromRoot)) return fromRoot
    return null
  }

  function segment(value) {
    if (value.kind === "path") return value.path === "." ? "" : value.path
    if (value.kind === "str") return value.value
    return null
  }

  function joinValues(args) {
    if (args.length === 0 || args.some((arg) => arg.kind === "unknown"))
      return UNKNOWN
    if (args[0].kind === "cwd") {
      const rest = args.slice(1).map(segment)
      if (rest.some((item) => item === null)) return UNKNOWN
      const found = fromCwd(path.posix.join(...rest))
      return found ? pathValue(found) : UNKNOWN
    }
    let combined = "/repo"
    for (const arg of args) {
      if (arg.kind === "cwd") return UNKNOWN
      const part = segment(arg)
      if (part === null) return UNKNOWN
      if (path.posix.isAbsolute(part)) {
        const rel = relativeToRoot(root, part)
        if (rel === null) return UNKNOWN
        combined = path.posix.join("/repo", rel)
      } else combined = path.posix.join(combined, part)
    }
    const rel = fromFake(combined)
    return rel === null ? UNKNOWN : pathValue(rel)
  }

  function resolveValues(args) {
    if (args.some((arg) => arg.kind === "unknown")) return UNKNOWN
    const parts = []
    for (let i = args.length - 1; i >= 0; i--) {
      const arg = args[i]
      if (arg.kind === "cwd") {
        const found = fromCwd(path.posix.join(...parts))
        return found ? pathValue(found) : UNKNOWN
      }
      if (arg.kind === "path") {
        parts.unshift(arg.path === "." ? "" : arg.path)
        continue
      }
      if (arg.kind === "str") {
        if (path.isAbsolute(arg.value)) {
          const rel = relativeToRoot(root, arg.value)
          if (rel === null) return UNKNOWN
          const resolved = fromFake(path.posix.join("/repo", rel, ...parts))
          return resolved === null ? UNKNOWN : pathValue(resolved)
        }
        parts.unshift(arg.value)
        continue
      }
      return UNKNOWN
    }
    const anchored = args.some((arg) => arg.kind === "path")
    if (!anchored) {
      const found = fromCwd(path.posix.join(...parts))
      if (found) return pathValue(found)
      const loose = resolveLoose(path.posix.join(...parts))
      return loose ? pathValue(loose) : UNKNOWN
    }
    const rel = fromFake(path.posix.join("/repo", ...parts))
    return rel === null ? UNKNOWN : pathValue(rel)
  }

  function doPath(op, argNodes) {
    const args = evalList(argNodes)
    if (!args) return UNKNOWN
    if (op === "dirname") {
      const base = args[0]
      if (base?.kind === "path") return pathValue(path.posix.dirname(base.path))
      if (base?.kind === "str") {
        const loose = resolveLoose(base.value)
        return loose ? pathValue(path.posix.dirname(loose)) : UNKNOWN
      }
      return UNKNOWN
    }
    if (op === "normalize") {
      if (args[0]?.kind === "path") return args[0]
      if (args[0]?.kind === "str") {
        const loose = resolveLoose(args[0].value)
        return loose ? pathValue(loose) : UNKNOWN
      }
      return UNKNOWN
    }
    if (op === "resolve") return resolveValues(args)
    if (op === "join") return joinValues(args)
    return UNKNOWN
  }

  function doUrl(op, argNodes) {
    const args = evalList(argNodes)
    if (!args) return UNKNOWN
    const arg = args[0]
    if (op === "pathToFileURL") {
      if (arg?.kind === "path")
        return {
          kind: "url",
          href: pathToFileURL(path.join(root, arg.path === "." ? "" : arg.path))
            .href,
        }
      if (arg?.kind === "str" && path.isAbsolute(arg.value))
        return { kind: "url", href: pathToFileURL(arg.value).href }
      return UNKNOWN
    }
    if (arg?.kind === "path") return arg
    if (arg?.kind === "url") {
      try {
        const rel = relativeToRoot(root, fileURLToPath(arg.href))
        return rel === null ? UNKNOWN : pathValue(rel)
      } catch {
        return UNKNOWN
      }
    }
    if (arg?.kind === "str") {
      try {
        const rel = relativeToRoot(root, fileURLToPath(arg.value))
        return rel === null ? UNKNOWN : pathValue(rel)
      } catch {
        return UNKNOWN
      }
    }
    return UNKNOWN
  }

  return {
    doPath,
    doUrl,
    pathValue,
    relativeToRoot: (abs) => relativeToRoot(root, abs),
  }
}
