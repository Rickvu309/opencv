import ts from "typescript"

const DIALOG_BODIES = new Set(["DialogContent", "AlertDialogContent"])
const PRIMARY_VARIANTS = new Set(["default"])

function tagOf(node) {
  if (ts.isJsxElement(node)) return node.openingElement
  if (ts.isJsxSelfClosingElement(node)) return node
  return null
}

function attribute(tag, name) {
  return tag.attributes.properties.find(
    (prop) => ts.isJsxAttribute(prop) && prop.name.getText() === name
  )
}

function isPrimaryButton(tag) {
  const variant = attribute(tag, "variant")
  if (!variant) return true
  const value = variant.initializer
  return Boolean(
    value && ts.isStringLiteral(value) && PRIMARY_VARIANTS.has(value.text)
  )
}

function bodyParts(body) {
  const parts = { form: false, input: false, primary: false }
  function visit(node) {
    const tag = tagOf(node)
    const name = tag?.tagName.getText()
    if (name === "form") parts.form = true
    if (name === "Input" && !attribute(tag, "onKeyDown")) parts.input = true
    if (name === "Button" && isPrimaryButton(tag)) parts.primary = true
    ts.forEachChild(node, visit)
  }
  ts.forEachChild(body, visit)
  return parts
}

export function detect(text, file = "test.tsx") {
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )
  const problems = []
  function visit(node) {
    const tag = tagOf(node)
    if (tag && DIALOG_BODIES.has(tag.tagName.getText())) {
      const parts = bodyParts(node)
      if (parts.input && parts.primary && !parts.form) {
        const line =
          source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1
        problems.push(
          `${file}:${line}: this dialog has a text field and a primary button but no form, so Enter does nothing. Wrap the field and buttons in a form whose onSubmit runs the primary action and make that button type="submit".`
        )
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return problems
}
