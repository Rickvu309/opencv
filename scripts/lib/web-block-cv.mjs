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

function blockCreateNames(source) {
  const initializers = new Map()
  const collect = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer
    ) {
      initializers.set(node.name.text, node.initializer)
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
      const text = literalText(initializer)
      const value = unwrap(initializer)
      if (
        (text !== null && namesBlockCreate(text)) ||
        (value && ts.isIdentifier(value) && names.has(value.text))
      ) {
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
  const startsBlock = (argument) => {
    const text = literalText(argument)
    if (text !== null) return namesBlockCreate(text)
    const value = unwrap(argument)
    return Boolean(value && ts.isIdentifier(value) && aliases.has(value.text))
  }
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
