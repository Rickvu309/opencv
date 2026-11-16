export function detect(text, path) {
  if (path !== "apps/web/src/features/paper/design/rich-page-header.pen.css")
    return []
  return /@media\s*\(width < 48rem\)\s*\{[\s\S]*?page-header"\]\s*>\s*:first-child\s*\{[^}]*flex-basis:\s*0\s*;/.test(
    text
  ) && /page-header-title"\]\s*\{[^}]*white-space:\s*nowrap\s*;/.test(text)
    ? []
    : [
        "Paper phone headers must let the title yield space to Saved and the menu",
      ]
}
