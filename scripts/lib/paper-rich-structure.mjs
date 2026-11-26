import ts from "typescript"

function unsafeRepetition(literal) {
  const body = literal.slice(1, literal.lastIndexOf("/"))
  let inClass = false
  let repetitions = 0
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index]
    if (char === "\\") {
      index += 1
      continue
    }
    if (char === "[") inClass = true
    if (char === "]") inClass = false
    if (inClass) continue
    if (body[index - 1] === ")" && "+*?{".includes(char)) return true
    const brace = char === "{" ? body.slice(index).match(/^\{\d+,\}/) : null
    if (char !== "+" && char !== "*" && !brace) continue
    repetitions += 1
    if (body[index - 1] === ")" || repetitions > 1) return true
    if (brace) index += brace[0].length - 1
  }
  return false
}

export function detect(text) {
  const source = ts.createSourceFile(
    "rich-text.ts",
    text,
    ts.ScriptTarget.Latest,
    true
  )
  const hits = []
  const visit = (node) => {
    if (
      ts.isRegularExpressionLiteral(node) &&
      unsafeRepetition(node.getText(source))
    )
      hits.push(
        "Link patterns must use one repeated character class per regex; split address parts before validating"
      )
    ts.forEachChild(node, visit)
  }
  for (const statement of source.statements) {
    const names = ts.isFunctionDeclaration(statement)
      ? (statement.name?.text ?? "")
      : ts.isVariableStatement(statement)
        ? statement.declarationList.declarations
            .map((item) => item.name.getText(source))
            .join(" ")
        : ""
    if (/href|link|email|domain/i.test(names)) visit(statement)
  }
  return hits
}

export function detectDirectMarks(text) {
  const source = ts.createSourceFile(
    "rich-text.ts",
    text,
    ts.ScriptTarget.Latest,
    true
  )
  const hits = []
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ["replace", "replaceAll"].includes(node.expression.name.text)
    ) {
      const [pattern, replacement] = node.arguments
      if (
        pattern &&
        replacement &&
        ts.isStringLiteral(replacement) &&
        replacement.text === "" &&
        ts.isRegularExpressionLiteral(pattern) &&
        /<w:(?:u|b|i|strike|color|rStyle)(?:\\b|[\s/>])/.test(
          pattern.getText(source)
        )
      )
        hits.push(
          "Word link styling must preserve direct marks, color and named character styles"
        )
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return hits
}

export const consumers = [
  "packages/paper-crdt/src/native-layout-formatting.ts",
  "packages/paper-crdt/src/native-formatting-decorations.ts",
  "packages/paper-crdt/src/native-layout-flow-mount.ts",
  "apps/api/src/paper/native-output/formatted.ts",
  "apps/api/src/paper/native-output/package.ts",
]

export function detectLinkDecorations(text, path) {
  if (!consumers.includes(path)) return []
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true)
  const hits = []
  let imported = false
  let called = false
  const decoration = (node) => {
    if (ts.isPropertyAccessExpression(node))
      return /^(underline|strike|color)$/.test(node.name.text)
    if (ts.isIdentifier(node))
      return /^(underline|strike|color)$/.test(node.text)
    if (ts.isPropertyAssignment(node))
      return /^(underline|strike|color)$/.test(node.name.getText(source))
    if (ts.isStringLiteralLike(node))
      return /(?:text-decoration|color\s*:|<w:(?:u|strike|color)\b)/.test(
        node.text
      )
    return ts.forEachChild(node, decoration) ?? false
  }
  const visit = (node) => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text ===
        "@workspace/domain/internal/paper-presentation" &&
      node.importClause?.namedBindings &&
      ts.isNamedImports(node.importClause.namedBindings)
    )
      imported ||= node.importClause.namedBindings.elements.some(
        (item) => item.name.text === "effectiveRunDecorations"
      )
    if (ts.isCallExpression(node))
      called ||= node.expression.getText(source) === "effectiveRunDecorations"
    if (ts.isIdentifier(node) && node.text === "paperLinkColor")
      hits.push("Only the domain resolver owns the link color")
    const condition = ts.isConditionalExpression(node)
      ? node.condition
      : ts.isIfStatement(node)
        ? node.expression
        : ts.isBinaryExpression(node) &&
            [
              ts.SyntaxKind.AmpersandAmpersandToken,
              ts.SyntaxKind.BarBarToken,
            ].includes(node.operatorToken.kind)
          ? node.left
          : undefined
    if (
      condition &&
      /link|href/i.test(condition.getText(source)) &&
      decoration(node)
    )
      hits.push("Link decorations must be resolved in effectiveRunDecorations")
    ts.forEachChild(node, visit)
  }
  visit(source)
  if (!imported || !called)
    hits.push("Page, toolbar and Word must call the domain decoration resolver")
  return hits
}

