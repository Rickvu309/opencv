import ts from "typescript"

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
    path === "packages/paper-crdt/src/rich-page-layout.ts" &&
    /const scale = Math.min/.test(text)
  )
    hits.push("Phone Paper must reflow without scaling text")
  if (
    path === "packages/paper-crdt/src/native-layout-flow-mount.ts" &&
    text.includes('!element.classList.contains("paper-rich-sheet")')
  )
    hits.push("Rich Paper must preserve automatic pagination")
  if (
    path === "apps/web/src/features/paper/rich-page-geometry.css" &&
    /column-(height: auto|wrap: nowrap)/.test(text.split("@media")[0])
  )
    hits.push("Rich Paper must preserve automatic column wrapping on desktop")
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
  if (path === "apps/web/src/features/paper/rich-page-setup.tsx") {
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
  if (
    path === "apps/web/src/features/paper/rich-page-break.tsx" &&
    !text.includes("editor?.apply(")
  )
    hits.push("Page break controls must use the editor lifetime guard")
  return hits
}
