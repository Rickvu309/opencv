import type { CvPaper, PaperDocument } from "./document.js"
import { flatItems, mergeItems } from "./merge-items.js"
import {
  flatRun,
  groupIndexById,
  isListBlock,
  itemsOfGroup,
  listGroups,
  type ListBlock,
} from "./merge-lists.js"
import { mergeLetter } from "./merge-letter.js"
import { rebaseRuns } from "./merge-text.js"
import type { CvPaperBlock, EducationEntry } from "./nodes.js"
import { plainTextOfRuns } from "./rich-text.js"

function foldedDetail(block: EducationEntry): string {
  return [
    block.detail,
    ...flatItems(block.children).map((entry) =>
      plainTextOfRuns(entry.item.content)
    ),
  ]
    .filter((part) => part !== "")
    .join("\n")
}

function mergeBlock(
  current: CvPaperBlock | undefined,
  sent: CvPaperBlock
): CvPaperBlock {
  if (!current || current.type !== sent.type) return sent
  switch (sent.type) {
    case "section":
      return current.type === "section" && current.kind === sent.kind
        ? current
        : sent
    case "paragraph":
    case "heading":
      return {
        ...(current as typeof sent),
        content: rebaseRuns(
          (current as typeof sent).content,
          plainTextOfRuns(sent.content)
        ),
      }
    case "experience":
      return {
        ...(current as typeof sent),
        role: sent.role,
        company: sent.company,
        period: sent.period,
        location: sent.location,
        children: mergeItems((current as typeof sent).children, sent.children),
      }
    case "education": {
      const before = current as typeof sent
      const same = sent.detail === foldedDetail(before)
      return {
        ...before,
        school: sent.school,
        degree: sent.degree,
        period: sent.period,
        detail: same ? before.detail : sent.detail,
        children: same ? before.children : [],
      }
    }
    case "skills":
      return {
        ...(current as typeof sent),
        label: sent.label,
        items: sent.items,
      }
    default:
      return current
  }
}

const LEADING_SECTION = /^section-leading(?:-\d+)?$/

function mergeCv(current: CvPaper, sent: CvPaper): CvPaper {
  const byId = new Map(
    current.blocks.map((block) => [block.id as string, block])
  )
  const groups = listGroups(current.blocks)
  const owner = groupIndexById(current.blocks, groups)
  const known = new Map(
    groups.flatMap((group) =>
      flatItems(itemsOfGroup(current.blocks, group)).map(
        (entry) => [entry.item.id as string, entry.item] as const
      )
    )
  )
  const used = new Set<number>()
  const blocks: CvPaperBlock[] = []
  let index = 0
  while (index < sent.blocks.length) {
    const block = sent.blocks[index]!
    if (!isListBlock(block)) {
      index += 1
      const dropped =
        block.type === "section" &&
        !byId.has(block.id) &&
        LEADING_SECTION.test(block.id)
      if (!dropped) blocks.push(mergeBlock(byId.get(block.id), block))
      continue
    }
    let end = index
    while (end < sent.blocks.length && isListBlock(sent.blocks[end]!)) end += 1
    const run = sent.blocks.slice(index, end) as ListBlock[]
    index = end
    const owners = [
      ...new Set(
        run.flatMap((item) => {
          const group = owner.get(item.id)
          return group === undefined ? [] : [group]
        })
      ),
    ]
    if (owners.length === 0) {
      blocks.push(...run)
    } else if (owners.some((group) => used.has(group))) {
      blocks.push(...(flatRun(run, known) as ListBlock[]))
    } else {
      owners.forEach((group) => used.add(group))
      const items = owners.flatMap((group) =>
        itemsOfGroup(current.blocks, groups[group]!)
      )
      blocks.push(...(mergeItems(items, run) as ListBlock[]))
    }
  }
  const { photo: _photo, ...kept } = current.header
  void _photo
  return {
    ...current,
    header: {
      ...kept,
      name: sent.header.name,
      email: sent.header.email,
      phone: sent.header.phone,
      city: sent.header.city,
      linkedin: sent.header.linkedin,
      ...(sent.header.photo ? { photo: sent.header.photo } : {}),
    },
    blocks,
  }
}

export function mergeLegacyEdit(
  current: PaperDocument,
  sent: PaperDocument
): PaperDocument {
  if (current.kind === "cv" && sent.kind === "cv") return mergeCv(current, sent)
  if (current.kind === "letter" && sent.kind === "letter") {
    return mergeLetter(current, sent)
  }
  return sent
}