export function detectRichStructure(text, path) {
  const hits = [
    ...detectLinkCompatibility(text, path),
    ...detectStyleCascade(text, path),
    ...detectWordToggles(text, path),
  ]
  if (
    path === "packages/paper-crdt/src/native-formatting-commands.ts" &&
    (!text.includes('event.altKey && !mod && event.code === "Digit5"') ||
      !text.includes('event.metaKey && !event.altKey && key === "x"'))
  )
    hits.push("Rich strikethrough must support the PC and Mac Docs shortcuts")
  if (
    path === "packages/paper-crdt/src/native-layout-flow-mount.ts" &&
    text.includes("BlockNoteEditor.create(") &&
    !text.includes("...paragraphInlineValues(") &&
    !text.includes("effectiveParagraphStyle(")
  )
    hits.push("Rich active marks need paragraph style defaults")
  if (
    path === "packages/paper-crdt/src/native-formatting-decorations.ts" &&
    (!text.includes("list-style-type") || !text.includes("aria-level"))
  )
    hits.push("Rich lists must render markers and nested levels")
  if (path === "packages/paper-crdt/src/native-layout-flow-mount.ts") {
    const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true)
    const property = (node, name) =>
      node && ts.isObjectLiteralExpression(node)
        ? node.properties.find(
            (item) =>
              ts.isPropertyAssignment(item) &&
              (ts.isIdentifier(item.name) || ts.isStringLiteral(item.name)) &&
              item.name.text === name
          )?.initializer
        : undefined
    const visit = (node) => {
      if (ts.isCallExpression(node)) {
        if (
          path === "packages/paper-crdt/src/native-layout-flow-mount.ts" &&
          ts.isPropertyAccessExpression(node.expression) &&
          node.expression.getText(source) === "BlockNoteEditor.create" &&
          property(
            property(node.arguments[0], "links"),
            "isValidLink"
          )?.getText(source) !== "isSafeHref"
        )
          hits.push(
            "Rich editor links must use the domain http, https and mailto policy"
          )
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  if (
    path === "packages/domain/src/paper-doc/paragraph-styles.ts" &&
    /style\s*\?\?\s*["']normal["']/.test(text)
  )
    hits.push("Unstyled paragraphs must preserve document formatting defaults")
  const richControls = path.endsWith("/rich-structure-controls.tsx")
  if (richControls) {
    if (
      !text.includes("SelectContent finalFocus={returnToDocument}") ||
      !text.includes("DialogContent finalFocus={returnToDocument}") ||
      !text.includes("editor?.apply(") ||
      text.match(/onOpenChangeComplete=\{finishInteraction\}/g)?.length !== 2
    )
      hits.push(
        "Rich structure popups must return focus through the public editor apply"
      )
    if (!text.includes("isSafeHref(link.original)"))
      hits.push("Open link must revalidate the stored address")
    if (!text.includes("Text to display") || !text.includes("linkNeedsText"))
      hits.push("Insert link must support a collapsed caret with display text")
  }
  if (path === "packages/paper-crdt/src/native-formatting-commands.ts") {
    if (!text.includes("effectiveParagraphStyle("))
      hits.push("Rich current and mixed styles must resolve semantic headings")
    if (!text.includes('mark.name !== "link"'))
      hits.push("Remove formatting must preserve link marks")
    if (!text.includes("normalizeLinkHref(address)"))
      hits.push("Rich link entry must normalize website and email addresses")
  }
  if (path === "apps/api/src/paper/native-output/formatted.ts") {
    if (!text.includes("effectiveParagraphStyle("))
      hits.push("Word output must resolve semantic headings to named styles")
    if (!/effective\.bold\s*===\s*inherited\.bold/.test(text))
      hits.push("Word runs must not repeat inherited paragraph bold")
    if (
      !text.includes("richLink && !direct.characterStyle") ||
      !text.includes('<w:rStyle w:val="Hyperlink"/>')
    )
      hits.push(
        "Rich Word links must preserve named styles before using Hyperlink"
      )
  }
  if (
    path === "packages/paper-crdt/src/native-formatting-decorations.ts" &&
    (!text.includes('mark.type.name === "link"') ||
      !text.includes("effectiveRunDecorations(direct, isLink, effective)"))
  )
    hits.push(
      "Rich link text must paint the visible underline and semantic color"
    )

  if (
    richControls &&
    (!text.includes("normalizeLinkHref(link?.href") ||
      !text.includes("Custom style"))
  )
    hits.push(
      "Rich controls must identify invalid fields and preserve custom style names"
    )
  if (
    path === "packages/paper-crdt/src/native-formatting-commands.ts" &&
    (!text.includes("depth + descendants(block) < 3") ||
      text.includes('?.id ?? "normal"'))
  )
    hits.push(
      "Rich list indentation must respect the persisted depth cap and preserve custom styles"
    )
  if (
    path === "apps/api/src/paper/native-output/package.ts" &&
    (!text.includes('w:styleId="Hyperlink"') ||
      !text.includes("effectiveRunDecorations({}, true)"))
  )
    hits.push("Word packages must define the shared Paper Hyperlink style")
  if (
    path === "packages/paper-crdt/src/native-formatting-decorations.ts" &&
    /text-decoration(?:-line)?\s*:/.test(text)
  )
    hits.push(
      "Resolved inline decorations must compose marks in inlineCss, never append a text-decoration override"
    )
  if (richControls && /aria-describedby=\{\s*error\s*\?/.test(text))
    hits.push("Link error descriptions must match the failed field")
  return hits
}

export function detectLinkCompatibility(text, path) {
  const hits = []
  if (
    path === "packages/domain/src/paper-doc/paragraph-styles.ts" &&
    /color:\s*isLink\s*\?/.test(text)
  )
    hits.push("Explicit run color must precede the default link color")
  if (
    path === "apps/api/src/paper/native-output/package.ts" &&
    text.includes('w:styleId="Hyperlink"') &&
    !text.includes("input.richLinks && input.links.length")
  )
    hits.push("Hyperlink styles belong only to rich document packages")
  return hits
}

export function detectStyleCascade(text, path) {
  const hits = []
  if (
    /native-layout-(?:flow-mount|formatting)\.ts$/.test(path) &&
    text.includes("effectiveInline(") &&
    !text.includes("effectiveParagraphStyle(")
  )
    hits.push("Both toolbar readers must resolve the selected paragraph style")
  if (
    path.endsWith("paper-doc/presentation-styles.ts") &&
    !text.includes("overlay(overlay(paragraph, character.value), direct)")
  )
    hits.push("The Word cascade must ignore unset direct properties")
  if (
    path.includes("paper-crdt/src/") ||
    path.endsWith("native-output/formatted.ts")
  ) {
    if (/effectiveInline\([^;]*\.\.\.paragraphInlineValues\(/s.test(text))
      hits.push("Paragraph styles must resolve below character styles")
  }
  if (
    path.endsWith("paper-doc/paragraph-styles.ts") &&
    !text.includes('style.id !== "normal"')
  )
    hits.push("Normal text must inherit document defaults")
  if (
    path.endsWith("native-output/formatted.ts") &&
    text.includes("const inherited =") &&
    !/const inherited = direct\.characterStyle\s*\?/.test(text)
  )
    hits.push(
      "Word inheritance must include the named character style before direct marks"
    )
  if (
    path.endsWith("editor.ts") &&
    text.includes("mounted.adjustIndent(delta)") &&
    !text.includes("else mounted.adjustIndent(delta)")
  )
    hits.push(
      "The shared indent command must handle lists before paragraph indentation"
    )
  if (path.endsWith("rich-structure-controls.tsx")) {
    if (/title=|Undo2|Redo2|IndentIncrease|IndentDecrease/.test(text))
      hits.push(
        "Structure controls share the Docs tooltip, indent and history groups"
      )
    if (
      !text.includes("firstInvalid.current?.focus()") ||
      !text.includes('variant="primary"')
    )
      hits.push("Link errors focus the invalid field and Apply is primary")
  }
  if (
    path.endsWith("rich-text-formatting.tsx") &&
    text.includes("<RichTextParagraphGroup") &&
    !text.includes("controls: structure")
  )
    hits.push("Structure controls belong inside the compact More disclosure")
  if (
    path.endsWith("rich-text-formatting.tsx") &&
    text.includes("<RichDocumentHistory") &&
    text.includes("<RichTextParagraphGroup") &&
    !text.includes("shrink-0 [&>div]:flex-nowrap")
  )
    hits.push("Desktop paragraph controls must stay in the single Docs row")
  return hits
}

export function detectWordToggles(text, path) {
  if (
    path !== "apps/api/src/paper/native-output/formatted.ts" ||
    !text.includes("function compileDocument(")
  )
    return []
  const hits = []
  for (const name of ["bold", "italic"])
    if (
      !new RegExp(
        `${name}:\\s*generation === "rich"\\s*\\?\\s*\\(?effective\\.${name} \\?\\? false\\)?`
      ).test(text)
    )
      hits.push(
        `Rich Word runs must write absolute ${name} from the shared resolver`
      )
  if (!/strike:\s*generation === "rich"\s*\?\s*effective\.strike/.test(text))
    hits.push(
      "Rich Word runs must write resolved strike without an implicit false"
    )
  return hits
}
