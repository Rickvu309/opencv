import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../..")

export const POOL_FILE = "scripts/ui/account-pool.mjs"
export const ONE_DOOR_FILE = "apps/api/src/one-door.test.ts"
export const CATALOG_FILE = "packages/domain/src/generated/catalog.ts"

const READ_DOOR = /^\/api\/reads\/([a-z]+\.[A-Za-z]+)$/

const workingTree = {
  read: (name) =>
    existsSync(path.join(root, name))
      ? readFileSync(path.join(root, name), "utf8")
      : null,
}

export function waitingRoutes(oneDoorSource) {
  const source = oneDoorSource ?? ""
  const start = source.indexOf("const waitingToBecomeOperations = [")
  if (start < 0) return []
  const end = source.indexOf("]", start)
  return [...source.slice(start, end).matchAll(/"([A-Z]+) ([^"]+)"/g)].map(
    (match) => `${match[1]} ${match[2]}`
  )
}

export function catalogNames(catalogSource) {
  return [
    ...(catalogSource ?? "").matchAll(/^ {2}"([a-z]+\.[A-Za-z]+)":/gm),
  ].map((match) => match[1])
}

export function libraryReads(poolSource) {
  const start = poolSource.indexOf("export const LIBRARY_READS = {")
  if (start < 0) return {}
  const end = poolSource.indexOf("\n}", start)
  return Object.fromEntries(
    [
      ...poolSource
        .slice(start, end)
        .matchAll(
          /(\w+): (?:"([^"]+)"|\{ path: "([^"]+)"(?:, body: "([^"]*)")? \})/g
        ),
    ].map((match) => [
      match[1],
      match[2] !== undefined
        ? { path: match[2] }
        : {
            path: match[3],
            ...(match[4] === undefined ? {} : { body: match[4] }),
          },
    ])
  )
}

export function libraryProblems(reads, { waiting, catalog }) {
  return Object.entries(reads).flatMap(([kind, read]) => {
    const door = READ_DOOR.exec(read.path)
    if (door)
      return read.body !== undefined && catalog.includes(door[1])
        ? []
        : [`${kind}: ${read.path} is not a catalog read sent with a body`]
    return read.body === undefined && waiting.includes(`GET ${read.path}`)
      ? []
      : [
          `${kind}: GET ${read.path} is not served: read it through /api/reads/<name>`,
        ]
  })
}

export function detect(source, file = POOL_FILE, io = workingTree) {
  return libraryProblems(libraryReads(source), {
    waiting: waitingRoutes(io.read(ONE_DOOR_FILE)),
    catalog: catalogNames(io.read(CATALOG_FILE)),
  }).map((problem) => `${file}: ${problem}`)
}
