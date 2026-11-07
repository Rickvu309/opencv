import ts from "typescript"
import { toRepoPath } from "./source-imports.mjs"

const parse = (file, text) =>
  ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  )
const snapshotOf = (value) =>
  typeof value === "string" ? JSON.parse(value) : value
const literal = (node) => (ts.isStringLiteralLike(node) ? node.text : null)
const testFile = (file) => /(?:\.test\.|\.type-test\.|\/test\/)/.test(file)
const generated = (file) => file.includes("/generated/")
const spelling = (node, source) => node.getText(source).replace(/\s+/g, "")

function walk(node, visit) {
  visit(node)
  ts.forEachChild(node, (child) => walk(child, visit))
}

export function detectDefinitions(value) {
  const snapshot = snapshotOf(value)
  const operations = new Map(
    snapshot.operations.map((operation) => [operation.name, operation])
  )
  const problems = []
  for (const [file, text] of snapshot.sources) {
    if (testFile(file) || generated(file)) continue
    const source = parse(file, text)
    walk(source, (node) => {
      if (!ts.isStringLiteralLike(node)) return
      const name = node.text.replace(/^\/api\/(?:commands|reads)\//, "")
      const operation = operations.get(name)
      if (!operation || file === operation.file || file === operation.server)
        return
      const parent = node.parent
      const property =
        ts.isPropertyAssignment(parent) &&
        (parent.name === node || spelling(parent.name, source) === "name")
      const adapter =
        ts.isCallExpression(parent) &&
        (/\/(?:http|commands|queries)\.ts$/.test(file) ||
          file.startsWith("apps/web/src/lib/"))
      const key =
        ts.isArrayLiteralExpression(parent) &&
        file.startsWith("apps/web/src/lib/")
      if (property || adapter || key)
        problems.push({
          kind: "duplicate-adapter",
          file,
          name,
          line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
        })
    })
  }
  return problems
}

function importTargets(file, source) {
  const targets = []
  walk(source, (node) => {
    let specifier
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier
    )
      specifier = literal(node.moduleSpecifier)
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0]
    )
      specifier = literal(node.arguments[0])
    if (!specifier) return
    const target =
      specifier === "@workspace/domain"
        ? "packages/domain/src/index.ts"
        : toRepoPath(specifier, file)
    if (target) targets.push(target.replace(/\.js$/, ".ts"))
  })
  return targets
}

function method(source, name) {
  let found
  walk(source, (node) => {
    if (
      (ts.isMethodDeclaration(node) || ts.isFunctionDeclaration(node)) &&
      node.name?.getText(source) === name
    )
      found = node
  })
  return found
}

function returned(node) {
  const values = []
  if (node)
    walk(node, (child) => {
      if (ts.isReturnStatement(child) && child.expression)
        values.push(child.expression)
    })
  return values
}

export function detectPublication(value) {
  const snapshot = snapshotOf(value)
  const sources = new Map(snapshot.sources)
  const problems = []
  const foundation = "packages/domain/src/operation.ts"
  if (sources.has(foundation)) {
    for (const target of importTargets(
      foundation,
      parse(foundation, sources.get(foundation))
    )) {
      if (
        target === "packages/domain/src/contract.ts" ||
        target === "packages/domain/src/registry.ts" ||
        target === "packages/domain/src/catalog.ts" ||
        target.startsWith("packages/domain/src/generated/")
      )
        problems.push({
          kind: "descriptor-foundation",
          file: foundation,
          target,
        })
    }
  }
  const visited = new Set()
  const visit = (file) => {
    if (visited.has(file) || !sources.has(file)) return
    visited.add(file)
    if (
      file.startsWith("apps/api/") ||
      file.split("/").includes("server-only") ||
      file.endsWith("/server.ts")
    ) {
      problems.push({ kind: "private-import", file })
      return
    }
    const source = parse(file, sources.get(file))
    for (const target of importTargets(file, source)) {
      const resolved = [
        target,
        `${target}.ts`,
        `${target}.tsx`,
        `${target}/index.ts`,
        target.replace(/\.ts$/, ".tsx"),
      ].find((candidate) => sources.has(candidate))
      if (resolved) visit(resolved)
    }
    walk(source, (node) => {
      if (
        (file.startsWith("apps/web/src/") ||
          snapshot.operations.some((operation) => operation.file === file)) &&
        ts.isIdentifier(node) &&
        ["privateResult", "privateReceipt", "previousPriority"].includes(
          node.text
        )
      )
        problems.push({ kind: "private-symbol", file, symbol: node.text })
    })
  }
  for (const file of sources.keys())
    if (file.startsWith("apps/web/src/") && !testFile(file)) visit(file)
  for (const [file, text] of sources) {
    if (file.endsWith("/registry/catalog-publication.ts")) {
      const source = parse(file, text)
      const projection = returned(method(source, "publicOutput"))
      const valid =
        projection.length === 1 &&
        ts.isConditionalExpression(projection[0]) &&
        spelling(projection[0], source) ===
          "operation?operation.publicResult.parse(output):output"
      if (!valid) problems.push({ kind: "raw-public-output", file })
      const publisher = returned(method(source, "publishResult")).filter(
        ts.isObjectLiteralExpression
      )
      for (const result of publisher) {
        const properties = result.properties
        const outputAt = properties.findIndex(
          (property) =>
            ts.isPropertyAssignment(property) &&
            spelling(property.name, source) === "output" &&
            spelling(property.initializer, source) ===
              "this.publicOutput(name,result.output)"
        )
        if (
          outputAt < 0 ||
          properties.slice(outputAt + 1).some(ts.isSpreadAssignment)
        )
          problems.push({ kind: "raw-public-output", file })
        const reversal = properties.find(
          (property) =>
            ts.isPropertyAssignment(property) &&
            spelling(property.name, source) === "reversal"
        )
        const value = reversal?.initializer
        const fields =
          value &&
          ts.isConditionalExpression(value) &&
          ts.isObjectLiteralExpression(value.whenTrue)
            ? value.whenTrue.properties
            : []
        const safeReversal =
          value &&
          ts.isConditionalExpression(value) &&
          spelling(value.condition, source) === "result.reversal" &&
          value.whenFalse.kind === ts.SyntaxKind.NullKeyword &&
          fields.length === 2 &&
          fields.some(
            (field) =>
              ts.isPropertyAssignment(field) &&
              spelling(field.name, source) === "command" &&
              spelling(field.initializer, source) === "result.reversal.command"
          ) &&
          fields.some(
            (field) =>
              ts.isPropertyAssignment(field) &&
              spelling(field.name, source) === "input" &&
              ts.isObjectLiteralExpression(field.initializer) &&
              field.initializer.properties.length === 0
          )
        if (!safeReversal) problems.push({ kind: "private-reversal", file })
      }
      if (publisher.length !== 1)
        problems.push({ kind: "raw-public-output", file })
    }
    if (file.endsWith("/registry/bind.ts")) {
      const source = parse(file, text)
      let projectedRead = false
      walk(source, (node) => {
        if (
          ts.isPropertyAssignment(node) &&
          spelling(node.name, source) === "read" &&
          ts.isArrowFunction(node.initializer)
        )
          projectedRead ||=
            spelling(node.initializer.body, source) ===
            "operation.publicResult.parse(awaitbinding.execute(input,actor))"
      })
      if (!projectedRead) problems.push({ kind: "raw-public-read", file })
    }
  }
  return problems
}
