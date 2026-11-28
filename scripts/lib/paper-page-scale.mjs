import ts from "typescript"

const message =
  "The Paper page is the same page on every screen; scale the page with pageScale in painter.ts instead"
const sheet = /\.paper-(?:editor(?:-page|-stage)?|run)(?![\w-])/
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
      if (/^@media\s+print\b/.test(selector)) {
        start = end
        continue
      }
      const active = responsive || /^@(?:media|container)\b/.test(selector)
      const paper = inSheet || sheet.test(selector)
      if (
        paper &&
        content
          .split(";")
          .some(
            (declaration) =>
              geometry.test(declaration.split(":")[0].trim()) &&
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

const pictureFile =
  /^apps\/web\/src\/features\/paper\/(?:design\/)?paper-(?:library|picture|template|word-preview)[\w.-]*\.(?:css|tsx?)$/
const pictureRatioSource =
  "apps/web/src/features/paper/design/paper-picture.css"
const pictureRatio = "var(--cv-paper-picture-ratio)"
const pictureRatioError = "Use the shared A4 ratio from paper-picture.css"

function hasPictureRatioMistake(text, path) {
  if (!pictureFile.test(path)) return false
  if (path !== pictureRatioSource && /--cv-paper-picture-ratio\s*:/.test(text))
    return true
  if (
    /(?:^|[:"'`\s])(?:aspect-(?!auto\b|ratio\b)(?:\w|\[)|\[aspect-ratio:)/m.test(
      text
    )
  )
    return true
  if (/\*\s*[\d.]+\s*\/\s*[\d.]+/.test(text)) return true
  if (/\b[\d.]+cq[wh]\s*\*\s*[\d.]+/.test(text)) return true
  return [...text.matchAll(/\baspect(?:-ratio|Ratio)\s*:\s*([^;\n,}]+)/g)].some(
    ([, value]) => value.trim().replace(/^["']|["']$/g, "") !== pictureRatio
  )
}

const editorFile = /^apps\/web\/src\/features\/paper\/editor\/(?!chrome\/)/
const fitFile =
  /^apps\/web\/src\/features\/paper\/editor\/(?:paper-editor|painter)\.ts$/

export function detect(text, path = "") {
  if (
    !/^(?:apps\/web\/src\/features\/paper|packages\/paper-engine\/src)\//.test(
      path
    )
  )
    return []
  if (/\.(?:test|browser)\./.test(path)) return []
  if (hasPictureRatioMistake(text, path)) return [pictureRatioError]
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
  const comparison = (node) =>
    ts.isBinaryExpression(node) &&
    [
      ts.SyntaxKind.LessThanToken,
      ts.SyntaxKind.GreaterThanToken,
      ts.SyntaxKind.LessThanEqualsToken,
      ts.SyntaxKind.GreaterThanEqualsToken,
    ].includes(node.operatorToken.kind)
  const visit = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      widthDependent(node.initializer)
    ) {
      widths.add(node.name.text)
      if (comparison(node.initializer) && fitFile.test(path)) return true
    }
    if (
      editorFile.test(path) &&
      (ts.isIfStatement(node) || ts.isConditionalExpression(node)) &&
      widthDependent(node.expression ?? node.condition) &&
      /(?:style|dataset|setAttribute|setProperty|classList)/.test(
        node.getText(source)
      )
    )
      return true
    if (
      editorFile.test(path) &&
      ts.isCallExpression(node) &&
      /(?:^|\.)layout$/.test(node.expression.getText(source)) &&
      node.arguments.some((arg) => widthDependent(arg))
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
