import ts from "typescript"

export function detect(text) {
  const source = ts.createSourceFile(
    "photo.ts",
    text,
    ts.ScriptTarget.Latest,
    true
  )
  const elements = new Map()
  const hits = []
  const visit = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      node.initializer.expression.getText(source) === "document.createElement"
    ) {
      const tag = node.initializer.arguments[0]
      if (tag && ts.isStringLiteral(tag))
        elements.set(node.name.text, { tag: tag.text, styles: new Map() })
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(node.left) &&
      ts.isPropertyAccessExpression(node.left.expression) &&
      node.left.expression.name.text === "style" &&
      ts.isIdentifier(node.left.expression.expression)
    ) {
      const element = elements.get(node.left.expression.expression.text)
      element?.styles.set(
        node.left.name.text,
        ts.isStringLiteral(node.right)
          ? node.right.text
          : node.right.getText(source)
      )
    }
    if (
      ts.isPropertyAssignment(node) &&
      node.name.getText(source) === "style"
    ) {
      const style = node.initializer.getText(source)
      if (
        style.includes("display:block;") &&
        style.includes("pt;") &&
        !style.includes("max-width:100%")
      )
        hits.push("photo block width must be bounded by its column")
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  for (const { tag, styles } of elements.values()) {
    if (tag === "figure" && styles.has("width")) {
      if (styles.get("maxWidth") !== "100%")
        hits.push("photo figure width must be bounded by its column")
      if (styles.get("height") !== "auto" || !styles.has("aspectRatio"))
        hits.push("photo height must follow the bounded width and aspect ratio")
    }
    if (tag === "div" && styles.get("position") === "absolute")
      for (const property of ["width", "height", "left", "top"])
        if (styles.has(property) && !styles.get(property).includes("%"))
          hits.push(
            `photo frame ${property} must scale with the bounded figure`
          )
  }
  return hits
}
