export function detect(text, file) {
  const problems = []
  if (file.endsWith("editor.ts")) {
    const borders = text.match(/setTableBorders\([\s\S]*?\n      },/)?.[0]
    if (
      borders &&
      (!borders.includes(
        "if (!active || !mounted.editor.isEditable) return false"
      ) ||
        /apply\(|\.focus\(/.test(borders))
    )
      problems.push(
        "Border choices must keep control focus and check editor availability"
      )
    if (text.includes("...mounted.tables"))
      problems.push("Table operations must check the live editor")
    if (!text.includes('[data-paper-layout="paperRow"]'))
      problems.push("The table menu must anchor to the active row")
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
    const measure = text.indexOf(":not(.paper-table-anchor)")
    const sheet = text.indexOf('classList.contains("paper-rich-sheet")')
    if (measure < 0 || (sheet >= 0 && measure > sheet))
      problems.push(
        "The table menu anchor must not hide oversized-row pagination"
      )
    for (const rule of [
      "paperRow]{break-inside:avoid",
      "paper-oversized-row=true]{height:var(--paper-column-height);overflow:auto",
      'row.setAttribute("tabindex", "0")',
      'row.setAttribute("role", "region")',
      "Scroll to read all content.",
    ])
      if (!text.includes(rule))
        problems.push("Table rows must stay whole and inside printable pages")
  }
  if (file.endsWith("native-layout-measured-pagination.ts")) {
    if (
      !text.includes('block.node.type.name === "paperRow"') ||
      !text.includes('? "row"') ||
      !text.includes("...measuredPageBreaks(units,")
    )
      problems.push("Table rows must stay whole and inside printable pages")
  }
  if (file.endsWith("native-layout-schema.ts")) {
    if (!text.includes("[data-is-empty-and-focused]"))
      problems.push("Empty table cells must hide the editor placeholder")
    if (!text.includes('if (block.type === "paperRow") dom.prepend(slot)'))
      problems.push("Table row grids must remain the first element")
    if (
      text.includes("slot.style.boxShadow") ||
      !text.includes(
        'dom.style.borderBlockStart = "1px solid var(--border)"'
      ) ||
      !text.includes('dom.style.borderInlineEnd = "1px solid var(--border)"') ||
      !text.includes('dom.style.height = "100%"')
    )
      problems.push("Cell borders must fill the row box")
  }
  if (file.endsWith("rich-table-controls.tsx")) {
    if (
      !text.includes("const [anchor] = useReducer(") ||
      /dispatch\(\{ type: "mount"/.test(text)
    )
      problems.push(
        "Table menu portals must keep their host when table rows change"
      )
    if (
      !text.includes("open={open && available}") ||
      (text.match(/disabled={!available}/g)?.length ?? 0) < 3
    )
      problems.push("Open table forms must follow editor availability")
    if (
      !text.includes("tableRowElement") ||
      !text.includes("paper-table-anchor")
    )
      problems.push("The table menu must anchor to the active row")
  }
  if (file.endsWith("rich-table.css")) {
    if (
      text.includes("inset-block-start: -46px") ||
      text.includes("margin-block-start: 48px") ||
      !text.includes("position: sticky") ||
      !text.includes("inset-block-start: 0")
    )
      problems.push("The table menu must stay on the active row")
    if (!text.includes("border-inline-start: 1px solid var(--border)"))
      problems.push("Interior cell borders must stay a single line")
  }
  if (
    file.endsWith("rich-table-menu.tsx") &&
    !text.includes("overscroll-contain")
  )
    problems.push("The table menu scroller must contain overscroll")
  if (
    file.endsWith("native-layout-flow-mount.ts") &&
    !text.includes("closest(\"[data-paper-oversized-row='true']\")")
  )
    problems.push("Tab from an oversized row must reach the table menu")
  if (file.endsWith("formatted.ts") && !text.includes("<w:cantSplit/>"))
    problems.push("Word table rows must request whole-row pagination")
  return problems
}
