import { createHash } from "node:crypto"
import ts from "typescript"

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

export function detectBrowserMetadata(file, text) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const errors = []
  const walk = (node) => {
    if (
      ts.isMetaProperty(node) &&
      node.keywordToken === ts.SyntaxKind.ImportKeyword
    )
      errors.push({
        file,
        detail: `line ${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}: operation declarations must not use import.meta`,
      })
    ts.forEachChild(node, walk)
  }
  walk(source)
  return errors
}

export const browserPackages = ["zod"]
export const plainCode = (file) => /\.(?:ts|tsx|js|mjs)$/.test(file)

export function inspectBrowserImports(file, text) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const imports = []
  const boundaryErrors = []
  const reject = (node) =>
    boundaryErrors.push({
      file,
      detail: `line ${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}: operation declarations may only import plain code from packages/domain`,
    })
  const assetConstructor = (expression) => {
    if (
      ts.isParenthesizedExpression(expression) ||
      ts.isAsExpression(expression) ||
      ts.isTypeAssertionExpression(expression) ||
      ts.isNonNullExpression(expression) ||
      ts.isSatisfiesExpression(expression)
    )
      return assetConstructor(expression.expression)
    if (ts.isPropertyAccessExpression(expression))
      return assetConstructor(expression.name)
    if (ts.isElementAccessExpression(expression))
      return assetConstructor(expression.argumentExpression)
    return (
      (ts.isIdentifier(expression) || ts.isStringLiteral(expression)) &&
      ["Worker", "URL"].includes(expression.text)
    )
  }
  const walk = (node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier
    ) {
      const specifier = node.moduleSpecifier.text
      if (
        !ts.isStringLiteral(node.moduleSpecifier) ||
        specifier.includes("?") ||
        specifier.includes("#") ||
        (!browserPackages.includes(specifier) &&
          (!specifier.startsWith(".") ||
            (pathExtension(specifier) && !plainCode(specifier))))
      )
        reject(node)
      else
        imports.push({
          specifier,
          line:
            source.getLineAndCharacterOfPosition(node.getStart(source)).line +
            1,
        })
    }
    if (
      ts.isImportEqualsDeclaration(node) ||
      ts.isImportTypeNode(node) ||
      (ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword) ||
      (ts.isIdentifier(node) && node.text === "require") ||
      (ts.isNewExpression(node) && assetConstructor(node.expression))
    )
      reject(node)
    ts.forEachChild(node, walk)
  }
  walk(source)
  return { imports, boundaryErrors }
}

const pathExtension = (specifier) => specifier.split("/").at(-1).includes(".")

export function detect(value) {
  const snapshot = typeof value === "string" ? JSON.parse(value) : value
  const errors = []
  const names = new Set()
  const paired = new Set()
  for (const operation of snapshot.operations) {
    const { file, name, owner, namespace, directory } = operation
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
      if (
        server.owner !== owner ||
        server.namespace !== namespace ||
        server.directory !== directory
      )
        errors.push(
          new CatalogError(
            "namespace-mismatch",
            server.file,
            `${name} requires ${owner}/operations/${namespace}/${directory}/server.ts`
          )
        )
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
  for (const text of snapshot.browserSources ?? [])
    for (const issue of detectBrowserMetadata("operation.ts", text))
      errors.push(new CatalogError("browser-import", issue.file, issue.detail))
  for (const text of snapshot.importSources ?? [])
    for (const issue of inspectBrowserImports("operation.ts", text)
      .boundaryErrors)
      errors.push(new CatalogError("browser-import", issue.file, issue.detail))
  for (const issue of snapshot.boundaryErrors ?? [])
    errors.push(new CatalogError("browser-import", issue.file, issue.detail))
  return errors
}

export const aliasOf = (name) =>
  name
    .split(".")
    .map((part) => part.replace(/[^A-Za-z0-9_]/g, "_"))
    .join("$")
    .replace(/^(?=[0-9])/, "_")

export function renderCatalog(snapshot) {
  const operations = [...snapshot.operations].sort((a, b) =>
    a.name.localeCompare(b.name, "en")
  )
  const browser = operations.map(
    (operation) =>
      `import { operation as ${aliasOf(operation.name)} } from ${JSON.stringify(`../${operation.file.replace("packages/domain/src/", "").replace(/\.ts$/, ".js")}`)}`
  )
  const server = [
    'import type { Implementations } from "@workspace/domain"',
    'import { catalog } from "@workspace/domain"',
  ]
  for (const operation of operations) {
    const implementation = snapshot.servers.find(
      (entry) => entry.operation === operation.file
    )
    server.push(
      `import { implementation as ${aliasOf(operation.name)} } from ${JSON.stringify(`../../${implementation.file.replace("apps/api/src/", "").replace(/\.ts$/, ".js")}`)}`
    )
  }
  const entries = operations.map(
    (operation) =>
      `  ${JSON.stringify(operation.name)}: ${aliasOf(operation.name)},`
  )
  return {
    "packages/domain/src/generated/catalog.ts": `${browser.join("\n")}${browser.length ? "\n\n" : ""}export const catalog = {\n${entries.join("\n")}\n} as const\n`,
    "apps/api/src/registry/generated/catalog.ts": `${server.join("\n")}\n\nexport const implementations = {\n${entries.join("\n")}\n} satisfies Implementations<typeof catalog>\n`,
  }
}
