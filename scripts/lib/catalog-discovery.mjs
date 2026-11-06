import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs"
import { createRequire, registerHooks } from "node:module"
import path from "node:path"
import { pathToFileURL } from "node:url"
import ts from "typescript"

import { CatalogError, digestOf } from "./operation-catalog.mjs"
import { toRepoPath } from "./source-imports.mjs"
import { defineOperation } from "../../packages/domain/src/operation.ts"

const domain = "packages/domain/src/"
const api = "apps/api/src/"
const parse = (file, text) =>
  ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
const read = (root, file) =>
  readFileSync(path.join(root, file), "utf8").replace(/\r\n?/g, "\n")

function files(root, directory) {
  const full = path.join(root, directory)
  if (!existsSync(full)) return []
  return readdirSync(full, { withFileTypes: true })
    .flatMap((entry) => {
      const file = `${directory}/${entry.name}`
      if (entry.isSymbolicLink())
        throw new CatalogError(
          "browser-import",
          file,
          "symlinks are not catalog sources"
        )
      return entry.isDirectory() ? files(root, file) : [file]
    })
    .sort()
}

function browserMetadataRead(node) {
  let receiver = node
  while (
    receiver.parent &&
    (ts.isParenthesizedExpression(receiver.parent) ||
      ts.isAsExpression(receiver.parent) ||
      ts.isSatisfiesExpression(receiver.parent) ||
      ts.isTypeAssertionExpression(receiver.parent) ||
      ts.isNonNullExpression(receiver.parent)) &&
    receiver.parent.expression === receiver
  )
    receiver = receiver.parent
  const access = receiver.parent
  return (
    access &&
    ts.isPropertyAccessExpression(access) &&
    access.expression === receiver &&
    !access.questionDotToken &&
    (access.name.text === "env" || access.name.text === "url")
  )
}

export function browserGraph(root, entries) {
  const sources = new Map()
  const boundaryErrors = []
  const resolve = (file, specifier) => {
    if (specifier === "zod" || specifier.startsWith("zod/")) return
    if (!specifier.startsWith(".")) {
      boundaryErrors.push({
        file,
        detail: `non-browser dependency ${specifier}`,
      })
      return
    }
    const base = path.resolve(root, toRepoPath(specifier, file))
    const target = [
      base.replace(/\.js$/, ".ts"),
      `${base}.ts`,
      `${base}/index.ts`,
    ].find((candidate) => existsSync(candidate))
    const rel =
      target &&
      path.relative(root, realpathSync(target)).replaceAll(path.sep, "/")
    if (!rel?.startsWith(domain) || /\/server\.ts$/.test(rel)) {
      boundaryErrors.push({
        file,
        detail: `server or unresolved dependency ${specifier}`,
      })
      return
    }
    visit(rel)
  }
  const visit = (file) => {
    if (sources.has(file)) return
    const text = read(root, file)
    sources.set(file, text)
    const walk = (node) => {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier
      )
        resolve(file, node.moduleSpecifier.text)
      if (
        ts.isMetaProperty(node) &&
        node.keywordToken === ts.SyntaxKind.ImportKeyword &&
        !browserMetadataRead(node)
      )
        boundaryErrors.push({
          file,
          detail:
            "only direct static import.meta.env or import.meta.url reads are browser-discoverable",
        })
      if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          node.expression.getText() === "require")
      ) {
        const [argument] = node.arguments
        if (argument && ts.isStringLiteral(argument))
          resolve(file, argument.text)
        else
          boundaryErrors.push({
            file,
            detail: "computed import is not browser-discoverable",
          })
      }
      ts.forEachChild(node, walk)
    }
    walk(parse(file, text))
  }
  entries.forEach(visit)
  return {
    sources: [...sources].sort(([a], [b]) => a.localeCompare(b, "en")),
    boundaryErrors,
  }
}

