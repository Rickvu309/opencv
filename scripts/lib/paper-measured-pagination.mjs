export function detect(source, file = "") {
  if (file.endsWith("/rich-page-geometry.css"))
    return /repeating-linear-gradient/.test(source)
      ? ["Tile Paper page backgrounds at one page pitch for Firefox"]
      : []
  if (!/paper-crdt\/src\/[^/]+\.(?:ts|js)$/.test(file)) return []
  const problems = []
  if (file.endsWith("/measured-flow-pagination.ts")) {
    if (
      !source.includes("effectiveParagraph(") ||
      !source.includes("canonicalProps(") ||
      !source.includes("properties.keepNext") ||
      !source.includes("properties.keepTogether") ||
      !source.includes("properties.widowOrphan !== false")
    )
      problems.push("Measured pages must preserve Word paragraph break rules")
  }
  if (file.endsWith("/native-layout-search.ts")) {
    if (
      !/scrollFrame = requestAnimationFrame[\s\S]*?scrollFrame = requestAnimationFrame[\s\S]*?if \(active\) scroll\(\)/.test(
        source
      )
    )
      problems.push(
        "Find must reveal its match after browser scroll anchoring settles"
      )
  }
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
