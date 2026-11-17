import ts from "typescript"

const message =
  "The Paper page is the same page on every screen; scale the page in rich-page-layout.ts instead"
const sheet =
  /\.(?:paper-rich-sheet|writing-page)\b|\[data-paper-(?:layout|wrap-slot|page-flow)/
const geometry =
  /^(?:inline-size|block-size|min-(?:inline|block)-size|max-(?:inline|block)-size|width|height|min-width|max-width|min-height|max-height|padding(?:-[\w-]+)?|columns|column-[\w-]+|font(?:-[\w-]+)?|line-height|zoom|transform)$/

function cssMistake(text, physical) {
  const visit = (body, responsive = false, inSheet = false) => {
    let start = 0
    while (start < body.length) {
      const open = body.indexOf("{", start)
      if (open < 0) break
      let end = open + 1,
        depth = 1
      while (end < body.length && depth) {
        if (body[end] === "{") depth++
        if (body[end] === "}") depth--
        end++
      }
      const selector = body.slice(start, open).trim()
      const content = body.slice(open + 1, end - 1)
      const active = responsive || /^@(?:media|container)\b/.test(selector)
      const paper = inSheet || sheet.test(selector)
      if (
        (paper || /\.writing-scroll\b/.test(selector)) &&
        content
          .split(";")
          .some(
            (declaration) =>
              (paper
                ? geometry.test(declaration.split(":")[0].trim())
                : declaration.split(":")[0].trim() ===
                  "grid-template-columns") &&
              (active ||
                (physical &&
                  /%|\bclamp\(|[\d.](?:d?vw|cqw)\b/.test(
                    declaration.split(":").slice(1).join(":")
                  )))
          )
      )
        return true
      if (visit(content, active, paper)) return true
      start = end
    }
    return false
  }
  return visit(text)
}

export function detect(text, path = "") {
  if (
    !/^(?:apps\/web\/src\/(?:features\/paper(?:-page)?|styles)|packages\/(?:paper-crdt\/src|domain\/src))\//.test(
      path
    )
  )
    return []
  if (/\.(?:test|browser)\./.test(path)) return []
  if (/data-paper-reflow|dataset\.paperReflow/.test(text)) return [message]
  if (cssMistake(text, /\.css$/.test(path))) return [message]
  if (!/\.[cm]?[jt]sx?$/.test(path)) return []
  const source = ts.createSourceFile(
    path,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )
  const eagerCanvas =
    path === "apps/web/src/features/paper-page/canvas-viewport.ts"
  const sharedViewport = path === "packages/domain/src/paper-page-scale.ts"
  const importsEditor = (node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      !node.isTypeOnly &&
      !(ts.isImportDeclaration(node) && node.importClause?.isTypeOnly) &&
      node.moduleSpecifier &&
      (sharedViewport ||
        (eagerCanvas &&
          /^@workspace\/paper-crdt(?:\/|$)/.test(node.moduleSpecifier.text)))
    )
      return true
    if (
      sharedViewport &&
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        node.expression.getText(source) === "require")
    )
      return true
    return ts.forEachChild(node, importsEditor) ?? false
  }
  if (importsEditor(source))
    return [
      "Shared Paper viewport geometry must stay independent of the lazy letter editor",
    ]
  const widths = new Set(["available", "width", "pageWidth", "innerWidth"])
  const widthDependent = (node) => {
    if (ts.isIdentifier(node) && widths.has(node.text)) return true
    if (
      ts.isPropertyAccessExpression(node) &&
      /^(?:clientWidth|offsetWidth|innerWidth|width)$/.test(node.name.text)
    )
      return true
    let found = false
    ts.forEachChild(node, (child) => {
      if (widthDependent(child)) found = true
    })
    return found
  }
  const visit = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      widthDependent(node.initializer)
    ) {
      widths.add(node.name.text)
      if (
        ts.isBinaryExpression(node.initializer) &&
        [
          ts.SyntaxKind.LessThanToken,
          ts.SyntaxKind.GreaterThanToken,
          ts.SyntaxKind.LessThanEqualsToken,
          ts.SyntaxKind.GreaterThanEqualsToken,
        ].includes(node.initializer.operatorToken.kind) &&
        /(?:rich-page-layout|native-layout-flow-view)\.ts$/.test(path)
      )
        return true
    }
    if (
      /(?:rich-page|native-layout-flow|features\/paper-page\/)/.test(path) &&
      (ts.isIfStatement(node) || ts.isConditionalExpression(node)) &&
      widthDependent(node.expression ?? node.condition) &&
      /(?:style|dataset|setAttribute|setProperty|classList)/.test(
        node.getText(source)
      )
    )
      return true
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      /dataset\.paper/.test(node.left.getText(source)) &&
      widthDependent(node.right)
    )
      return true
    if (
      ts.isCallExpression(node) &&
      /setAttribute$/.test(node.expression.getText(source)) &&
      node.arguments.some((arg) => widthDependent(arg)) &&
      /data-paper/.test(node.arguments[0]?.getText(source) ?? "")
    )
      return true
    let found = false
    ts.forEachChild(node, (child) => {
      if (visit(child)) found = true
    })
    return found
  }
  return visit(source) ? [message] : []
}
