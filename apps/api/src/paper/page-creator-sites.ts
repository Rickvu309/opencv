import path from "node:path"

import ts from "typescript"

export type SourceFile = { path: string; text: string }

const PAGE_TABLES = new Set(["paperPackageHeads", "paperDocs"])
const ROUTE_VERBS = new Set(["get", "post", "put", "patch", "delete"])
const COMMAND_NAME = /^[a-z]+\.[a-zA-Z]+$/

function moduleFile(
  from: string,
  specifier: string,
  known: Set<string>
): string | null {
  if (!specifier.startsWith(".")) return null
  const base = path.posix.join(path.posix.dirname(from), specifier)
  const stem = base.replace(/\.js$/, "")
  for (const candidate of [`${stem}.ts`, `${stem}.tsx`, `${stem}/index.ts`])
    if (known.has(candidate)) return candidate
  return null
}

function bindings(file: SourceFile, source: ts.SourceFile, known: Set<string>) {
  const local = new Map<string, string>()
  const reexports = new Map<string, string>()
  for (const statement of source.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name)
      local.set(statement.name.text, `${file.path}#${statement.name.text}`)
    if (ts.isVariableStatement(statement))
      for (const declaration of statement.declarationList.declarations)
        if (ts.isIdentifier(declaration.name))
          local.set(
            declaration.name.text,
            `${file.path}#${declaration.name.text}`
          )
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      const target = moduleFile(
        file.path,
        statement.moduleSpecifier.text,
        known
      )
      const named = statement.importClause?.namedBindings
      if (target && named && ts.isNamedImports(named))
        for (const element of named.elements)
          local.set(
            element.name.text,
            `${target}#${(element.propertyName ?? element.name).text}`
          )
    }
    if (
      ts.isExportDeclaration(statement) &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    ) {
      const target = moduleFile(
        file.path,
        statement.moduleSpecifier.text,
        known
      )
      if (target)
        for (const element of statement.exportClause.elements)
          reexports.set(
            `${file.path}#${element.name.text}`,
            `${target}#${(element.propertyName ?? element.name).text}`
          )
    }
  }
  return { local, reexports }
}

function commandCalled(call: ts.CallExpression): string | null {
  const [first] = call.arguments
  if (
    !ts.isPropertyAccessExpression(call.expression) ||
    call.expression.name.text !== "execute" ||
    !first ||
    !ts.isObjectLiteralExpression(first)
  )
    return null
  for (const property of first.properties) {
    if (
      !ts.isPropertyAssignment(property) ||
      !ts.isIdentifier(property.name) ||
      property.name.text !== "name"
    )
      continue
    const value = property.initializer
    if (ts.isStringLiteral(value) && COMMAND_NAME.test(value.text))
      return value.text
    if (
      ts.isPropertyAccessExpression(value) &&
      value.name.text === "name" &&
      ts.isElementAccessExpression(value.expression) &&
      ts.isStringLiteral(value.expression.argumentExpression) &&
      COMMAND_NAME.test(value.expression.argumentExpression.text)
    )
      return value.expression.argumentExpression.text
  }
  return null
}

function siteOf(file: SourceFile, node: ts.Node): string {
  let current: ts.Node | undefined = node.parent
  while (current) {
    if (
      ts.isPropertyAssignment(current) &&
      ts.isStringLiteral(current.name) &&
      COMMAND_NAME.test(current.name.text)
    )
      return `${file.path}#command:${current.name.text}`
    if (
      ts.isCallExpression(current) &&
      ts.isPropertyAccessExpression(current.expression) &&
      ROUTE_VERBS.has(current.expression.name.text) &&
      current.arguments[0] &&
      ts.isStringLiteral(current.arguments[0])
    )
      return `${file.path}#route:${current.expression.name.text.toUpperCase()} ${current.arguments[0].text}`
    if (ts.isFunctionDeclaration(current) && current.name)
      return `${file.path}#${current.name.text}`
    if (
      ts.isVariableDeclaration(current) &&
      ts.isIdentifier(current.name) &&
      ts.isVariableStatement(current.parent.parent) &&
      ts.isSourceFile(current.parent.parent.parent)
    )
      return `${file.path}#${current.name.text}`
    current = current.parent
  }
  return `${file.path}#module`
}

