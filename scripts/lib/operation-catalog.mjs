import { createHash } from "node:crypto"

export class CatalogError extends Error {
  constructor(kind, file, detail) {
    super(`${kind}: ${file}: ${detail}`)
    this.name = "CatalogError"
    this.kind = kind
    this.file = file
  }
}

const slug = (name) =>
  name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
const normalized = (name) => name.replace(/[^a-z0-9]/gi, "").toLowerCase()

export function digestOf(snapshot) {
  return createHash("sha256").update(JSON.stringify(snapshot)).digest("hex")
}

export function detect(value, outputDigest) {
  const snapshot = typeof value === "string" ? JSON.parse(value) : value
  const errors = []
  const names = new Set()
  const paired = new Set()
  for (const operation of snapshot.operations) {
    const { file, name, namespace, directory } = operation
    const key = normalized(name)
    if (names.has(key))
      errors.push(new CatalogError("duplicate-name", file, name))
    names.add(key)
    const [prefix, action, extra] = name.split(".")
    if (prefix !== namespace || !action || extra || slug(action) !== directory)
      errors.push(new CatalogError("namespace-mismatch", file, name))
    const servers = snapshot.servers.filter(
      (server) => server.operation === file
    )
    if (servers.length === 0)
      errors.push(new CatalogError("missing-implementation", file, name))
    for (const server of servers) {
      paired.add(server.file)
      if (server.namespace !== namespace || server.directory !== directory)
        errors.push(new CatalogError("namespace-mismatch", server.file, name))
    }
    if (servers.length > 1)
      errors.push(
        new CatalogError("duplicate-name", file, "multiple implementations")
      )
    if (operation.schemaError)
      errors.push(
        new CatalogError("unexportable-schema", file, operation.schemaError)
      )
  }
  for (const server of snapshot.servers)
    if (!paired.has(server.file))
      errors.push(
        new CatalogError("orphan-implementation", server.file, server.operation)
      )
  for (const issue of snapshot.boundaryErrors ?? [])
    errors.push(new CatalogError("browser-import", issue.file, issue.detail))
  if (outputDigest !== undefined && outputDigest !== digestOf(snapshot))
    errors.push(
      new CatalogError(
        "stale-output",
        "catalog",
        "run node scripts/catalog.mjs generate"
      )
    )
  return errors
}

export function renderCatalog(snapshot) {
  const digest = digestOf(snapshot)
  const operations = [...snapshot.operations].sort((a, b) =>
    a.name.localeCompare(b.name, "en")
  )
  const browser = operations.map(
    (operation, index) =>
      `import { operation as operation${index} } from ${JSON.stringify(`../${operation.file.replace("packages/domain/src/", "").replace(/\.ts$/, ".js")}`)}`
  )
  const server = [
    'import type { Implementations } from "@workspace/domain"',
    'import { catalog } from "@workspace/domain"',
  ]
  operations.forEach((operation, index) => {
    const implementation = snapshot.servers.find(
      (entry) => entry.operation === operation.file
    )
    server.push(
      `import { implementation as implementation${index} } from ${JSON.stringify(`../../${implementation.file.replace("apps/api/src/", "").replace(/\.ts$/, ".js")}`)}`
    )
  })
  const entries = operations.map(
    (operation, index) =>
      `  ${JSON.stringify(operation.name)}: operation${index},`
  )
  const bindings = operations.map(
    (operation, index) =>
      `  ${JSON.stringify(operation.name)}: implementation${index},`
  )
  return {
    "packages/domain/src/generated/catalog.ts": `${browser.join("\n")}${browser.length ? "\n\n" : ""}export const catalog = {\n${entries.join("\n")}\n} as const\n\nexport const catalogDigest = ${JSON.stringify(digest)}\n`,
    "apps/api/src/registry/generated/catalog.ts": `${server.join("\n")}\n\nexport const implementations = {\n${bindings.join("\n")}\n} satisfies Implementations<typeof catalog>\n`,
    "packages/domain/src/generated/catalog.digest": `${digest}\n`,
  }
}
