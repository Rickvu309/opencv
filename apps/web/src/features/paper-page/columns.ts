import { attr, byLocal, paragraphText, xmlDoc } from "./source-line.ts"

export type ColumnPlan = {
  left: string[]
  right: string[]
  leftPx: number
  gapPx: number
  rightPx: number
}

function collapsed(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

function textsAroundColumnBreak(paragraph: Element) {
  const column = byLocal(paragraph, "br").find(
    (node) => attr(node, "type") === "column"
  )
  if (!column) return { before: collapsed(paragraphText(paragraph)), after: "" }
  const before: string[] = []
  const after: string[] = []
  let seen = false
  const visit = (node: Element) => {
    if (node === column) {
      seen = true
      return
    }
    if (node.localName === "t") {
      ;(seen ? after : before).push(node.textContent ?? "")
      return
    }
    for (const child of node.children) visit(child)
  }
  visit(paragraph)
  return {
    before: collapsed(before.join("")),
    after: collapsed(after.join("")),
  }
}

export function columnPlans(documentXml: string): ColumnPlan[] {
  const body = byLocal(xmlDoc(documentXml), "body")[0]
  if (!body) return []
  const plans: ColumnPlan[] = []
  let buffer: Element[] = []
  const flush = (section: Element) => {
    const cols = byLocal(section, "cols")[0]
    const col = byLocal(section, "col")
    const count = Number(attr(cols, "num") || "1")
    const leftTwip = Number(attr(col[0], "w") || "0")
    if (count >= 2 && leftTwip > 0) {
      const gapTwip = Number(
        attr(col[0], "space") || attr(cols, "space") || "0"
      )
      const rightTwip = Number(attr(col[1], "w") || "0")
      const left: string[] = []
      const right: string[] = []
      let passed = false
      for (const paragraph of buffer) {
        const parts = textsAroundColumnBreak(paragraph)
        const breaks = byLocal(paragraph, "br").some(
          (node) => attr(node, "type") === "column"
        )
        if (!passed) {
          if (parts.before) left.push(parts.before)
          if (breaks) {
            passed = true
            if (parts.after) right.push(parts.after)
          }
        } else if (parts.before) right.push(parts.before)
      }
      plans.push({
        left,
        right,
        leftPx: (leftTwip * 96) / 1440,
        gapPx: Math.max(16, (gapTwip * 96) / 1440),
        rightPx: Math.max(48, (rightTwip * 96) / 1440 || 120),
      })
    }
    buffer = []
  }
  for (const child of [...body.children]) {
    if (child.localName === "sectPr") {
      flush(child)
      continue
    }
    buffer.push(child)
    const inner = byLocal(child, "sectPr")[0]
    if (inner) flush(inner)
  }
  return plans
}

function findParagraph(root: ParentNode, label: string) {
  const paragraphs = [...root.querySelectorAll("article p")].filter(
    (node) => !node.closest(".source-columns")
  )
  return (
    paragraphs.find((node) => collapsed(node.textContent ?? "") === label) ??
    paragraphs
      .filter((node) => collapsed(node.textContent ?? "").includes(label))
      .sort(
        (a, b) =>
          collapsed(a.textContent ?? "").length -
          collapsed(b.textContent ?? "").length
      )[0] ??
    null
  )
}

export function paintColumns(root: ParentNode, documentXml: string) {
  for (const plan of columnPlans(documentXml)) {
    const left = plan.left
      .map((label) => findParagraph(root, label))
      .filter((node): node is HTMLElement => node instanceof HTMLElement)
    const right = plan.right
      .map((label) => findParagraph(root, label))
      .filter((node): node is HTMLElement => node instanceof HTMLElement)
    const first = left[0]
    if (!first) continue
    const article = first.closest("article")
    if (!(article instanceof HTMLElement)) continue
    article.style.columnCount = "1"
    article.style.columnGap = "normal"
    const row = document.createElement("div")
    row.className = "source-columns"
    row.style.gridTemplateColumns = `${plan.leftPx}px minmax(12px,${plan.gapPx}px) minmax(0,${plan.rightPx}px)`
    const leftCol = document.createElement("div")
    const rightCol = document.createElement("div")
    first.before(row)
    for (const node of left) {
      node.style.maxWidth = ""
      leftCol.append(node)
    }
    for (const node of right) {
      node.style.maxWidth = ""
      rightCol.append(node)
    }
    row.append(leftCol, document.createElement("div"), rightCol)
  }
}
