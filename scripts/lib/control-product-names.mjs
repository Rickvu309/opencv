import ts from "typescript"

export const PRODUCT_OWNERS = [
  "account",
  "billing",
  "chat",
  "coach",
  "connections",
  "file",
  "inbox",
  "integrations",
  "job",
  "link",
  "notify",
  "paper",
  "profile",
  "workspace",
]

const PRODUCT_NAME = new RegExp(`^(${PRODUCT_OWNERS.join("|")})\\.[a-zA-Z]*$`)

export function detectProductNames(text, file = "control.ts") {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const hits = []
  const visit = (node) => {
    if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
      PRODUCT_NAME.test(node.text) &&
      !ts.isImportDeclaration(node.parent) &&
      !ts.isExportDeclaration(node.parent)
    ) {
      const { line } = source.getLineAndCharacterOfPosition(node.getStart())
      hits.push(
        `${file}:${line + 1} names the product command "${node.text}". Put what varies by command on its operation definition and read that field.`
      )
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return hits
}
