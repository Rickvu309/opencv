import ts from "typescript"

function walk(node, visit) {
  visit(node)
  ts.forEachChild(node, (child) => walk(child, visit))
}
function name(node) {
  return node && (ts.isIdentifier(node) || ts.isStringLiteral(node))
    ? node.text
    : ""
}
function property(node, key) {
  return ts.isObjectLiteralExpression(node)
    ? node.properties.find(
        (entry) => ts.isPropertyAssignment(entry) && name(entry.name) === key
      )?.initializer
    : undefined
}

export function detect(text, file = "source.ts") {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const problems = []
  const add = (node, kind) =>
    problems.push({
      kind,
      line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
    })
  walk(source, (node) => {
    if (ts.isPropertyAssignment(node) && name(node.name) === "paperCvField") {
      let config
      walk(node.initializer, (child) => {
        if (
          ts.isCallExpression(child) &&
          name(child.expression) === "createBlockSpec"
        )
          config = child.arguments[0]
      })
      const content = config && property(config, "content")
      const props = config && property(config, "propSchema")
      const keys =
        props && ts.isObjectLiteralExpression(props)
          ? props.properties.map((entry) => name(entry.name))
          : []
      if (
        !content ||
        !ts.isStringLiteral(content) ||
        content.text !== "inline" ||
        keys.slice().sort().join(",") !== "fieldKey,itemId,ownerId"
      )
        add(node, "cv-field-inline-identity-only")
    }
    if (!ts.isFunctionDeclaration(node) || !node.body) return
    if (
      ["writeNativeCvDocument", "writeNativeCvBlocks"].includes(name(node.name))
    ) {
      const first = node.body.statements[0]
      const declaration =
        first &&
        ts.isVariableStatement(first) &&
        first.declarationList.declarations[0]
      const call = declaration && declaration.initializer
      if (
        !call ||
        !ts.isCallExpression(call) ||
        name(call.expression) !== "admit"
      )
        add(node, "cv-detached-admission-first")
      if (
        name(node.name) === "writeNativeCvBlocks" &&
        call &&
        ts.isCallExpression(call)
      ) {
        const argument = call.arguments[0]
        if (
          !argument ||
          !ts.isCallExpression(argument) ||
          name(argument.expression) !== "fromNativeCvBlocks"
        )
          add(node, "cv-ordinary-strict-first")
      }
    }
    if (name(node.name) === "read") {
      const calls = []
      walk(node.body, (child) => {
        if (ts.isCallExpression(child))
          calls.push({ name: name(child.expression), position: child.pos })
      })
      const convert = calls.find((call) => call.name === "yXmlFragmentToBlocks")
      const validate = calls.find(
        (call) => call.name === "validateNativeCvWire"
      )
      if (convert && (!validate || validate.position > convert.position))
        add(node, "cv-wire-before-normalization")
    }
  })
  return problems
}
