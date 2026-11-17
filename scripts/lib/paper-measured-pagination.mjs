export function detect(source, file = "") {
  if (file.endsWith("/rich-page-geometry.css"))
    return /repeating-linear-gradient/.test(source)
      ? ["Tile Paper page backgrounds at one page pitch for Firefox"]
      : []
  if (!/paper-crdt\/src\/[^/]+\.(?:ts|js)$/.test(file)) return []
  const problems = []
  if (file.endsWith("/native-layout-measured-pagination.ts")) {
    if (
      !source.includes("effectiveParagraph(") ||
      !source.includes("canonicalProps(")
    )
      problems.push("Measured pages must preserve Word paragraph break rules")
  }
  if (file.endsWith("/native-layout-text-lines.ts")) {
    if (
      !source.includes(
        "Math.min(previous.bottom, bottom) - Math.max(previous.top, top)"
      )
    )
      problems.push("Mixed font fragments must share a visual line box")
    if (
      !source.includes("properties.keepNext") ||
      !source.includes("properties.keepTogether") ||
      !source.includes("properties.widowOrphan !== false")
    )
      problems.push("Measured pages must preserve Word paragraph break rules")
  }
  if (file.endsWith("/native-layout-measured-pagination.ts")) {
    if (!source.includes("node.childCount > 1"))
      problems.push("Semantic owners must paginate their editable descendants")
    if (
      !source.includes('"data-paper-oversized-block": "true"') ||
      !source.includes('tabindex: "0"') ||
      !source.includes('role: "region"') ||
      !source.includes('contenteditable: "false"')
    )
      problems.push("Oversized atomic blocks need labelled keyboard scrolling")
    if (source.includes("Math.abs(previous.top - top) < 1"))
      problems.push("Mixed font fragments must share a visual line box")
    if (
      !source.includes("corrections") ||
      !source.includes("pass <") ||
      !source.includes("invalidated = !settled")
    )
      problems.push("Verify painted geometry before caching pagination")
    if (!source.includes("paintedUnits") || !source.includes("updates.every"))
      problems.push("Typing must stop at unchanged downstream page geometry")
  }
  if (
    file.endsWith("/native-layout-flow-view.ts") &&
    source.includes("frame = requestAnimationFrame") &&
    (!source.includes("afterPaint = window.setTimeout") ||
      !source.includes('row.contentEditable = "false"') ||
      !source.includes('content.contentEditable = "true"'))
  )
    problems.push(
      "Measured pagination must yield the input frame and preserve oversized keyboard focus"
    )
  if (
    file.endsWith("/native-layout-flow-mount.ts") &&
    !source.includes("scrollOversizedContent(event)")
  )
    problems.push(
      "Focused oversized regions must scroll before the editor moves its caret"
    )
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
