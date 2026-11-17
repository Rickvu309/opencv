import ts from "typescript"

const VARIANTS_CALL = /Variants$/

function calleeName(call) {
  return ts.isIdentifier(call.expression) ? call.expression.text : null
}

function passesClassName(call) {
  return call.arguments.some(
    (arg) =>
      ts.isObjectLiteralExpression(arg) &&
      arg.properties.some(
        (prop) =>
          (ts.isPropertyAssignment(prop) ||
            ts.isShorthandPropertyAssignment(prop)) &&
          ts.isIdentifier(prop.name) &&
          (prop.name.text === "className" || prop.name.text === "class")
      )
  )
}

function mergedByCn(call) {
  const parent = call.parent
  return (
    parent !== undefined &&
    ts.isCallExpression(parent) &&
    ts.isIdentifier(parent.expression) &&
    parent.expression.text === "cn"
  )
}

export function unmergedVariantClasses(source, file) {
  const tree = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  )
  const problems = []
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const name = calleeName(node)
      if (
        name &&
        VARIANTS_CALL.test(name) &&
        passesClassName(node) &&
        !mergedByCn(node)
      ) {
        const { line } = tree.getLineAndCharacterOfPosition(node.getStart())
        problems.push(
          `${file}:${line + 1}: ${name}() gets className without cn, so its classes concatenate and the stylesheet order picks the winner; use cn(${name}({ ... }), "...")`
        )
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(tree)
  return problems
}
