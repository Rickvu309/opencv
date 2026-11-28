export function detectSizeSpacing(text, path) {
  const hits = []
  if (path.endsWith("/rich-text-font-group.tsx")) {
    if (/Number\(draft \?\? formatting\?\.size \?\? 11\)/.test(text))
      hits.push("Font steppers must preserve each selected run's own size")
    if (
      text.includes("onKeyDown=") &&
      !text.includes("nativeEvent.isComposing")
    )
      hits.push("Font size Enter must leave IME composition intact")
    if (text.includes("editor.focus()") && !text.includes("onAction()"))
      hits.push("Applying a font size must close the More popover")
  }
  if (
    [
      "apps/web/src/features/paper/rich-editor/rich-text-font-group.tsx",
      "apps/web/src/features/paper/rich-editor/rich-text-custom-spacing.tsx",
    ].includes(path) &&
    /type=["']number["']/.test(text)
  )
    hits.push("Point inputs must preserve decimal commas for explicit parsing")
  if (
    path === "packages/paper-crdt/src/native-formatting-render-values.ts" &&
    text.includes("1.2em")
  )
    hits.push(
      "Word line boxes must use text metrics rather than the container's 1.2em floor"
    )
  if (path === "packages/domain/src/paper-doc/presentation-values.ts") {
    const stored = text.slice(
      text.indexOf("const lineSpacingSchema"),
      text.indexOf("export function lineSpacingWordUnits")
    )
    if (stored.includes("exactWordUnits"))
      hits.push(
        "Stored paragraph line multiples must remain backwards compatible"
      )
    if (text.includes("const units = exactWordUnits("))
      hits.push("Legacy export line multiples must round at the Word boundary")
  }
  if (
    path === "packages/paper-crdt/src/native-layout-formatting.ts" &&
    text.includes("engineProps(paragraphSchema.parse(input))")
  )
    hits.push(
      "New paragraph edits must validate exact Word units before mutation"
    )
  if (
    path === "packages/paper-crdt/src/native-formatting-decorations.ts" &&
    text.includes("paragraphCss(") &&
    !text.includes("paragraphStrut(node, presentation)")
  )
    hits.push(
      "At least paragraph struts must follow actual runs instead of inherited text"
    )
  return hits
}
