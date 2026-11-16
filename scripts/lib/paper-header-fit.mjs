export function detect(rows) {
  return rows.flatMap((row) => {
    const failures = []
    if (row.title.width < row.minimum - 1)
      failures.push("Paper title collapsed below four characters")
    if (row.menu.right > row.viewport || row.menu.x < 0)
      failures.push("Paper document menu leaves the viewport")
    if (row.status.right > row.menu.x)
      failures.push("Paper status overlaps the document menu")
    if (row.title.y === row.menu.y && row.title.right > row.status.x)
      failures.push("Paper title overlaps the status")
    if (row.normal && !row.sameLine)
      failures.push("Paper normal-text header unnecessarily wraps")
    return failures.map((failure) => `${row.case}: ${failure}`)
  })
}
