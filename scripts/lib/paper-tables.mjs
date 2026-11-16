export function detect(text, file) {
  const problems = []
  if (file.endsWith("editor.ts")) {
    if (text.includes("...mounted.tables"))
      problems.push("Table operations must check the live editor")
    for (const name of [
      "insertTable",
      "addTableRow",
      "removeTableRow",
      "addTableColumn",
      "removeTableColumn",
      "resizeTableColumn",
      "removeTable",
    ]) {
      if (
        !new RegExp(
          `return apply\\(\\(\\) => mounted\\.tables\\.${name}\\(`
        ).test(text)
      )
        problems.push(`${name} must use the editor availability gate`)
    }
  }
  if (file.endsWith("native-layout-flow-view.ts")) {
    if (/node\.type === "table"/.test(text))
      problems.push("Tables must retain automatic pagination")
    for (const rule of [
      "paperRow]{break-inside:avoid",
      "paper-oversized-row=true]{height:var(--paper-column-height);overflow:auto",
      "paper-oversized-row=true]){break-before:column;break-after:column}",
    ])
      if (!text.includes(rule))
        problems.push("Table rows must stay whole and inside printable pages")
  }
  if (file.endsWith("native-layout-schema.ts")) {
    if (
      text.includes("slot.style.boxShadow") ||
      !text.includes('dom.style.border = "1px solid var(--border)"') ||
      !text.includes('dom.style.height = "100%"')
    )
      problems.push("Cell borders must fill the row box")
  }
  if (file.endsWith("rich-table-controls.tsx")) {
    if (
      !text.includes("open={open && available}") ||
      (text.match(/disabled={!available}/g)?.length ?? 0) < 3
    )
      problems.push("Open table forms must follow editor availability")
  }
  if (file.endsWith("formatted.ts") && !text.includes("<w:cantSplit/>"))
    problems.push("Word table rows must request whole-row pagination")
  return problems
}
