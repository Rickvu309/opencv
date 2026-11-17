export function detectSizeSpacing(text, path) {
  const hits = []
  if (path === "apps/web/src/features/paper/rich-text-font-group.tsx") {
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
      "apps/web/src/features/paper/rich-text-font-group.tsx",
      "apps/web/src/features/paper/rich-text-custom-spacing.tsx",
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
  if (
    path === "packages/domain/src/paper-doc/presentation-values.ts" &&
    /value:\s*z\.number\(\)\.min\(0\.5\)\.max\(10\)(?!\s*\.refine)/.test(text)
  )
    hits.push(
      "Line multiples must validate exact Word units at the domain boundary"
    )
  return hits
}
