import ts from "typescript"

export function detectPhotoApplyRounding(text, path) {
  if (path === "apps/web/src/features/paper/rich-photo-number.tsx") {
    const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true)
    const hits = []
    const visit = (node) => {
      if (
        ts.isJsxAttribute(node) &&
        node.name.getText(source) === "onBlur" &&
        node.initializer?.getText(source) === "{onCommit}"
      )
        hits.push("Photo fields must not re-commit unchanged values on blur")
      ts.forEachChild(node, visit)
    }
    visit(source)
    return hits
  }
  if (path !== "apps/web/src/features/paper/rich-photo-form.ts") return []
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true)
  const hits = []
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ["fitPhotoCrop", "resizePhoto"].includes(node.expression.getText(source))
    ) {
      const gate =
        node.expression.getText(source) === "fitPhotoCrop"
          ? "cropNeedsFit"
          : "sizeNeedsFit"
      let parent = node.parent
      let guarded = false
      while (parent && !ts.isFunctionDeclaration(parent)) {
        if (
          (ts.isConditionalExpression(parent) &&
            parent.whenTrue.pos <= node.pos &&
            node.end <= parent.whenTrue.end) ||
          (ts.isIfStatement(parent) &&
            parent.thenStatement.pos <= node.pos &&
            node.end <= parent.thenStatement.end)
        ) {
          const condition = ts.isIfStatement(parent)
            ? parent.expression
            : parent.condition
          const identifiers = new Set()
          const names = (item) => {
            if (ts.isIdentifier(item)) identifiers.add(item.text)
            ts.forEachChild(item, names)
          }
          names(condition)
          if (identifiers.has("editedField") && identifiers.has(gate))
            guarded = true
        }
        parent = parent.parent
      }
      if (!guarded)
        hits.push(
          "Photo Apply must preserve already-consistent shown fields instead of fitting them again"
        )
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return hits
}

export function detectPhotoPresentation(text, path, source) {
  const hits = detectPhotoApplyRounding(text, path)
  if (
    path === "apps/web/src/features/paper/rich-photo-error.ts" &&
    !text.includes('error.message.trimStart().startsWith("[")')
  )
    hits.push("Photo errors must hide schema details after serialization")
  if (path === "apps/web/src/features/paper/rich-photo-form.ts") {
    const form = source.statements.find(
      (node) =>
        ts.isFunctionDeclaration(node) && node.name?.text === "parsePhotoForm"
    )
    const crop = form?.body?.statements.find(
      (node) =>
        ts.isVariableStatement(node) &&
        node.declarationList.declarations.some(
          (declaration) =>
            declaration.name.getText(source) === "crop" &&
            declaration.initializer
              ?.getText(source)
              .includes("fitPhotoCrop(sourceRatio, 1, photo.crop")
        )
    )
    if (
      !crop ||
      !text.includes("original.placement") ||
      !text.includes("Math.round((photo.width / 15) * 100)") ||
      text.includes("errors[second] =")
    )
      hits.push(
        "Photo Apply must fit Circle from the final fields, preserve untouched placement and round displayed sizes"
      )
  }
  if (path === "apps/web/src/features/paper/rich-photo-number.tsx") {
    if (
      /use(?:Reducer|State|Effect)\s*\(/.test(text) ||
      !text.includes("tabular-nums") ||
      !text.includes("aria-invalid") ||
      !text.includes("aria-describedby")
    )
      hits.push(
        "Photo fields must be controlled by the shared form with linked errors and tabular figures"
      )
  }
  if (path === "apps/web/src/features/paper/rich-photo-controls.tsx") {
    function inspectPhotoInput(node) {
      if (
        ts.isJsxAttribute(node) &&
        node.name.getText(source) === "onChange" &&
        /fitPhotoCrop\(|resizePhoto\(/.test(node.getText(source))
      )
        hits.push(
          "Photo geometry must commit after typing instead of rewriting each keystroke"
        )
      ts.forEachChild(node, inspectPhotoInput)
    }
    inspectPhotoInput(source)
    function inspectSubmit(node) {
      if (ts.isJsxAttribute(node) && node.name.getText(source) === "onSubmit") {
        const submit = node.getText(source)
        if (
          submit.includes("editor.updatePhoto(") &&
          (!/parsePhotoForm\([^,]+,\s*fields(?:,\s*sourceRatio(?:,[\s\S]*?)?)?\s*\)/.test(
            submit
          ) ||
            !submit.includes("photo.ok") ||
            !submit.includes(".focus()"))
        )
          hits.push(
            "Photo Apply must validate all visible fields and focus the first invalid field before saving"
          )
      }
      ts.forEachChild(node, inspectSubmit)
    }
    inspectSubmit(source)
    if (
      text.includes("<DialogContent") &&
      (!text.includes("<DialogHeader") ||
        !text.includes("overscroll-contain") ||
        !/<DialogFooter[^>]*sticky[^>]*mx-0 mb-0/.test(text) ||
        !text.includes('variant="primary"'))
    )
      hits.push(
        "Photo dialog must keep its primary Apply visible beside a contained scrolling body"
      )
    if (
      text.includes("error.message") &&
      !text.includes("photoErrorMessage(error)")
    )
      hits.push(
        "Photo errors must explain how to recover instead of exposing domain or schema messages"
      )
  }
  if (
    path === "packages/paper-crdt/src/native-layout-photo-controls.ts" &&
    text.includes("layoutPhotoSchema.parse({") &&
    !text.includes("width / aspectRatio) < 240") &&
    !text.includes("photoInsertSize(aspectRatio, available)")
  )
    hits.push(
      "Photo insertion must refuse unsupported source proportions before parsing geometry"
    )
  if (
    path === "apps/web/src/features/paper/rich-photo-preview.tsx" &&
    text.includes("<img") &&
    (!text.includes('role="img"') ||
      text.includes("insetInlineStart:") ||
      text.includes("insetBlockStart:") ||
      !text.includes("Math.min(width, height) / 6"))
  )
    hits.push(
      "Photo preview must expose its image role and match physical crop edges and rounded geometry"
    )
  if (
    path === "apps/web/src/features/paper/rich-photo-controls.tsx" &&
    text.includes("uploadPaperPhoto(file)") &&
    (text.indexOf("photoInsertSize(ratio)") < 0 ||
      text.indexOf("photoInsertSize(ratio)") >
        text.indexOf("uploadPaperPhoto(file)"))
  )
    hits.push("Unsupported photo proportions must be refused before upload")
  if (
    path === "packages/domain/src/paper-doc/native-photo-geometry.ts" &&
    text.includes("function fitEditedCrop(") &&
    !text.includes("99900 - crop[editedEdge]")
  )
    hits.push(
      "Circle crop projection must bound the opposite edge by the edited edge"
    )
  return hits
}
