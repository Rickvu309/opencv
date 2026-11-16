const toolbar = "apps/web/src/features/paper/rich-text-formatting.tsx"
const measurement = "apps/web/src/features/paper/rich-text-toolbar-overflow.ts"

export function detect(text, path) {
  if (
    path === toolbar &&
    text.includes("<RichDocumentHistory") &&
    (!text.includes("useToolbarEmphasisOverflow(host, compact)") ||
      !text.includes("{!emphasisOverflow ? (") ||
      !text.includes("{emphasisOverflow ? ("))
  )
    return ["Paper history and More need measured emphasis overflow"]
  if (
    path === measurement &&
    (!text.includes("entry.contentRect.width") ||
      !text.includes("child.getBoundingClientRect().width") ||
      !text.includes("getComputedStyle(row).columnGap") ||
      !text.includes("required > width"))
  )
    return [
      "Paper overflow must compare measured controls and gaps to available width",
    ]
  return []
}
