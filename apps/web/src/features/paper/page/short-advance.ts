export type LineMeasure = {
  text: string
  nextText: string
  page: number
  nextPage: number
  section: string
  nextSection: string
  columnBreak: boolean
  advancePx: number
  runSizePx: number
  sourceLine: number
}

export function lineFloor(runSizePx: number, sourceLine: number) {
  return 0.9 * runSizePx * (sourceLine / 240)
}

export function isShortAdvance(line: LineMeasure) {
  return (
    line.page === line.nextPage &&
    line.section === line.nextSection &&
    !line.columnBreak &&
    line.advancePx + 1e-9 < lineFloor(line.runSizePx, line.sourceLine)
  )
}

function clip(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

export function shortAdvanceNote(lines: LineMeasure[]) {
  return lines
    .filter(isShortAdvance)
    .map((line) => {
      const floor = lineFloor(line.runSizePx, line.sourceLine)
      return `Line spacing ${line.sourceLine} (${(line.sourceLine / 240).toFixed(2)}) advances ${line.advancePx}px from "${clip(line.text)}" to "${clip(line.nextText)}", under the ${floor.toFixed(1)}px floor.`
    })
    .join(" ")
}

export function markShortRegions(root: ParentNode, lines: LineMeasure[]) {
  const paragraphs = [...root.querySelectorAll("article p")]
  for (const line of lines.filter(isShortAdvance)) {
    const from = clip(line.text)
    const host = paragraphs.find((node) =>
      clip(node.textContent ?? "").includes(from)
    )
    if (!(host instanceof HTMLElement)) continue
    host.setAttribute("contenteditable", "false")
    host.dataset.shortAdvance = String(line.advancePx)
    host.setAttribute(
      "aria-label",
      `Read-only. Line spacing ${line.sourceLine} advances ${line.advancePx}px.`
    )
  }
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid] ?? 0
  return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
}

export function measureAdvances(root: ParentNode): LineMeasure[] {
  const canvas = document.createElement("canvas")
  const context = canvas.getContext("2d")
  if (!context) return []
  const pages = [...root.querySelectorAll("section.docx")]
  const paragraphs = [
    ...root.querySelectorAll<HTMLParagraphElement>("article p"),
  ].filter((node) => !node.classList.contains("source-header"))
  const lines: LineMeasure[] = []
  for (let index = 0; index < paragraphs.length - 1; index++) {
    const current = paragraphs[index]
    const next = paragraphs[index + 1]
    if (!current || !next) continue
    const currentPage = pages.indexOf(current.closest("section.docx")!) + 1
    const nextPage = pages.indexOf(next.closest("section.docx")!) + 1
    const groups = glyphGroups(current, context)
    const nextGroups = glyphGroups(next, context)
    const last = groups.at(-1)
    const first = nextGroups[0]
    if (!last || !first) continue
    lines.push({
      text: current.textContent ?? "",
      nextText: next.textContent ?? "",
      page: currentPage,
      nextPage,
      section: current.dataset.section ?? "",
      nextSection: next.dataset.section ?? "",
      columnBreak: next.dataset.columnBreak === "1",
      advancePx: Number((first.baseline - last.baseline).toFixed(1)),
      runSizePx: last.runSizePx,
      sourceLine: Number(current.dataset.line || "240"),
    })
  }
  return lines
}

function glyphGroups(
  paragraph: Element,
  context: CanvasRenderingContext2D
): { baseline: number; runSizePx: number }[] {
  const style = getComputedStyle(paragraph)
  context.font = style.font
  const buckets: { top: number; baselines: number[]; sizes: number[] }[] = []
  const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node) {
    const value = node.textContent ?? ""
    for (let i = 0; i < value.length; i++) {
      if (/\s/.test(value[i] ?? "")) continue
      const range = document.createRange()
      range.setStart(node, i)
      range.setEnd(node, i + 1)
      const rect = range.getClientRects()[0]
      if (!rect || rect.height === 0) continue
      const size = Number.parseFloat(
        getComputedStyle(node.parentElement ?? paragraph).fontSize
      )
      const metrics = context.measureText(value[i] ?? "")
      const ascent = metrics.actualBoundingBoxAscent
      if (!Number.isFinite(ascent) || !size) continue
      const baseline = rect.top + ascent
      const bucket = buckets.find((row) => Math.abs(row.top - rect.top) <= 3)
      if (bucket) {
        bucket.baselines.push(baseline)
        bucket.sizes.push(size)
      } else {
        buckets.push({ top: rect.top, baselines: [baseline], sizes: [size] })
      }
    }
    node = walker.nextNode()
  }
  return buckets.map((bucket) => ({
    baseline: median(bucket.baselines),
    runSizePx: Math.max(...bucket.sizes),
  }))
}
