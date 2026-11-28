import ts from "typescript"

export type SourceFile = { path: string; text: string }

export const PAGE_TABLES: Record<string, string> = {
  paperDocs: "paper_docs",
}

export const PAGE_STORE_FILES = ["paper/store.ts"]

const READ_CALLS = new Set([
  "from",
  "innerJoin",
  "leftJoin",
  "rightJoin",
  "fullJoin",
  "crossJoin",
  "update",
  "delete",
  "getTableColumns",
  "getTableName",
])
const SQL_TARGET =
  /\b(?:insert\s+into|update(?:\s+only)?|delete\s+from(?:\s+only)?|merge\s+into|truncate(?:\s+table)?(?:\s+only)?|copy)\s+(?:"?\w+"?\s*\.\s*)?"?(\w+)"?/gi

export const PAGE_TABLE_VALUE_USES: Record<string, number> = {}

function parse(file: SourceFile) {
  return ts.createSourceFile(
    file.path,
    file.text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  )
}

function pageName(text: string) {
  return Object.prototype.hasOwnProperty.call(PAGE_TABLES, text)
}

function bindingsOf(source: ts.SourceFile) {
  const tables = new Set<string>()
  const namespaces = new Set<string>()
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement)) continue
    const clause = statement.importClause
    const named = clause?.namedBindings
    if (named && ts.isNamespaceImport(named)) namespaces.add(named.name.text)
    if (named && ts.isNamedImports(named))
      for (const element of named.elements)
        if (pageName((element.propertyName ?? element.name).text))
          tables.add(element.name.text)
  }
  return { tables, namespaces }
}

function readPosition(node: ts.Expression): boolean {
  const parent = node.parent
  if (ts.isTypeQueryNode(parent) || ts.isQualifiedName(parent)) return true
  if (ts.isPropertyAccessExpression(parent) && parent.expression === node)
    return true
  if (ts.isCallExpression(parent) && parent.arguments[0] === node) {
    const callee = parent.expression
    const name = ts.isPropertyAccessExpression(callee)
      ? callee.name.text
      : ts.isIdentifier(callee)
        ? callee.text
        : ""
    return READ_CALLS.has(name)
  }
  return false
}

function literalText(node: ts.Node): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    return node.text
  if (ts.isTemplateExpression(node))
    return [
      node.head.text,
      ...node.templateSpans.map((span) => span.literal.text),
    ].join(" ")
  return null
}

export function pageTableMisuses(file: SourceFile): string[] {
  const source = parse(file)
  const { tables, namespaces } = bindingsOf(source)
  const found: string[] = []
  const at = (node: ts.Node, what: string) => {
    const { line } = source.getLineAndCharacterOfPosition(node.getStart())
    found.push(`${file.path}:${line + 1} ${what}`)
  }
  const visit = (node: ts.Node) => {
    if (
      ts.isIdentifier(node) &&
      tables.has(node.text) &&
      !ts.isImportSpecifier(node.parent) &&
      !(
        ts.isPropertyAccessExpression(node.parent) && node.parent.name === node
      ) &&
      !readPosition(node)
    )
      at(node, `uses page table ${node.text} outside a read`)
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      namespaces.has(node.expression.text) &&
      pageName(node.name.text) &&
      !readPosition(node)
    )
      at(
        node,
        `uses page table ${node.name.text} through a namespace outside a read`
      )
    if (
      ts.isElementAccessExpression(node) &&
      ts.isStringLiteral(node.argumentExpression) &&
      pageName(node.argumentExpression.text)
    )
      at(
        node,
        `reaches page table ${node.argumentExpression.text} by a computed name`
      )
    if (
      ts.isBindingElement(node) &&
      pageName(
        (node.propertyName && ts.isIdentifier(node.propertyName)
          ? node.propertyName
          : ts.isIdentifier(node.name)
            ? node.name
            : undefined
        )?.text ?? ""
      )
    )
      at(node, "takes a page table out of a module object")
    const literal = literalText(node)
    if (literal !== null)
      for (const match of literal.matchAll(SQL_TARGET))
        if (Object.values(PAGE_TABLES).includes((match[1] ?? "").toLowerCase()))
          at(node, `writes page table ${match[1]} in raw SQL`)
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

function insertsPageTable(node: ts.Node, tables: Set<string>): boolean {
  let hit = false
  const visit = (child: ts.Node) => {
    if (
      ts.isCallExpression(child) &&
      ts.isPropertyAccessExpression(child.expression) &&
      child.expression.name.text === "insert" &&
      child.arguments[0] &&
      ts.isIdentifier(child.arguments[0]) &&
      (tables.has(child.arguments[0].text) || pageName(child.arguments[0].text))
    )
      hit = true
    ts.forEachChild(child, visit)
  }
  visit(node)
  return hit
}

function calls(node: ts.Node): Set<string> {
  const names = new Set<string>()
  const visit = (child: ts.Node) => {
    if (ts.isCallExpression(child) && ts.isIdentifier(child.expression))
      names.add(child.expression.text)
    ts.forEachChild(child, visit)
  }
  visit(node)
  return names
}

export function pageInsertingExports(files: SourceFile[]): string[] {
  const found: string[] = []
  for (const file of files) {
    const source = parse(file)
    const { tables } = bindingsOf(source)
    const functions = new Map<string, { node: ts.Node; exported: boolean }>()
    for (const statement of source.statements) {
      const exported =
        ts.canHaveModifiers(statement) &&
        (ts.getModifiers(statement) ?? []).some(
          (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
        )
      if (ts.isFunctionDeclaration(statement) && statement.name)
        functions.set(statement.name.text, { node: statement, exported })
      if (ts.isVariableStatement(statement))
        for (const declaration of statement.declarationList.declarations)
          if (ts.isIdentifier(declaration.name) && declaration.initializer)
            functions.set(declaration.name.text, {
              node: declaration.initializer,
              exported,
            })
    }
    const inserting = new Set(
      [...functions]
        .filter(([, entry]) => insertsPageTable(entry.node, tables))
        .map(([name]) => name)
    )
    for (let grown = true; grown;) {
      grown = false
      for (const [name, entry] of functions)
        if (
          !inserting.has(name) &&
          [...calls(entry.node)].some((callee) => inserting.has(callee))
        ) {
          inserting.add(name)
          grown = true
        }
    }
    for (const [name, entry] of functions)
      if (entry.exported && inserting.has(name))
        found.push(`${file.path}#${name}`)
  }
  return found.sort()
}

const API_SRC = "apps/api/src/"

export function pageWriteMayLiveIn(relative: string) {
  return (
    PAGE_STORE_FILES.includes(relative) ||
    relative.startsWith("db/") ||
    relative.startsWith("test/") ||
    relative.endsWith(".test.ts") ||
    relative.endsWith(".type-test.ts") ||
    /^registry\/coverage-/.test(relative) ||
    relative === "paper/photo-lifetime.support.ts"
  )
}

export function detect(text: string, file: string): string[] {
  const relative = file.startsWith(API_SRC) ? file.slice(API_SRC.length) : file
  if (pageWriteMayLiveIn(relative)) return []
  const found = pageTableMisuses({ path: relative, text })
  const valueUses = found.filter((line) => line.endsWith("outside a read"))
  if (
    valueUses.length !== 0 &&
    valueUses.length === PAGE_TABLE_VALUE_USES[relative]
  )
    return found.filter((line) => !line.endsWith("outside a read"))
  return found
}
