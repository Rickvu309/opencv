import type { CvBlock, CvBlockDocument, CvSectionKind } from "@workspace/domain"

import { isStarterKind, newId, starterBlock } from "./paper-block-ops.ts"

function reorder<T>(items: T[], from: number, to: number) {
  const next = items.slice()
  const [item] = next.splice(from, 1)
  if (item === undefined) return items
  next.splice(to, 0, item)
  return next
}

function prune(document: CvBlockDocument): CvBlockDocument {
  return {
    ...document,
    sections: document.sections.filter(
      (section) => section.blocks.length > 0 || isStarterKind(section.kind)
    ),
  }
}

function sectionOf(document: CvBlockDocument, blockId: string) {
  return document.sections.find((section) =>
    section.blocks.some((block) => block.id === blockId)
  )
}

function headingSectionId(document: CvBlockDocument, overId: string) {
  if (!overId.startsWith("section:") || overId.startsWith("section:ghost-")) {
    return null
  }
  const sectionId = overId.slice("section:".length)
  return document.sections.some((section) => section.id === sectionId)
    ? sectionId
    : null
}

function unsavedStarterSection(document: CvBlockDocument, overId: string) {
  if (!overId.startsWith("draft-")) return null
  const sectionId = overId.slice("draft-".length)
  const section = document.sections.find((item) => item.id === sectionId)
  if (!section || section.blocks.some((item) => item.id === overId)) return null
  return sectionId
}

function blocksOnHeading(
  section: CvBlockDocument["sections"][number],
  block: CvBlock
) {
  const kept = section.blocks.filter((item) => item.id !== block.id)
  if (section.blocks.length > 0) return [...kept, block]
  const starter = starterBlock(section.kind, `draft-${section.id}`)
  return starter ? [starter, block] : [block]
}

function sameBlocks(left: readonly CvBlock[], right: readonly CvBlock[]) {
  return (
    left.length === right.length &&
    left.every((block, index) => block === right[index])
  )
}

function withoutBlock(
  document: CvBlockDocument,
  sectionId: string,
  blockId: string
): CvBlockDocument {
  return prune({
    ...document,
    sections: document.sections.map((section) =>
      section.id === sectionId
        ? {
            ...section,
            blocks: section.blocks.filter((item) => item.id !== blockId),
          }
        : section
    ),
  })
}

export function dropBlock(
  document: CvBlockDocument,
  activeId: string,
  overId: string
): CvBlockDocument {
  if (!overId || activeId === overId) return document
  const from = sectionOf(document, activeId)
  const block = from?.blocks.find((item) => item.id === activeId)
  if (!from || !block) return document

  if (!overId.startsWith("section:")) {
    const overSection = sectionOf(document, overId)
    if (overSection?.id === from.id) {
      const oldIndex = from.blocks.findIndex((item) => item.id === activeId)
      const newIndex = from.blocks.findIndex((item) => item.id === overId)
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return document
      return {
        ...document,
        sections: document.sections.map((section) =>
          section.id === from.id
            ? {
                ...section,
                blocks: reorder(section.blocks, oldIndex, newIndex),
              }
            : section
        ),
      }
    }
  }

  if (overId.startsWith("section:ghost-")) {
    const stripped = withoutBlock(document, from.id, activeId)
    const kind = overId.slice("section:ghost-".length) as CvSectionKind
    const id = newId()
    const starter = starterBlock(kind, `draft-${id}`)
    return {
      ...stripped,
      sections: [
        ...stripped.sections,
        { id, kind, blocks: starter ? [starter, block] : [block] },
      ],
    }
  }

  const sectionId =
    headingSectionId(document, overId) ??
    unsavedStarterSection(document, overId)
  if (sectionId) {
    const original = document.sections.find(
      (section) => section.id === sectionId
    )
    if (!original) return document
    const nextBlocks = blocksOnHeading(original, block)
    if (original.id === from.id && sameBlocks(nextBlocks, original.blocks)) {
      return document
    }
    return prune({
      ...document,
      sections: document.sections.map((section) => {
        if (section.id === sectionId) return { ...section, blocks: nextBlocks }
        if (section.id === from.id) {
          return {
            ...section,
            blocks: section.blocks.filter((item) => item.id !== activeId),
          }
        }
        return section
      }),
    })
  }

  const stripped = withoutBlock(document, from.id, activeId)
  const target = sectionOf(stripped, overId)
  if (!target) return document
  return {
    ...stripped,
    sections: stripped.sections.map((section) => {
      if (section.id !== target.id) return section
      const index = section.blocks.findIndex((item) => item.id === overId)
      const blocks = section.blocks.slice()
      blocks.splice(index < 0 ? blocks.length : index, 0, block)
      return { ...section, blocks }
    }),
  }
}
