import ts from "typescript"

export function detectStorageExports(node, source) {
  const hits = []
  if (
    ts.isFunctionDeclaration(node) &&
    node.name?.text === "writeStoredYDoc" &&
    node.type?.getText(source) !== "Uint8Array"
  )
    hits.push("Rich storage writes expose only update bytes")
  if (
    node.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
    ) &&
    !(
      ts.isFunctionDeclaration(node) &&
      node.name &&
      ["seedStoredYDoc", "materializeStored", "writeStoredYDoc"].includes(
        node.name.text
      )
    ) &&
    !(
      ts.isTypeAliasDeclaration(node) &&
      node.name.text === "StoredDocumentResult"
    )
  )
    hits.push("Rich storage exposes only validated bytes and document values")
  return hits
}
