import ts from "typescript"

const BLOCK_CREATE = "paper.create"

function unwrap(node) {
  let current = node
  while (
    current &&
    (ts.isParenthesizedExpression(current) ||
      ts.isAsExpression(current) ||
      ts.isSatisfiesExpression(current) ||
      ts.isTypeAssertionExpression(current))
  ) {
    current = current.expression
  }
  return current
}

function literalText(node) {
  const value = unwrap(node)
  if (!value) return null
  if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) {
    return value.text
  }
  return null
}

function namesBlockCreate(text) {
  return text === BLOCK_CREATE || text.endsWith(`/commands/${BLOCK_CREATE}`)
}

function templateTail(node) {
  const value = unwrap(node)
  if (!value || !ts.isTemplateExpression(value)) return null
  return value.templateSpans.at(-1).literal.text
}

function namesBlockCreateValue(node, names) {
  const text = literalText(node)
  if (text !== null) return namesBlockCreate(text)
  const tail = templateTail(node)
  if (tail !== null) return tail.endsWith(`/commands/${BLOCK_CREATE}`)
  const value = unwrap(node)
  if (!value) return false
  if (ts.isIdentifier(value)) return names.has(value.text)
  const member = memberKey(value)
  return member !== null && names.has(member)
}

function memberKey(node) {
  if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression))
    return `${node.expression.text}.${node.name.text}`
  if (
    ts.isElementAccessExpression(node) &&
    ts.isIdentifier(node.expression) &&
    literalText(node.argumentExpression) !== null
  )
    return `${node.expression.text}.${literalText(node.argumentExpression)}`
  return null
}

function propertyKey(property) {
  if (!property.name) return null
  if (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))
    return property.name.text
  return null
}

function blockCreateNames(source) {
  const initializers = new Map()
  const collect = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer
    ) {
      initializers.set(node.name.text, node.initializer)
      const object = unwrap(node.initializer)
      if (object && ts.isObjectLiteralExpression(object))
        for (const property of object.properties) {
          const key = propertyKey(property)
          if (key !== null && ts.isPropertyAssignment(property))
            initializers.set(`${node.name.text}.${key}`, property.initializer)
        }
    }
    ts.forEachChild(node, collect)
  }
  collect(source)
  const names = new Set()
  let grew = true
  while (grew) {
    grew = false
    for (const [name, initializer] of initializers) {
      if (names.has(name)) continue
      if (namesBlockCreateValue(initializer, names)) {
        names.add(name)
        grew = true
      }
    }
  }
  return names
}

export function detectWebBlockCv(text, path = "source.tsx") {
  const source = ts.createSourceFile(
    path,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )
  const aliases = blockCreateNames(source)
  const startsBlock = (argument) => namesBlockCreateValue(argument, aliases)
  const hits = []
  const visit = (node) => {
    if (ts.isCallExpression(node) && node.arguments.some(startsBlock)) {
      hits.push({
        path,
        line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
        message:
          "The web starts a CV or Letter on the Word writing page with paper.canvas mint, never an older block document through paper.create",
      })
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return hits
}
