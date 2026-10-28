import type { ZodType } from "zod"

import { bulletedListBlock } from "./blocks/bulleted-list.js"
import { dividerBlock } from "./blocks/divider.js"
import { educationEntryBlock } from "./blocks/education-entry.js"
import { experienceEntryBlock } from "./blocks/experience-entry.js"
import { headingBlock } from "./blocks/heading.js"
import { numberedListBlock } from "./blocks/numbered-list.js"
import { skillsGroupBlock } from "./blocks/skills-group.js"
import { textBlock } from "./blocks/text.js"
import type {
  BlockRegistryEntry,
  BlockShape,
  PreviewFragment,
} from "./types.js"

type RawEntry<T extends BlockShape> = {
  type: T["type"]
  schema: ZodType<T>
  empty: () => T
  slash?: BlockRegistryEntry["slash"]
  print: (block: T) => PreviewFragment
  plainText: (block: T) => string
  turnInto: readonly string[]
}

function defineBlock<const T extends BlockShape, S extends ZodType<T>>(
  entry: Omit<RawEntry<T>, "schema"> & { schema: S }
) {
  return {
    type: entry.type,
    schema: entry.schema,
    empty: () => entry.empty(),
    slash: entry.slash,
    print: (block: BlockShape) => entry.print(block as T),
    plainText: (block: BlockShape) => entry.plainText(block as T),
    turnInto: entry.turnInto,
  }
}

export const blockRegistry = [
  defineBlock(textBlock),
  defineBlock(headingBlock),
  defineBlock(bulletedListBlock),
  defineBlock(numberedListBlock),
  defineBlock(dividerBlock),
  defineBlock(experienceEntryBlock),
  defineBlock(educationEntryBlock),
  defineBlock(skillsGroupBlock),
] as const

export type BlockType = (typeof blockRegistry)[number]["type"]

export const BLOCK_TYPES: readonly BlockType[] = blockRegistry.map(
  (entry) => entry.type
)

const byType = new Map<BlockType, (typeof blockRegistry)[number]>(
  blockRegistry.map((entry) => [entry.type, entry])
)

export function blockEntry(type: BlockType): (typeof blockRegistry)[number] {
  const entry = byType.get(type)
  if (!entry) throw new Error(`Unknown block type ${type}`)
  return entry
}

export function printBlock(block: BlockShape): PreviewFragment {
  return blockEntry(block.type as BlockType).print(block)
}

export function plainTextOf(block: BlockShape): string {
  return blockEntry(block.type as BlockType).plainText(block)
}