function readSource(node: ts.Expression): boolean {
  if (ts.isParenthesizedExpression(node)) return readSource(node.expression)
  if (ts.isConditionalExpression(node))
    return readSource(node.whenTrue) && readSource(node.whenFalse)
  return (
    ts.isObjectLiteralExpression(node) &&
    node.properties.some(
      (property) =>
        ts.isPropertyAssignment(property) &&
        ts.isIdentifier(property.name) &&
        property.name.text === "kind" &&
        ts.isStringLiteral(property.initializer) &&
        property.initializer.text === "read"
    )
  )
}

function readsOnly(call: ts.CallExpression) {
  return call.arguments.some(readSource)
}

function registers(site: string) {
  return /#(command:|route:|register[A-Z])/.test(site)
}

function commandOfSite(site: string): string | null {
  const command = site.match(/#command:(.+)$/)
  if (command?.[1]) return command[1]
  const operation = site.match(
    /^([a-z]+)\/operations\/([a-z-]+)\/server\.ts#implementation$/
  )
  if (!operation?.[1] || !operation[2]) return null
  const verb = operation[2].replace(/-([a-z])/g, (_, letter: string) =>
    letter.toUpperCase()
  )
  return `${operation[1]}.${verb}`
}

export function pageCreatorSites(
  files: SourceFile[],
  namedCommands: Record<string, string>
): Record<string, number> {
  const known = new Set(files.map((file) => file.path))
  const parsed = files.map((file) => {
    const source = ts.createSourceFile(
      file.path,
      file.text,
      ts.ScriptTarget.Latest,
      true,
      file.path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    )
    return { file, source, ...bindings(file, source, known) }
  })
  const reexports = new Map<string, string>()
  for (const entry of parsed)
    for (const [from, to] of entry.reexports) reexports.set(from, to)
  const resolve = (key: string) => {
    let current = key
    for (let hop = 0; hop < 8 && reexports.has(current); hop += 1)
      current = reexports.get(current) ?? current
    return current
  }
  const creators = new Set<string>()
  const creatorCommands = new Set<string>()
  let sites: Record<string, number> = {}
  for (let round = 0; round < 32; round += 1) {
    const found: Record<string, number> = {}
    const add = (site: string) => {
      found[site] = (found[site] ?? 0) + 1
    }
    for (const { file, source, local } of parsed) {
      const visit = (node: ts.Node) => {
        if (ts.isCallExpression(node)) {
          const callee = node.expression
          const [first] = node.arguments
          if (
            ts.isPropertyAccessExpression(callee) &&
            callee.name.text === "insert" &&
            first &&
            ts.isIdentifier(first) &&
            PAGE_TABLES.has(first.text)
          )
            add(siteOf(file, node))
          if (ts.isIdentifier(callee)) {
            const target = local.get(callee.text)
            if (target && creators.has(resolve(target)) && !readsOnly(node))
              add(siteOf(file, node))
          }
          const command = commandCalled(node)
          if (command && creatorCommands.has(command)) add(siteOf(file, node))
        }
        if (
          ts.isPropertyAssignment(node) &&
          ts.isIdentifier(node.initializer)
        ) {
          const target = local.get(node.initializer.text)
          const key = ts.isStringLiteral(node.name) ? node.name.text : null
          if (
            target &&
            creators.has(resolve(target)) &&
            key &&
            COMMAND_NAME.test(key)
          )
            add(`${file.path}#command:${key}`)
        }
        ts.forEachChild(node, visit)
      }
      visit(source)
    }
    const before = creators.size + creatorCommands.size
    for (const site of Object.keys(found)) {
      const command = commandOfSite(site) ?? namedCommands[site] ?? null
      if (command) creatorCommands.add(command)
      if (!registers(site)) creators.add(site)
    }
    sites = found
    if (creators.size + creatorCommands.size === before) break
  }
  return Object.fromEntries(
    Object.entries(sites).sort(([left], [right]) => left.localeCompare(right))
  )
}
