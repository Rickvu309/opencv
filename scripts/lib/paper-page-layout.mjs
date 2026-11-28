import ts from "typescript"

export function repeatingGapBands(painted, pageHeight, gap, sheetHeight) {
  if (!painted || !(pageHeight > 0) || !(gap > 0)) return []
  const pitch = pageHeight + gap
  const bands = []
  for (let top = pageHeight; top + 0.5 < sheetHeight; top += pitch)
    bands.push({ top, bottom: Math.min(sheetHeight, top + gap) })
  return bands
}

export function pageBandHits(lines, bands, content) {
  const gapHits = []
  const marginHits = []
  for (const line of lines) {
    if (line.top < content.top - 0.5 || line.bottom > content.bottom + 0.5)
      marginHits.push(line)
    if (
      bands.some(
        (band) => line.bottom > band.top + 0.5 && line.top < band.bottom - 0.5
      )
    )
      gapHits.push(line)
  }
  return { gapHits, marginHits }
}

export function detectPageLayout(text, path) {
  const hits = []
  if (
    path === "packages/paper-crdt/src/presentation-meta.ts" &&
    /Object\.entries\(checked\)\) nested\.set/.test(text)
  )
    hits.push("Unchanged page metadata must not create Undo entries")
  if (
    path === "packages/paper-crdt/src/native-layout-flow.ts" &&
    /binding\.doc\s*\.getMap<unknown>\("paper"\)\s*\.set\("formattingProfile", document\.profile\)/.test(
      text
    )
  )
    hits.push("Unchanged flow profile must not create Undo entries")
  if (
    path === "packages/paper-crdt/src/native-layout-flow-mount.ts" &&
    text.includes('!element.classList.contains("paper-rich-sheet")')
  )
    hits.push("Rich Paper must preserve automatic pagination")
  if (path.endsWith("/rich-page-geometry.css")) {
    for (const [, selector, declarations] of text.matchAll(
      /([^{}]+)\{([^{}]*)\}/g
    )) {
      if (
        /repeating-linear-gradient|min-block-size:\s*var\(--cv-rich-page-height/.test(
          declarations
        ) &&
        !selector
          .split(",")
          .every((part) =>
            /\[data-paper-pagination=["']?true["']?\]/.test(part)
          )
      )
        hits.push("Page gaps and page height require supported pagination")
      if (/column-(height:\s*auto|wrap:\s*nowrap)/.test(declarations))
        hits.push(
          "Rich Paper must preserve automatic column wrapping on desktop"
        )
    }
  }
  if (path === "packages/paper-crdt/src/editor.ts") {
    const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true)
    const visit = (node) => {
      if (
        ts.isSpreadAssignment(node) &&
        node.expression.getText(source) === "pages"
      )
        hits.push("Page commands must guard the editor lifetime")
      ts.forEachChild(node, visit)
    }
    visit(source)
    if (
      text.includes("pages.insertPageBreak()") &&
      !text.includes("event.isComposing")
    )
      hits.push("Page break shortcuts must preserve composition")
  }
  if (
    path === "packages/paper-crdt/src/native-layout-page-commands.ts" &&
    /removePageBreak\(backward: boolean\) \{\s*const/.test(text)
  )
    hits.push("Removing page breaks must respect editability")
  if (
    path === "packages/paper-crdt/src/native-layout-page-commands.ts" &&
    text.includes("canInsertPageBreak()") &&
    !text.includes("$from.depth === 5")
  )
    hits.push("Page breaks must not jump outside nested content")
  if (path.endsWith("/rich-page-setup.tsx")) {
    const source = ts.createSourceFile(
      path,
      text,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    )
    const visit = (node) => {
      if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
        const attributes = new Map(
          node.attributes.properties.flatMap((attribute) =>
            ts.isJsxAttribute(attribute) &&
            attribute.initializer &&
            ts.isStringLiteral(attribute.initializer)
              ? [[attribute.name.getText(source), attribute.initializer.text]]
              : []
          )
        )
        if (
          node.tagName.getText(source) === "Input" &&
          attributes.get("type") === "number" &&
          attributes.get("step") !== "any"
        )
          hits.push("Page setup must accept fractional imported margins")
        if (
          node.tagName.getText(source) === "Button" &&
          !/\bmin-h-\[44px\]/.test(attributes.get("className") ?? "")
        )
          hits.push("Page setup phone actions need a 44px minimum height")
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
    if (
      text.includes("editor.pageSetup()") &&
      !text.includes("const page = editor.pageSetup()")
    )
      hits.push("Page setup must read the editor only in its open handler")
    if (!text.includes("editor.apply("))
      hits.push("Page setup must use the editor lifetime guard")
    if (/sizes\.a4\[0\] \? "a4" : "letter"/.test(text))
      hits.push("Page setup must preserve and name custom page sizes")
    if (text.includes("This setup leaves too little room"))
      hits.push(
        "Page setup failures must not misreport editing failures as margins"
      )
  }
  if (path.endsWith("/rich-page-break.tsx") && !text.includes("editor?.apply("))
    hits.push("Page break controls must use the editor lifetime guard")
  return hits
}
