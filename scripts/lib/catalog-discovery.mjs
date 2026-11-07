import {
  existsSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
} from "node:fs"
import { createRequire, registerHooks } from "node:module"
import path from "node:path"
import { pathToFileURL } from "node:url"
import ts from "typescript"

import {
  CatalogError,
  detectBrowserMetadata,
  digestOf,
  browserPackages,
  plainCode,
  inspectBrowserImports,
} from "./operation-catalog.mjs"
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

export const browserSource = (file) =>
  file.startsWith(domain) &&
  plainCode(file) &&
  !file.split("/").some((part) => ["server", "server-only"].includes(part)) &&
  !/(?:^|[/.])server\.(?:ts|tsx|js|mjs)$/.test(file)

export function browserPackageRoots(root) {
  const require = createRequire(path.join(root, domain, "index.ts"))
  return browserPackages.map((name) =>
    realpathSync(path.dirname(require.resolve(`${name}/package.json`)))
  )
}

export function browserGraph(root, entries) {
  const sources = new Map()
  const boundaryErrors = []
  const canonicalRoot = realpathSync(root)
  const reject = (file, line) =>
    boundaryErrors.push({
      file,
      detail: `line ${line}: operation declarations may only import plain code from packages/domain`,
    })
  const resolve = (file, { specifier, line }) => {
    if (browserPackages.includes(specifier)) {
      try {
        const require = createRequire(path.join(root, file))
        const target = realpathSync(require.resolve(specifier))
        if (
          !browserPackageRoots(root).some((allowed) =>
            target.startsWith(`${allowed}${path.sep}`)
          )
        )
          reject(file, line)
      } catch {
        reject(file, line)
      }
      return
    }
    const base = path.resolve(root, toRepoPath(specifier, file))
    const target = [
      base.replace(/\.js$/, ".ts"),
      base.replace(/\.js$/, ".tsx"),
      base,
      ...["ts", "tsx", "js", "mjs"].flatMap((extension) => [
        `${base}.${extension}`,
        `${base}/index.${extension}`,
      ]),
    ].find((candidate) => existsSync(candidate) && statSync(candidate).isFile())
    const rel =
      target &&
      path
        .relative(canonicalRoot, realpathSync(target))
        .replaceAll(path.sep, "/")
    if (
      !rel ||
      !browserSource(rel) ||
      !browserSource(path.relative(root, target).replaceAll(path.sep, "/"))
    ) {
      reject(file, line)
      return
    }
    visit(rel)
  }
  const visit = (file) => {
    const canonical = path
      .relative(canonicalRoot, realpathSync(path.join(root, file)))
      .replaceAll(path.sep, "/")
    if (!browserSource(file) || !browserSource(canonical)) {
      reject(file, 1)
      return
    }
    if (sources.has(canonical)) return
    const text = read(root, canonical)
    sources.set(canonical, text)
    const metadata = detectBrowserMetadata(canonical, text)
    boundaryErrors.push(...metadata)
    const inspected = inspectBrowserImports(canonical, text)
    if (!metadata.length) boundaryErrors.push(...inspected.boundaryErrors)
    inspected.imports.forEach((edge) => resolve(canonical, edge))
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
        const candidates = [
          target.pathname.replace(/\.js$/, ".ts"),
          target.pathname.replace(/\.js$/, ".tsx"),
          target.pathname,
        ]
        target.pathname =
          candidates.find((candidate) => existsSync(candidate)) ??
          target.pathname
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
