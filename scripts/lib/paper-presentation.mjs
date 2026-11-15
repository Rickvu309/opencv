import { posix } from "node:path"
import ts from "typescript"

export function detect(text, path) {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true)
  const hits = []
  const test = /\.test\.[cm]?[jt]sx?$/.test(path)
  const presentation =
    /\/(?:paper-presentation|presentation(?:[-.][^/]+)?|native-formatting(?:[-.][^/]+)?)\.ts$/.test(
      path
    )
  const privateCrdt =
    /^packages\/paper-crdt\/src\/(?:presentation-(?:binding|meta|inline|codec|reverse)|native-formatting(?:-[^/]+)?)\.ts$/.test(
      path
    )
  const packageRoot = path.split("/").slice(0, 2).join("/")
  function checkImport(specifier) {
    if (presentation && specifier.startsWith(".")) {
      const target = posix.normalize(posix.join(posix.dirname(path), specifier))
      if (
        /^packages\/[^/]+\/src\//.test(target) &&
        target.split("/").slice(0, 2).join("/") !== packageRoot
      )
        hits.push(
          "Presentation must use a package subpath instead of another package's source"
        )
    }
    if (test) return
    const target = specifier.startsWith(".")
      ? posix.normalize(posix.join(posix.dirname(path), specifier))
      : specifier
    if (
      /(?:^|\/)native-output\/formatted(?:-[^/]+)?(?:\.[cm]?[jt]s)?$/.test(
        target
      ) &&
      !path.startsWith("apps/api/src/paper/native-output/")
    )
      hits.push(
        "Formatted Word output stays private until the full native flow is qualified"
      )
    if (specifier.includes("presentation-fixtures"))
      hits.push("Production fixture binding has been removed")
    if (
      !privateCrdt &&
      /(?:^|\/)(?:presentation-(?:binding|meta|inline|codec|reverse)|native-formatting(?:-[^/]+)?)(?:\.[cm]?[jt]s)?$/.test(
        specifier
      ) &&
      !path.startsWith("packages/domain/")
    )
      hits.push("Private formatting cannot be registered or exported publicly")
  }
  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    )
      checkImport(node.moduleSpecifier.text)
    if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal)
    )
      checkImport(node.argument.literal.text)
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    )
      checkImport(node.arguments[0].text)
    if (!test) {
      if (
        ts.isIdentifier(node) &&
        [
          "bindPresentationFixture",
          "createPresentationFixture",
          "requireFixture",
        ].includes(node.text)
      )
        hits.push("Fixture binding is restricted to local test helpers")
      if (
        ts.isIdentifier(node) &&
        node.text === "ownFormattingBinding" &&
        !privateCrdt
      )
        hits.push("Formatting binding is private")
      if (ts.isCallExpression(node)) {
        if (
          privateCrdt &&
          ts.isIdentifier(node.expression) &&
          node.expression.text === "yXmlFragmentToBlocks" &&
          node.arguments[1] &&
          ts.isPropertyAccessExpression(node.arguments[1]) &&
          node.arguments[1].name.text === "fragment"
        )
          hits.push(
            "Formatting reads must convert detached XML without changing live anchors"
          )
        if (
          path === "packages/paper-crdt/src/presentation-codec.ts" &&
          ts.isIdentifier(node.expression) &&
          [
            "updateYFragment",
            "writePrivateFormatting",
            "writePrivateFormattingBlocks",
            "writePrivateFormattingEngine",
          ].includes(node.expression.text)
        )
          hits.push("Property patches must preserve existing XML text anchors")
        if (presentation && ts.isPropertyAccessExpression(node.expression)) {
          const name = node.expression.name.text
          const first = node.arguments[0]
          if (["getText", "getArray"].includes(name))
            hits.push("Presentation cannot persist another text collection")
          if (
            name === "getXmlFragment" &&
            first &&
            ts.isStringLiteral(first) &&
            !["document-store", "private-native-cv-v4-r2"].includes(first.text)
          )
            hits.push("Formatting must use the existing document fragment")
          if (
            name === "set" &&
            first &&
            ts.isStringLiteral(first) &&
            ["text", "texts", "runs", "richText"].includes(first.text)
          )
            hits.push("Presentation cannot persist a scalar text mirror")
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return hits
}
