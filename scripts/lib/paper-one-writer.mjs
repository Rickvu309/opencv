import ts from "typescript"

export const LOG_PACK = "apps/api/src/paper/log/"
export const SNAPSHOT_COLUMNS = [
  "engine",
  "headVersion",
  "snapshot",
  "snapshotVersion",
  "firstPage",
]

const changesSql =
  /\b(insert\s+into|update|delete\s+from)\s+("?opencv_app"?\s*\.\s*)?"?paper_changes\b/i
const snapshotSql =
  /\bupdate\s+("?opencv_app"?\s*\.\s*)?"?paper_docs"?\s+set\b[\s\S]*?\b(engine|head_version|snapshot|snapshot_version|first_page)\b\s*=/i

function walk(node, visit) {
  visit(node)
  ts.forEachChild(node, (child) => walk(child, visit))
}

function method(node) {
  return ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression)
    ? node.expression.name.text
    : null
}

function writesTable(node, table) {
  return (
    ["insert", "update", "delete"].includes(method(node)) &&
    node.arguments.some((arg) => ts.isIdentifier(arg) && arg.text === table)
  )
}

function chainWrites(node, table) {
  let current = node.expression.expression
  while (current) {
    if (writesTable(current, table)) return true
    if (ts.isCallExpression(current) || ts.isPropertyAccessExpression(current))
      current = current.expression
    else return false
  }
  return false
}

function namesSnapshotColumn(arg) {
  const objects = ts.isArrayLiteralExpression(arg) ? arg.elements : [arg]
  return objects.some(
    (object) =>
      ts.isObjectLiteralExpression(object) &&
      object.properties.some(
        (property) =>
          property.name &&
          SNAPSHOT_COLUMNS.includes(
            property.name.getText().replaceAll(/["']/g, "")
          )
      )
  )
}

export function detect(text, file = "source.ts") {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const problems = []
  const report = (kind, node) =>
    problems.push({
      kind,
      line:
        source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
    })
  walk(source, (node) => {
    if (writesTable(node, "paperChanges")) report("paper-changes-write", node)
    if (
      ["set", "values"].includes(method(node)) &&
      node.arguments.some(namesSnapshotColumn) &&
      chainWrites(node, "paperDocs")
    )
      report("paper-snapshot-write", node)
    if (ts.isStringLiteralLike(node) || ts.isTemplateExpression(node)) {
      const raw = node.getText(source)
      if (changesSql.test(raw)) report("paper-changes-sql", node)
      if (snapshotSql.test(raw)) report("paper-snapshot-sql", node)
    }
  })
  return problems
}

export function scanned(file) {
  return (
    /^(apps|packages)\/.*\.(ts|tsx|mts|mjs|js)$/.test(file) &&
    !/\.test(-support)?\.(ts|tsx|mts|mjs|js)$/.test(file) &&
    !/\.test\.(ts|tsx|mjs)$/.test(file) &&
    !file.includes("/node_modules/") &&
    !file.startsWith(LOG_PACK)
  )
}
