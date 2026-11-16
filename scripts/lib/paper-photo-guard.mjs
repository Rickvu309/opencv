import ts from "typescript"

export function detectPhotoPresentation(text, path, source) {
  const hits = []
  if (
    path === "apps/web/src/features/paper/rich-photo-error.ts" &&
    !text.includes('error.message.trimStart().startsWith("[")')
  )
    hits.push("Photo errors must hide schema details after serialization")
  if (path === "apps/web/src/features/paper/rich-photo-number.tsx") {
    if (
      !/useReducer\([^,]+,\s*String\(value\)\)/.test(text) ||
      !text.includes("tabular-nums") ||
      !text.includes("validity.valid") ||
      /onChange=\{[\s\S]*?onCommit\(/.test(text.split("onBlur=")[0])
    )
      hits.push(
        "Photo numbers must keep an empty string draft and validate only on commit with tabular figures"
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
    path === "apps/web/src/features/paper/rich-photo-number.tsx" &&
    !text.includes("onCommit(Number(draft)) === false")
  )
    hits.push("Refused photo numbers must reset to the committed draft")
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
