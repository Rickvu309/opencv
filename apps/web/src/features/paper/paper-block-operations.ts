import {
  BLOCK_TYPES,
  blockRegistry,
  cvBlockSchema,
  plainTextOf,
  type CvBlock,
  type BlockType,
} from "@workspace/domain"

let nextBlockId = 0

export function makeId() {
  nextBlockId += 1
  return `editor-${Date.now()}-${nextBlockId}`
}

export function emptyBlock(type: string): CvBlock | null {
  const entry = blockRegistry.find((candidate) => candidate.type === type)
  if (!entry) return null
  const parsed = cvBlockSchema.safeParse({ ...entry.empty(), id: makeId() })
  return parsed.success ? parsed.data : null
}

export function duplicateBlock(block: CvBlock): CvBlock {
  switch (block.type) {
    case "bulleted-list":
    case "numbered-list":
      return {
        ...block,
        id: makeId(),
        items: block.items.map((item) => ({ ...item, id: makeId() })),
      }
    case "experience-entry":
      return {
        ...block,
        id: makeId(),
        bullets: block.bullets.map((item) => ({ ...item, id: makeId() })),
      }
    default:
      return { ...block, id: makeId() }
  }
}

export function turnBlockInto(block: CvBlock, type: BlockType): CvBlock | null {
  const text = plainTextOf(block)
  switch (type) {
    case "text":
      return { id: block.id, type, text }
    case "heading":
      return { id: block.id, type, text }
    case "bulleted-list":
      return { id: block.id, type, items: [{ id: makeId(), text }] }
    case "numbered-list":
      return { id: block.id, type, items: [{ id: makeId(), text }] }
    case "divider":
      return { id: block.id, type }
    default:
      return null
  }
}

export function blockTypeOf(value: string): BlockType | null {
  return BLOCK_TYPES.find((type) => type === value) ?? null
}
