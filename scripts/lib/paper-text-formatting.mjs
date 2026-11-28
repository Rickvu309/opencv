import { detectSizeSpacing } from "./paper-size-spacing.mjs"

export function detectTextFormatting(text, path) {
  const hits = detectSizeSpacing(text, path)
  if (
    path === "packages/ui/src/components/select.tsx" &&
    /select-value.*line-clamp-1.*select-value.*:flex/.test(text)
  )
    hits.push("Select values need ellipsis without a flex display override")
  if (
    path.endsWith("/rich-text-emphasis-group.tsx") &&
    text.includes("size-11")
  )
    hits.push(
      "Phone emphasis hit areas must fit when text scales to 200 percent"
    )
  if (path === "packages/paper-crdt/src/editor.ts") {
    if (
      text.includes('"Document content"') &&
      !text.includes('view.dom.style.outline = "none"')
    )
      hits.push(
        "The writing caret indicates editor focus without a page perimeter"
      )
    if (/activeFormatting\(\)\.start/.test(text))
      hits.push(
        "Indent shortcuts must adjust each selected paragraph independently"
      )
  }
  if (path.endsWith("/rich-text-paragraph-group.tsx")) {
    if (text.includes("formatting?.start"))
      hits.push("Indent buttons cannot flatten a mixed paragraph selection")
    if (text.includes("Ctrl+") && !text.includes("shortcutLabel("))
      hits.push("Toolbar shortcuts must use the platform modifier")
  }
  if (
    path.endsWith("/rich-text-formatting.tsx") &&
    /const controls =[^]*?<fieldset[^]*?\{children\}/.test(text)
  )
    hits.push("Phone emphasis controls must remain beside More")
  if (
    path.endsWith("/rich-text-color-group.tsx") &&
    text.includes('"var(--background)"')
  )
    hits.push(
      "Swatch check marks must contrast against fixed swatches in both themes"
    )
  if (
    /^scripts\/.*\.test\.mjs$/.test(path) &&
    /(?:import\(|from\s*)["'][^"']*apps\/api\/src\//.test(text)
  )
    hits.push(
      "API runtime behavior belongs to the API suite with its build dependencies"
    )
  return hits
}
