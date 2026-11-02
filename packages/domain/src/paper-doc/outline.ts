import type { PaperDocument } from "./document.js"
import type { CvHeader, ListItem, PaperNode } from "./nodes.js"
import { inlineMarkdownOf } from "./rich-text.js"
import { childrenOf } from "./tree.js"

export type PaperOutline = {
  readonly text: string
  readonly truncated: boolean
  readonly omitted: number
}

const LINE_CAP = 400
const SELECTED = ">> "

type Group = {
  readonly lines: string[]
  readonly size: number
  readonly selected: boolean
}

function capped(line: string): string {
  return line.length <= LINE_CAP ? line : `${line.slice(0, LINE_CAP - 1)}…`
}

function headerLine(header: CvHeader): string {
  const fields = [
    ["name", header.name],
    ["email", header.email],
    ["phone", header.phone],
    ["city", header.city],
    ["linkedin", header.linkedin],
  ] as const
  const parts = fields
    .filter(([, value]) => value.length > 0)
    .map(([label, value]) => `${label}: ${value}`)
  if (header.photo) parts.push("photo: yes")
  return parts.join(" · ") || "(empty)"
}

function itemMarker(item: ListItem, position: number): string {
  return item.type === "numbered" ? `${position}.` : "-"
}

function runPositions(items: readonly PaperNode[]): number[] {
  let run = 0
  let previous: string | null = null
  return items.map((item) => {
    run = item.type === previous ? run + 1 : 1
    previous = item.type
    return run
  })
}

export function nodeSummary(node: PaperNode, position: number): string {
  switch (node.type) {
    case "header":
      return headerLine(node)
    case "section":
      return `# ${node.title} (section ${node.kind})`
    case "paragraph":
      return inlineMarkdownOf(node.content)
    case "heading":
      return `${node.level === 3 ? "###" : "##"} ${inlineMarkdownOf(node.content)}`
    case "bullet":
    case "numbered":
      return `${itemMarker(node, position)} ${inlineMarkdownOf(node.content)}`
    case "divider":
      return "---"
    case "experience":
      return `Experience: role: ${node.role} · company: ${node.company} · period: ${node.period} · location: ${node.location}`
    case "education":
      return `Education: school: ${node.school} · degree: ${node.degree} · period: ${node.period} · detail: ${node.detail}`
    case "skills":
      return `Skills ${node.label}: ${node.items.join(", ")}`
  }
}

function linesOf(
  nodes: readonly PaperNode[],
  depth: number,
  selected: ReadonlySet<string>,
  into: string[]
): boolean {
  let anySelected = false
  const positions = runPositions(nodes)
  nodes.forEach((node, index) => {
    const mark = selected.has(node.id)
    anySelected ||= mark
    const text = nodeSummary(node, positions[index]!)
    into.push(
      capped(`${mark ? SELECTED : ""}${"  ".repeat(depth)}[${node.id}] ${text}`)
    )
    if (linesOf(childrenOf(node) ?? [], depth + 1, selected, into))
      anySelected = true
  })
  return anySelected
}

function groupOf(node: PaperNode, selected: ReadonlySet<string>): Group {
  const lines: string[] = []
  const any = linesOf([node], 0, selected, lines)
  const size = lines.reduce((total, line) => total + line.length + 1, 0)
  return { lines, size, selected: any }
}

function leftOut(count: number): string {
  return `… ${count} more block${count === 1 ? "" : "s"} left out`
}

export function paperOutline(
  doc: PaperDocument,
  options: { selected?: readonly string[]; maxChars: number }
): PaperOutline {
  const selected = new Set(options.selected ?? [])
  const groups: Group[] = []
  if (doc.kind === "cv") groups.push(groupOf(doc.header, selected))
  for (const block of doc.blocks) groups.push(groupOf(block, selected))

  const footerRoom = 80
  let room = options.maxChars - footerRoom
  const shown = new Set<number>()
  const claim = (index: number) => {
    const group = groups[index]!
    if (group.size > room && shown.size > 0) return
    shown.add(index)
    room -= group.size
  }
  groups.forEach((group, index) => {
    if (group.selected) claim(index)
  })
  groups.forEach((_group, index) => {
    if (!shown.has(index)) claim(index)
  })

  const out: string[] = []
  let gap = 0
  groups.forEach((group, index) => {
    if (shown.has(index)) {
      if (gap > 0) out.push(leftOut(gap))
      gap = 0
      out.push(...group.lines)
    } else {
      gap += 1
    }
  })
  if (gap > 0) out.push(leftOut(gap))
  const omitted = groups.length - shown.size
  let text = out.join("\n")
  let truncated = omitted > 0
  if (text.length > options.maxChars) {
    text = `${text.slice(0, options.maxChars - 1)}…`
    truncated = true
  }
  return { text, truncated, omitted }
}
