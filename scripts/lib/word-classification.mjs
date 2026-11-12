import ts from "typescript"

const WORD_OPS = new Set(["setText", "insert", "delete"])
const WORD_SCHEMAS = new Set(["wordConfirmedOpsSchema", "wordBatchSchema"])
const WORD_HELPER = "isWordEdit"
const WORD_CLASSIFIER_NAME = /^isWord(?:Edit|Op|Operation|Batch)s?$/i

function schemaAliases(source) {
  const aliases = new Set(WORD_SCHEMAS)
  const visit = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer
    ) {
      const root = node.initializer.getText(source).split(".")[0]
      if (aliases.has(root)) aliases.add(node.name.text)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return aliases
}

function functionName(node, source) {
  if (node.name) return node.name.getText(source)
  if (ts.isVariableDeclaration(node.parent))
    return node.parent.name.getText(source)
  return ""
}

function rawParams(node, source) {
  return node.parameters
    .filter(
      (param) =>
        ts.isIdentifier(param.name) &&
        (!param.type ||
          /^(?:unknown|any)(?:\[\])?$/.test(param.type.getText(source)))
    )
    .map((param) => param.name.text)
}

function comparesParamOp(node, params) {
  let found = false
  const visit = (child) => {
    if (
      ts.isBinaryExpression(child) &&
      [
        ts.SyntaxKind.EqualsEqualsEqualsToken,
        ts.SyntaxKind.EqualsEqualsToken,
        ts.SyntaxKind.ExclamationEqualsEqualsToken,
        ts.SyntaxKind.ExclamationEqualsToken,
      ].includes(child.operatorToken.kind)
    ) {
      const sides = [child.left, child.right]
      const access = sides.find(
        (side) =>
          ts.isPropertyAccessExpression(side) &&
          side.name.text === "op" &&
          ts.isIdentifier(side.expression) &&
          params.includes(side.expression.text)
      )
      const literal = sides.find(
        (side) => ts.isStringLiteral(side) && WORD_OPS.has(side.text)
      )
      if (access && literal) found = true
    }
    if (!found) ts.forEachChild(child, visit)
  }
  visit(node.body)
  return found
}

function returnsBoolean(node) {
  return (
    !!node.type &&
    (ts.isTypePredicateNode(node.type) ||
      node.type.kind === ts.SyntaxKind.BooleanKeyword)
  )
}

function passedToEveryOrSome(node) {
  const call = node.parent
  return (
    ts.isCallExpression(call) &&
    call.arguments.includes(node) &&
    ts.isPropertyAccessExpression(call.expression) &&
    ["every", "some"].includes(call.expression.name.text)
  )
}

function usesSchema(node, source, aliases) {
  const body = node.body.getText(source)
  return (
    [...aliases].some((alias) =>
      new RegExp(`\\b${alias}(?:\\.element)?\\.(?:safeParse|parse)\\(`).test(
        body
      )
    ) || new RegExp(`\\b${WORD_HELPER}\\b`).test(body)
  )
}

export function detect(text, file = "source.ts") {
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )
  const aliases = schemaAliases(source)
  const problems = []
  const visit = (node) => {
    if (ts.isFunctionLike(node) && node.body) {
      const params = rawParams(node, source)
      const classifies =
        params.length > 0 &&
        (WORD_CLASSIFIER_NAME.test(functionName(node, source)) ||
          ((returnsBoolean(node) || passedToEveryOrSome(node)) &&
            comparesParamOp(node, params)))
      if (classifies && !usesSchema(node, source, aliases))
        problems.push({
          kind: "word-classification-without-schema",
          file,
          line:
            source.getLineAndCharacterOfPosition(node.getStart(source)).line +
            1,
        })
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return problems
}
