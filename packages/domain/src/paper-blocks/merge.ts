import type { CvDocument } from "../paper-codecs.js"
import { cvCodecToBlocks } from "./codec.js"
import type { CvBlock, CvBlockDocument } from "./document.js"

const CARRIED_SECTION = new Set(["activities", "awards"])
const PRESERVED_BLOCK = new Set(["divider", "numbered-list"])

function sameItems(left: readonly string[], right: readonly string[]) {
  return (
    left.length === right.length &&
    left.every((item, index) => item === right[index])
  )
}

function withStoredId(stored: CvBlock, fresh: CvBlock): CvBlock {
  if (stored.type === "experience-entry" && fresh.type === "experience-entry") {
    return {
      ...fresh,
      id: stored.id,
      bullets: fresh.bullets.map((bullet, index) => ({
        id: stored.bullets[index]?.id ?? bullet.id,
        text: bullet.text,
      })),
    }
  }
  if (stored.type === "bulleted-list" && fresh.type === "bulleted-list") {
    return {
      ...fresh,
      id: stored.id,
      items: fresh.items.map((item, index) => ({
        id: stored.items[index]?.id ?? item.id,
        text: item.text,
      })),
    }
  }
  if (stored.type === "numbered-list" && fresh.type === "numbered-list") {
    return {
      ...fresh,
      id: stored.id,
      items: fresh.items.map((item, index) => ({
        id: stored.items[index]?.id ?? item.id,
        text: item.text,
      })),
    }
  }
  return { ...fresh, id: stored.id }
}

function skillGroups(blocks: readonly CvBlock[]) {
  return blocks.filter((block) => block.type === "skills-group")
}

function flatSkillItems(blocks: readonly CvBlock[]) {
  return skillGroups(blocks).flatMap((block) => block.items)
}

function mergeBlocks(
  kind: CvBlockDocument["sections"][number]["kind"],
  storedBlocks: CvBlock[],
  freshBlocks: CvBlock[]
): CvBlock[] {
  const storedGroups = skillGroups(storedBlocks)
  const freshGroups = skillGroups(freshBlocks)
  const firstStored = storedGroups[0]
  const firstFresh = freshGroups[0]
  if (
    kind === "skills" &&
    storedGroups.length > 1 &&
    freshGroups.length === 1 &&
    firstStored &&
    firstFresh &&
    firstStored.label === firstFresh.label &&
    sameItems(flatSkillItems(storedBlocks), firstFresh.items)
  ) {
    return storedBlocks
  }

  const freshRepresentable = freshBlocks.filter(
    (block) => !PRESERVED_BLOCK.has(block.type)
  )
  const result: CvBlock[] = []
  let freshIndex = 0
  for (const block of storedBlocks) {
    if (PRESERVED_BLOCK.has(block.type)) {
      result.push(block)
      continue
    }
    const fresh = freshRepresentable[freshIndex]
    if (!fresh || fresh.type !== block.type) continue
    result.push(withStoredId(block, fresh))
    freshIndex += 1
  }
  while (freshIndex < freshRepresentable.length) {
    const fresh = freshRepresentable[freshIndex]
    if (fresh) result.push(fresh)
    freshIndex += 1
  }

  if (kind === "skills" && storedGroups.length > 1) {
    const extras = storedGroups.slice(1)
    const extraItems = extras.flatMap((block) => block.items)
    let trimmed = false
    const adjusted = result.map((block) => {
      if (trimmed || block.type !== "skills-group") return block
      trimmed = true
      const items =
        extraItems.length > 0 &&
        sameItems(block.items.slice(-extraItems.length), extraItems)
          ? block.items.slice(0, block.items.length - extraItems.length)
          : block.items
      return { ...block, items }
    })
    return [...adjusted, ...extras]
  }
  return result
}

function mergeSections(
  stored: CvBlockDocument["sections"],
  fresh: CvBlockDocument["sections"]
): CvBlockDocument["sections"] {
  const freshByKind = new Map<string, (typeof fresh)[number]>()
  for (const section of fresh) {
    if (!freshByKind.has(section.kind)) freshByKind.set(section.kind, section)
  }
  const lastIndex = new Map<string, number>()
  stored.forEach((section, index) => {
    if (!CARRIED_SECTION.has(section.kind)) lastIndex.set(section.kind, index)
  })
  const seen = new Set<string>()
  const out: CvBlockDocument["sections"] = []
  stored.forEach((section, index) => {
    if (CARRIED_SECTION.has(section.kind)) {
      out.push(section)
      return
    }
    const isLast = lastIndex.get(section.kind) === index
    if (!isLast) {
      out.push(section)
      return
    }
    const incoming = freshByKind.get(section.kind)
    if (!incoming) {
      out.push({
        ...section,
        blocks: section.blocks.filter((block) =>
          PRESERVED_BLOCK.has(block.type)
        ),
      })
      return
    }
    seen.add(section.kind)
    out.push({
      id: section.id,
      kind: section.kind,
      blocks: mergeBlocks(section.kind, section.blocks, incoming.blocks),
    })
  })
  for (const section of fresh) {
    if (seen.has(section.kind)) continue
    if (stored.some((item) => item.kind === section.kind)) continue
    out.push(section)
  }
  return out
}

/**
 * Writes the form's v1 fields back onto a version 2 document.
 * Section ids stay. Block ids stay where the type at that position matches.
 * Activities, awards, dividers, numbered lists and extra skill labels stay
 * on the stored document, because the form cannot hold them.
 */
export function mergeCodecIntoBlocks(
  stored: CvBlockDocument,
  edited: CvDocument
): CvBlockDocument {
  const fresh = cvCodecToBlocks(edited)
  return {
    version: 2,
    header: fresh.header,
    sections: mergeSections(stored.sections, fresh.sections),
  }
}
