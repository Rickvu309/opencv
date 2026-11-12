import ts from "typescript"

export function detect(text, file = "source.ts") {
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )
  const aliases = new Set(["wordConfirmedOpsSchema"])
  const visitAliases = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      [...aliases].some((name) =>
        node.initializer.getText(source).startsWith(`${name}.element`)
      )
    )
      aliases.add(node.name.text)
    ts.forEachChild(node, visitAliases)
  }
  visitAliases(source)
  const problems = []
  const visit = (node) => {
    if (ts.isFunctionLike(node) && node.body) {
      const body = node.body.getText(source)
      const name =
        node.name?.getText(source) ??
        (ts.isVariableDeclaration(node.parent)
          ? node.parent.name.getText(source)
          : "")
      const predicate =
        node.type &&
        (ts.isTypePredicateNode(node.type) ||
          node.type.kind === ts.SyntaxKind.BooleanKeyword)
      const wordDecision =
        /^(?:isWord|wordEdits)/i.test(name) ||
        predicate ||
        /\.every\(|\.some\(/.test(body)
      const opTest = /\.op\s*===?\s*["'](?:setText|insert|delete)["']/.test(
        body
      )
      const schema = [...aliases].some(
        (alias) =>
          body.includes(`${alias}.safeParse(`) ||
          body.includes(`${alias}.parse(`)
      )
      const helper = /\.every\(isWordEdit\)/.test(body)
      if (
        (/^isWord/i.test(name) || (wordDecision && opTest)) &&
        !schema &&
        !helper
      )
        problems.push({
          kind: "word-classification-without-schema",
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
