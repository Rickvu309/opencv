export function detect(source, file = "") {
  if (file.endsWith("/rich-page-geometry.css"))
    return /repeating-linear-gradient/.test(source)
      ? ["Tile Paper page backgrounds at one page pitch for Firefox"]
      : []
  if (!/paper-crdt\/src\/[^/]+\.(?:ts|js)$/.test(file)) return []
  const problems = []
  if (/(?:^|[^\w-])column-(?:height|wrap)\s*[:"']/.test(source))
    problems.push("Measure Paper page breaks without experimental CSS columns")
  if (
    /function flowPaginationSupport[\s\S]*?node\.type\s*===?\s*["']photo["'][\s\S]*?supported:\s*false/.test(
      source
    )
  )
    problems.push("Photos must remain eligible for Paper pagination")
  return problems
}
