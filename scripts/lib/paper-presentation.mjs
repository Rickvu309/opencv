import { posix } from "node:path"
import ts from "typescript"

export function detect(text, path) {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true)
  const hits = []
  const test = /\.test\.[cm]?[jt]sx?$/.test(path)
  if (
    path === "apps/api/src/paper/native-output/formatted-photos.ts" &&
    text.includes("<wp:extent") &&
    (!text.includes("photoBounds(photo)") ||
      /<wp:extent[^>]*\$\{(?:width|height)\}/.test(text))
  )
    hits.push(
      "Word photo frames must reserve rotated bounds and retain editable picture dimensions"
    )
  if (
    path === "packages/paper-crdt/src/native-layout-schema.ts" &&
    text.includes("photoBlockSpec") &&
    (!text.includes("paperWrapSlot") ||
      !text.includes("display:block") ||
      !text.includes(".bn-block > ${text}"))
  )
    hits.push(
      "Wrapped photo text must share the surrounding inline formatting context"
    )

  const presentation =
    /\/(?:paper-presentation|presentation(?:[-.][^/]+)?|native-(?:formatting|layout|photo)(?:[-.][^/]+)?)\.ts$/.test(
      path
    )
  const privateCrdt =
    /^packages\/paper-crdt\/src\/(?:presentation-(?:binding|meta|inline|codec|reverse)|native-(?:formatting|layout|photo)(?:-[^/]+)?)\.ts$/.test(
      path
    )
  const packageRoot = path.split("/").slice(0, 2).join("/")
  const sanitizedHtml = new Set()
  const purifierImported = source.statements.some(
    (node) =>
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text === "dompurify" &&
      node.importClause?.name?.text === "DOMPurify"
  )
  function collectSanitizedHtml(node) {
    if (
      purifierImported &&
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      node.initializer.expression.getText(source) === "DOMPurify.sanitize"
    )
      sanitizedHtml.add(node.name.text)
    ts.forEachChild(node, collectSanitizedHtml)
  }
  if (path === "packages/paper-crdt/src/native-layout-paste.ts")
    collectSanitizedHtml(source)
  function property(node, name) {
    if (!node || !ts.isObjectLiteralExpression(node)) return undefined
    return node.properties.find(
      (item) =>
        ts.isPropertyAssignment(item) &&
        (ts.isIdentifier(item.name) || ts.isStringLiteral(item.name)) &&
        item.name.text === name
    )?.initializer
  }
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
      /(?:^|\/)(?:presentation-(?:binding|meta|inline|codec|reverse)|native-(?:formatting|layout|photo)(?:-[^/]+)?)(?:\.[cm]?[jt]s)?$/.test(
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
      if (
        path === "packages/paper-crdt/src/native-layout-mount.ts" &&
        ts.isIfStatement(node) &&
        /event\.key\s*===\s*["']Tab["']/.test(node.expression.getText(source))
      ) {
        const body = node.thenStatement.getText(source)
        const cancel = body.indexOf("event.preventDefault()")
        const exit = body.search(/if\s*\(!target\)\s*return/)
        if (cancel >= 0 && (exit < 0 || exit > cancel))
          hits.push(
            "Table Tab must leave native focus traversal available without a text target"
          )
      }
      if (
        path === "packages/paper-crdt/src/native-formatting-styles.ts" &&
        ts.isMethodDeclaration(node) &&
        node.name.getText(source) === "parse" &&
        !node.body?.getText(source).includes("tagName")
      )
        hits.push(
          "Rich HTML marks must parse standard elements as well as private spans"
        )
      if (ts.isCallExpression(node)) {
        if (
          path === "packages/paper-crdt/src/native-layout-paste.ts" &&
          ts.isPropertyAccessExpression(node.expression) &&
          ["parseFromString", "tryParseHTMLToBlocks"].includes(
            node.expression.name.text
          ) &&
          (!node.arguments[0] ||
            !ts.isIdentifier(node.arguments[0]) ||
            !sanitizedHtml.has(node.arguments[0].text))
        )
          hits.push(
            "Clipboard HTML must be sanitized before DOM or editor parsing"
          )
        if (
          path === "packages/paper-crdt/src/native-formatting-schema.ts" &&
          ts.isIdentifier(node.expression) &&
          node.expression.text === "createBlockSpec"
        ) {
          const type = property(node.arguments[0], "type")
          if (
            type &&
            ts.isStringLiteral(type) &&
            [
              "paragraph",
              "heading",
              "bulletListItem",
              "numberedListItem",
            ].includes(type.text) &&
            !property(node.arguments[1], "parse")
          )
            hits.push(
              "Rich HTML body blocks must declare standard element parsing"
            )
          if (
            type &&
            ts.isStringLiteral(type) &&
            ["bulletListItem", "numberedListItem"].includes(type.text) &&
            (!property(node.arguments[1], "parseContent") ||
              !node.arguments[1]?.getText(source).includes("closest"))
          )
            hits.push(
              "Rich list parsing must retain nested content and recognize normalized wrappers"
            )
        }
        if (
          /^packages\/paper-crdt\/src\/native-(?:formatting|layout|photo)-mount\.ts$/.test(
            path
          ) &&
          ts.isPropertyAccessExpression(node.expression) &&
          node.expression.getText(source) === "BlockNoteEditor.create"
        ) {
          const style = property(
            property(property(node.arguments[0], "links"), "HTMLAttributes"),
            "style"
          )
          if (
            !style ||
            !ts.isStringLiteral(style) ||
            !/(?:^|;)\s*text-decoration(?:-line)?\s*:\s*none\s*(?:;|$)/.test(
              style.text
            )
          )
            hits.push(
              "Mounted formatting links must leave underline painting to resolved text"
            )
        }
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
