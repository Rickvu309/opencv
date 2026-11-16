export function detectRichStructure(text, path) {
  const hits = []
  if (
    path === "packages/domain/src/paper-doc/paragraph-styles.ts" &&
    /style\s*\?\?\s*["']normal["']/.test(text)
  )
    hits.push("Unstyled paragraphs must preserve document formatting defaults")
  const richControls =
    path === "apps/web/src/features/paper/rich-structure-controls.tsx"
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
  }
  if (
    path === "packages/paper-crdt/src/native-formatting-decorations.ts" &&
    (!text.includes('mark.type.name === "link"') ||
      !text.includes("color:var(--primary);text-decoration:underline"))
  )
    hits.push(
      "Rich link text must paint the visible underline and semantic color"
    )

  return hits
}
