import ts from "typescript"

function analyze(source) {
  const tree = ts.createSourceFile(
    "input.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )
  const bindings = new Map()
  const titles = new Set()
  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer
    )
      bindings.set(node.name.text, node.initializer)
    if (ts.isImportDeclaration(node)) {
      for (const item of node.importClause?.namedBindings?.elements ?? []) {
        if ((item.propertyName ?? item.name).text === "PopoverTitle")
          titles.add(item.name.text)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(tree)
  function value(node, seen = new Set()) {
    if (!node) return []
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node))
      return value(node.expression, seen)
    if (ts.isStringLiteralLike(node) || ts.isJsxText(node)) return [node.text]
    if (ts.isIdentifier(node)) {
      if (seen.has(node.text)) return []
      return bindings.has(node.text)
        ? value(bindings.get(node.text), new Set([...seen, node.text]))
        : [node.text]
    }
    if (ts.isPropertyAccessExpression(node))
      return value(node.expression, seen).map(
        (root) => `${root}.${node.name.text}`
      )
    if (ts.isElementAccessExpression(node))
      return value(node.expression, seen).flatMap((root) =>
        value(node.argumentExpression, seen).map((key) => `${root}.${key}`)
      )
    if (ts.isConditionalExpression(node))
      return [...value(node.whenTrue, seen), ...value(node.whenFalse, seen)]
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.PlusToken
    )
      return value(node.left, seen).flatMap((left) =>
        value(node.right, seen).map((right) => left + right)
      )
    return []
  }
  return { tree, titles, value }
}

export function shippedPlatformOverride(
  source,
  path = "packages/ui/src/lib/platform.ts"
) {
  if (
    !/packages\/ui\/src\/(?:components|hooks|lib)\//.test(path) ||
    /(?:\.test\.|\/test\/)/.test(path)
  )
    return false
  const { tree, value } = analyze(source)
  const methods = new Set([
    "elementFromPoint",
    "elementsFromPoint",
    "showPopover",
    "hidePopover",
    "checkVisibility",
  ])
  const targets = new Set([
    "document",
    "window.document",
    "globalThis.document",
    "Element.prototype",
    "HTMLElement.prototype",
  ])
  const overridden = (target, key) => targets.has(target) && methods.has(key)
  let found = false
  function visit(node) {
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken
    ) {
      for (const target of value(node.left)) {
        const split = target.lastIndexOf(".")
        if (overridden(target.slice(0, split), target.slice(split + 1)))
          found = true
      }
    }
    if (ts.isCallExpression(node)) {
      const calls = value(node.expression)
      if (calls.includes("Object.defineProperty")) {
        for (const target of value(node.arguments[0]))
          for (const key of value(node.arguments[1]))
            if (overridden(target, key)) found = true
      }
      if (
        calls.includes("Object.assign") ||
        calls.includes("Object.defineProperties")
      ) {
        for (const target of value(node.arguments[0])) {
          for (const argument of node.arguments.slice(1)) {
            if (!ts.isObjectLiteralExpression(argument)) continue
            for (const property of argument.properties) {
              const keys =
                property.name && ts.isComputedPropertyName(property.name)
                  ? value(property.name.expression)
                  : [property.name?.text]
              for (const key of keys) if (overridden(target, key)) found = true
            }
          }
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(tree)
  return found
}

export function paperPickerActionTitle(source) {
  const { tree, titles, value } = analyze(source)
  let found = false
  function visit(node) {
    if (
      ts.isJsxElement(node) &&
      titles.has(node.openingElement.tagName.getText(tree))
    ) {
      for (const child of node.children) {
        const texts = value(
          ts.isJsxExpression(child) ? child.expression : child
        )
        if (
          texts.some((text) => /^\s*Add\s+(?:CV|cover letter)\s*$/i.test(text))
        )
          found = true
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(tree)
  return found
}