export async function discoverCatalog(root) {
  const declarations = files(root, `${domain}operations`).filter((file) =>
    file.endsWith("/operation.ts")
  )
  const servers = files(root, api.slice(0, -1)).filter((file) =>
    /\/operations\/.*\/server\.ts$/.test(file)
  )
  const graph = browserGraph(root, declarations)
  const generated = graph.sources.find(([file]) =>
    file.startsWith(`${domain}generated/`)
  )
  if (generated)
    graph.boundaryErrors.push({
      file: generated[0],
      detail: "operation declarations cannot depend on generated catalogs",
    })
  if (graph.boundaryErrors.length)
    throw new CatalogError(
      "browser-import",
      graph.boundaryErrors[0].file,
      graph.boundaryErrors[0].detail
    )
  const generation = digestOf(graph.sources)
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (
        context.parentURL?.startsWith(
          pathToFileURL(path.join(root, domain)).href
        ) &&
        specifier.startsWith(".")
      ) {
        const target = new URL(specifier, context.parentURL)
        target.pathname = target.pathname.replace(/\.js$/, ".ts")
        target.search = `?catalog=${generation}`
        return next(target.href, context)
      }
      return next(specifier, context)
    },
  })
  const operations = []
  const require = createRequire(path.join(root, domain, "index.ts"))
  const { z } = require("zod")
  try {
    for (const file of declarations) {
      const match = file.match(
        /^packages\/domain\/src\/operations\/([^/]+)\/([^/]+)\/operation\.ts$/
      )
      if (!match)
        throw new CatalogError(
          "namespace-mismatch",
          file,
          "expected namespace/operation/operation.ts"
        )
      let operation
      try {
        const module = await import(
          `${pathToFileURL(path.join(root, file)).href}?catalog=${generation}`
        )
        operation = module.operation
        defineOperation(operation)
      } catch (error) {
        throw new CatalogError("unexportable-schema", file, String(error))
      }
      let schemaError
      let schemas
      try {
        schemas = {
          input: z.toJSONSchema(operation.input, {
            io: "input",
            unrepresentable: "throw",
          }),
          publicResult: z.toJSONSchema(operation.publicResult, {
            io: "output",
            unrepresentable: "throw",
          }),
        }
      } catch (error) {
        schemaError = String(error)
      }
      operations.push({
        file,
        name: operation.name,
        owner: operation.owner,
        namespace: match[1],
        directory: match[2],
        schemas,
        schemaError,
      })
    }
  } finally {
    hooks.deregister()
  }
  const implementations = servers.map((file) => {
    const source = parse(file, read(root, file))
    const imports = source.statements
      .filter(ts.isImportDeclaration)
      .flatMap((node) => {
        const bindings = node.importClause?.namedBindings
        if (
          !bindings ||
          !ts.isNamedImports(bindings) ||
          !bindings.elements.some(
            (entry) => (entry.propertyName ?? entry.name).text === "operation"
          )
        )
          return []
        const specifier = node.moduleSpecifier.text
        const target = path
          .resolve(
            root,
            specifier.startsWith("@workspace/domain/operations/")
              ? `${domain}${specifier.replace("@workspace/domain/", "")}/operation.ts`
              : path.join(path.dirname(file), specifier)
          )
          .replace(/\.js$/, ".ts")
        return [path.relative(root, target).replaceAll(path.sep, "/")]
      })
    const exported = source.statements.some(
      (node) =>
        ts.isVariableStatement(node) &&
        node.modifiers?.some(
          (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
        ) &&
        node.declarationList.declarations.some(
          (entry) =>
            ts.isIdentifier(entry.name) && entry.name.text === "implementation"
        )
    )
    const match = file.match(
      /^apps\/api\/src\/([^/]+)\/operations\/([^/]+)\/([^/]+)\/server\.ts$/
    )
    return {
      file,
      operation: exported && imports.length === 1 ? imports[0] : "unbound",
      owner: match?.[1],
      namespace: match?.[2],
      directory: match?.[3],
    }
  })
  return {
    operations,
    servers: implementations,
    sources: [
      ...graph.sources,
      ...servers.map((file) => [file, read(root, file)]),
    ],
    boundaryErrors: graph.boundaryErrors,
  }
}
