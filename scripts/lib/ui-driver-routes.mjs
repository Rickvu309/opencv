import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

export const SERVED_ROUTES_FILE = "apps/api/src/one-door.test.ts"

const root = fileURLToPath(new URL("../../", import.meta.url))

const workingTree = {
  read(rel) {
    try {
      return readFileSync(`${root}${rel}`, "utf8")
    } catch {
      return null
    }
  },
}

export function servedRoutes(source) {
  return [
    ...source.matchAll(/"(?:GET|POST|PUT|PATCH|DELETE|ALL) (\/[^"]*)"/g),
  ].map((match) => match[1])
}

function routePattern(path) {
  const body = path
    .split("/")
    .map((segment) =>
      segment === "*"
        ? ".*"
        : segment.startsWith(":")
          ? "[^/]+"
          : segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    )
    .join("/")
  return new RegExp(`^${body}$`)
}

export function calledApiPaths(source) {
  const calls = []
  const lines = source.split("\n")
  lines.forEach((text, index) => {
    for (const match of text.matchAll(
      /["'`](?:\$\{[^}]*\})?(\/api\/[^"'`\s?#]*)/g
    ))
      calls.push({
        path: match[1].replace(/\$\{[^}]*\}/g, "x"),
        line: index + 1,
      })
  })
  return calls
}

export function detect(source, file, io = workingTree) {
  const served = io.read(SERVED_ROUTES_FILE)
  if (served === null) return []
  const patterns = servedRoutes(served).map(routePattern)
  return calledApiPaths(source)
    .filter(({ path }) => !patterns.some((pattern) => pattern.test(path)))
    .map(({ path, line }) => ({
      name: "UNSERVED_ROUTE",
      line,
      message: `${file}:${line} calls ${path}, which the API no longer serves; read through /api/reads/<name> or name a route listed in ${SERVED_ROUTES_FILE}`,
    }))
}
